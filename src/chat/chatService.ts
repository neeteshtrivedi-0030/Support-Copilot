import crypto from 'crypto';
import { Types } from 'mongoose';
import { conversationService } from './conversationService';
import { ragService } from '../rag/ragService';
import { llmService } from '../llm/llmService';
import { QueryLog, Message, Feedback } from '../models';
import { getRedisClient } from '../config/redis';
import {
  IChatRequest,
  IChatResponseData,
  IChatStreamEvent,
  ISearchRequest,
  ISearchResponseData,
  IFeedbackRequest,
  IChatSource,
  ITokenUsage,
  IUserDocument,
  IFeedbackModel,
} from '../types';
import { MessageSender, QueryLogStatus, FeedbackRating } from '../enum';

export class ChatService {
  public async processChat(user: IUserDocument, request: IChatRequest): Promise<IChatResponseData> {
    const startTime = Date.now();
    let conversationId = request.conversationId;

    if (conversationId) {
      const existingConv = await conversationService.getConversationById(
        conversationId,
        user._id.toString(),
        user.role === 'admin'
      );
      if (!existingConv) {
        const error = new Error('CONVERSATION_NOT_FOUND');
        error.name = 'NotFoundError';
        throw error;
      }
    } else {
      const newConv = await conversationService.createConversation(
        user._id.toString(),
        request.message
      );
      conversationId = newConv._id.toString();
    }

    await conversationService.addMessage(conversationId, MessageSender.USER, request.message);

    const history = await conversationService.getRecentMessages(conversationId, 6);

    const standaloneQuery = await llmService.rewriteQuery({
      query: request.message,
      conversationHistory: history,
    });

    // Redis AI Query Caching (Task 15: Scenario 1)
    const redis = getRedisClient();
    const queryHash = crypto
      .createHash('sha256')
      .update(`${user.department}:${standaloneQuery.toLowerCase().trim()}`)
      .digest('hex');
    const cacheKey = `rag:query:${queryHash}`;

    let answerResult: { answer: string; tokens: ITokenUsage } | null = null;
    let contextChunks: IChatSource[] = [];

    if (redis) {
      try {
        const cachedRaw = await redis.get(cacheKey);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          answerResult = {
            answer: parsed.answer,
            tokens: parsed.tokens || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          };
          contextChunks = parsed.sources || [];
        }
      } catch (cacheErr) {
        console.warn('[ChatService] Redis cache lookup warning:', cacheErr);
      }
    }

    if (!answerResult) {
      contextChunks = await ragService.retrieveChunks({
        user: {
          role: user.role,
          department: user.department,
        },
        query: standaloneQuery,
        departmentFilter: request.department,
        limit: 4,
      });

      // Context carry-forward if RAG retrieval found 0 chunks but thread has previous sources
      if (contextChunks.length === 0 && history.length > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
          if (
            history[i].sender === MessageSender.ASSISTANT &&
            history[i].sources &&
            history[i].sources!.length > 0
          ) {
            contextChunks = history[i].sources!;
            break;
          }
        }
      }

      const generated = await llmService.generateAnswer({
        query: standaloneQuery,
        contextChunks,
        conversationHistory: history,
      });

      answerResult = generated;

      if (
        redis &&
        answerResult.answer &&
        !answerResult.answer.includes('could not find this information')
      ) {
        try {
          await redis.setex(
            cacheKey,
            3600, // 1-hour cache TTL
            JSON.stringify({
              answer: answerResult.answer,
              sources: contextChunks,
              tokens: answerResult.tokens,
            })
          );
        } catch (cacheErr) {
          console.warn('[ChatService] Redis cache save warning:', cacheErr);
        }
      }
    }

    const responseTimeMs = Date.now() - startTime;
    const finalAnswer = answerResult!;

    const assistantMessage = await conversationService.addMessage(
      conversationId,
      MessageSender.ASSISTANT,
      finalAnswer.answer,
      contextChunks,
      finalAnswer.tokens,
      responseTimeMs
    );

    const avgSimilarityScore =
      contextChunks.length > 0
        ? Number(
            (
              contextChunks.reduce((acc, c) => acc + c.similarityScore, 0) / contextChunks.length
            ).toFixed(3)
          )
        : undefined;

    try {
      await QueryLog.create({
        userId: user._id,
        conversationId: new Types.ObjectId(conversationId),
        query: request.message,
        rewrittenQuery: standaloneQuery !== request.message ? standaloneQuery : undefined,
        retrievedChunkCount: contextChunks.length,
        responseTimeMs,
        averageSimilarityScore: avgSimilarityScore,
        status: contextChunks.length > 0 ? QueryLogStatus.SUCCESS : QueryLogStatus.NO_ANSWER,
        departmentFilter: request.department,
      });
    } catch (logErr) {
      console.warn('[ChatService] Query log creation warning:', logErr);
    }

    return {
      conversationId,
      messageId: assistantMessage._id.toString(),
      answer: finalAnswer.answer,
      sources: contextChunks,
      tokens: finalAnswer.tokens,
      responseTimeMs,
    };
  }

  public async processChatStream(
    user: IUserDocument,
    request: IChatRequest,
    onEvent: (event: IChatStreamEvent) => void
  ): Promise<void> {
    const startTime = Date.now();
    let conversationId = request.conversationId;

    if (conversationId) {
      const existingConv = await conversationService.getConversationById(
        conversationId,
        user._id.toString(),
        user.role === 'admin'
      );
      if (!existingConv) {
        const error = new Error('CONVERSATION_NOT_FOUND');
        error.name = 'NotFoundError';
        throw error;
      }
    } else {
      const newConv = await conversationService.createConversation(
        user._id.toString(),
        request.message
      );
      conversationId = newConv._id.toString();
    }

    await conversationService.addMessage(conversationId, MessageSender.USER, request.message);
    const history = await conversationService.getRecentMessages(conversationId, 6);

    const standaloneQuery = await llmService.rewriteQuery({
      query: request.message,
      conversationHistory: history,
    });

    // Redis AI Query Caching (Task 15: Scenario 1)
    const redis = getRedisClient();
    const queryHash = crypto
      .createHash('sha256')
      .update(`${user.department}:${standaloneQuery.toLowerCase().trim()}`)
      .digest('hex');
    const cacheKey = `rag:query:${queryHash}`;

    let cachedResult: { answer: string; sources: IChatSource[]; tokens: ITokenUsage } | null = null;

    if (redis) {
      try {
        const cachedRaw = await redis.get(cacheKey);
        if (cachedRaw) {
          cachedResult = JSON.parse(cachedRaw);
        }
      } catch (cacheErr) {
        console.warn('[ChatService] Redis cache lookup warning:', cacheErr);
      }
    }

    if (cachedResult) {
      // Immediate response on cache hit
      onEvent({ type: 'sources', sources: cachedResult.sources });
      onEvent({ type: 'content', answer: cachedResult.answer });

      const responseTimeMs = Date.now() - startTime;
      const assistantMessage = await conversationService.addMessage(
        conversationId,
        MessageSender.ASSISTANT,
        cachedResult.answer,
        cachedResult.sources,
        cachedResult.tokens,
        responseTimeMs
      );

      onEvent({
        type: 'done',
        conversationId,
        messageId: assistantMessage._id.toString(),
        tokens: cachedResult.tokens,
        responseTimeMs,
      });
      return;
    }

    // Cache miss: perform retrieval
    let contextChunks = await ragService.retrieveChunks({
      user: {
        role: user.role,
        department: user.department,
      },
      query: standaloneQuery,
      departmentFilter: request.department,
      limit: 4,
    });

    // Context carry-forward if RAG retrieval found 0 chunks but thread has previous sources
    if (contextChunks.length === 0 && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (
          history[i].sender === MessageSender.ASSISTANT &&
          history[i].sources &&
          history[i].sources!.length > 0
        ) {
          contextChunks = history[i].sources!;
          break;
        }
      }
    }

    // Immediately emit sources so frontend previews citations while answer streams
    onEvent({ type: 'sources', sources: contextChunks });

    // Stream progressive answer tokens
    const generated = await llmService.generateAnswerStream(
      {
        query: standaloneQuery,
        contextChunks,
        conversationHistory: history,
      },
      (delta: string) => {
        onEvent({ type: 'content', answer: delta });
      }
    );

    const responseTimeMs = Date.now() - startTime;

    const assistantMessage = await conversationService.addMessage(
      conversationId,
      MessageSender.ASSISTANT,
      generated.answer,
      contextChunks,
      generated.tokens,
      responseTimeMs
    );

    // Cache successful grounded responses in Redis (1-hour TTL)
    if (
      redis &&
      generated.answer &&
      !generated.answer.includes('could not find this information')
    ) {
      try {
        await redis.setex(
          cacheKey,
          3600,
          JSON.stringify({
            answer: generated.answer,
            sources: contextChunks,
            tokens: generated.tokens,
          })
        );
      } catch (cacheErr) {
        console.warn('[ChatService] Redis cache save warning:', cacheErr);
      }
    }

    const avgSimilarityScore =
      contextChunks.length > 0
        ? Number(
            (
              contextChunks.reduce((acc, c) => acc + c.similarityScore, 0) / contextChunks.length
            ).toFixed(3)
          )
        : undefined;

    try {
      await QueryLog.create({
        userId: user._id,
        conversationId: new Types.ObjectId(conversationId),
        query: request.message,
        rewrittenQuery: standaloneQuery !== request.message ? standaloneQuery : undefined,
        retrievedChunkCount: contextChunks.length,
        responseTimeMs,
        averageSimilarityScore: avgSimilarityScore,
        status: contextChunks.length > 0 ? QueryLogStatus.SUCCESS : QueryLogStatus.NO_ANSWER,
        departmentFilter: request.department,
      });
    } catch (logErr) {
      console.warn('[ChatService] Query log creation warning:', logErr);
    }

    onEvent({
      type: 'done',
      conversationId,
      messageId: assistantMessage._id.toString(),
      tokens: generated.tokens,
      responseTimeMs,
    });
  }

  public async processSearch(
    user: IUserDocument,
    request: ISearchRequest
  ): Promise<ISearchResponseData> {
    const startTime = Date.now();

    // Redis Search Caching
    const redis = getRedisClient();
    const searchHash = crypto
      .createHash('sha256')
      .update(
        `${user.department}:${request.department || ''}:${request.query.toLowerCase().trim()}`
      )
      .digest('hex');
    const searchCacheKey = `cache:search:${searchHash}`;

    if (redis) {
      try {
        const cached = await redis.get(searchCacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            query: request.query,
            total: parsed.length,
            results: parsed,
          };
        }
      } catch (cacheErr) {
        console.warn('[ChatService] Redis search cache lookup warning:', cacheErr);
      }
    }

    const results = await ragService.searchChunks({
      user: {
        role: user.role,
        department: user.department,
      },
      query: request.query,
      departmentFilter: request.department,
      limit: request.limit || 5,
      minScore: request.minScore,
    });

    if (redis && results.length > 0) {
      try {
        await redis.setex(searchCacheKey, 300, JSON.stringify(results));
      } catch (cacheErr) {
        console.warn('[ChatService] Redis search cache save warning:', cacheErr);
      }
    }

    const responseTimeMs = Date.now() - startTime;
    const avgScore =
      results.length > 0
        ? Number(
            (results.reduce((acc, r) => acc + r.similarityScore, 0) / results.length).toFixed(3)
          )
        : undefined;

    try {
      await QueryLog.create({
        userId: user._id,
        query: request.query,
        retrievedChunkCount: results.length,
        responseTimeMs,
        averageSimilarityScore: avgScore,
        status: results.length > 0 ? QueryLogStatus.SUCCESS : QueryLogStatus.NO_ANSWER,
        departmentFilter: request.department,
      });
    } catch (logErr) {
      console.warn('[ChatService] Search query log warning:', logErr);
    }

    return {
      query: request.query,
      total: results.length,
      results,
    };
  }

  public async submitFeedback(
    user: IUserDocument,
    request: IFeedbackRequest
  ): Promise<IFeedbackModel> {
    const message = await Message.findById(request.messageId).exec();
    if (!message) {
      const error = new Error('MESSAGE_NOT_FOUND');
      error.name = 'NotFoundError';
      throw error;
    }

    const retrievedDocumentIds = (message.sources || [])
      .map((s) => s.documentId)
      .filter((docId): docId is Types.ObjectId => Boolean(docId));

    const feedbackDoc = await Feedback.findOneAndUpdate(
      {
        messageId: new Types.ObjectId(request.messageId),
        userId: user._id,
      },
      {
        conversationId: new Types.ObjectId(request.conversationId),
        userId: user._id,
        messageId: new Types.ObjectId(request.messageId),
        rating: request.rating as FeedbackRating,
        comment: request.comment?.trim() || undefined,
        retrievedDocumentIds,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    return feedbackDoc!;
  }
}

export const chatService = new ChatService();
export default chatService;
