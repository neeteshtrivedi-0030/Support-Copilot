import { Types } from 'mongoose';
import { conversationService } from './conversationService';
import { ragService } from '../rag/ragService';
import { llmService } from '../llm/llmService';
import { QueryLog, Message, Feedback } from '../models';
import {
  IChatRequest,
  IChatResponseData,
  ISearchRequest,
  ISearchResponseData,
  IFeedbackRequest,
} from '../types/chat.interface';
import { IUserDocument } from '../types/user.interface';
import { IFeedbackModel } from '../types/feedback.interface';
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

    const contextChunks = await ragService.retrieveChunks({
      user: {
        role: user.role,
        department: user.department,
      },
      query: standaloneQuery,
      departmentFilter: request.department,
      limit: 4,
    });

    const answerResult = await llmService.generateAnswer({
      query: standaloneQuery,
      contextChunks,
      conversationHistory: history,
    });

    const responseTimeMs = Date.now() - startTime;

    const assistantMessage = await conversationService.addMessage(
      conversationId,
      MessageSender.ASSISTANT,
      answerResult.answer,
      contextChunks,
      answerResult.tokens,
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
      answer: answerResult.answer,
      sources: contextChunks,
      tokens: answerResult.tokens,
      responseTimeMs,
    };
  }

  public async processSearch(
    user: IUserDocument,
    request: ISearchRequest
  ): Promise<ISearchResponseData> {
    const startTime = Date.now();

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
