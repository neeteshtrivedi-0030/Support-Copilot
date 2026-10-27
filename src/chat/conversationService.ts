import { Types } from 'mongoose';
import { Conversation, Message } from '../models';
import {
  IConversationModel,
  IMessageModel,
  IConversationListQuery,
  IConversationListResult,
  IConversationListItem,
  IConversationDetailResponseData,
  IMessageItem,
  IChatSource,
  ITokenUsage,
} from '../types';
import { MessageSender } from '../enum';

export class ConversationService {
  public async listUserConversations(
    userId: string,
    query: IConversationListQuery = {}
  ): Promise<IConversationListResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (query.isArchived !== undefined) {
      filter.isArchived = query.isArchived;
    }

    if (query.search && query.search.trim()) {
      filter.title = { $regex: query.search.trim(), $options: 'i' };
    }

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Conversation.countDocuments(filter),
    ]);

    const conversationIds = conversations.map((c) => c._id);
    const messageCountAggregation = await Message.aggregate<{ _id: Types.ObjectId; count: number }>(
      [
        { $match: { conversationId: { $in: conversationIds } } },
        { $group: { _id: '$conversationId', count: { $sum: 1 } } },
      ]
    );

    const countMap = new Map<string, number>();
    messageCountAggregation.forEach((item) => {
      countMap.set(item._id.toString(), item.count);
    });

    const items: IConversationListItem[] = conversations.map((conv) => ({
      id: conv._id.toString(),
      _id: conv._id.toString(),
      title: conv.title,
      lastMessageAt: conv.lastMessageAt,
      isArchived: conv.isArchived,
      messageCount: countMap.get(conv._id.toString()) || 0,
      createdAt: conv.createdAt,
    }));

    return {
      conversations: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async getConversationById(
    conversationId: string,
    userId: string,
    isAdmin = false
  ): Promise<IConversationDetailResponseData | null> {
    const conversation = await Conversation.findById(conversationId).exec();
    if (!conversation) {
      return null;
    }

    if (!isAdmin && conversation.userId.toString() !== userId) {
      const error = new Error('FORBIDDEN');
      error.name = 'ForbiddenError';
      throw error;
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .exec();

    const mappedMessages: IMessageItem[] = messages.map((m) => ({
      id: m._id.toString(),
      _id: m._id.toString(),
      sender: m.sender,
      role: m.sender === MessageSender.USER ? 'user' : 'assistant',
      content: m.content,
      sources: (m.sources || []).map((s) => ({
        documentId: s.documentId ? s.documentId.toString() : '',
        chunkId: s.chunkId ? s.chunkId.toString() : '',
        documentName: s.documentName,
        pageNumber: s.pageNumber,
        section: s.section,
        snippet: s.snippet,
        similarityScore: s.similarityScore ?? 1,
      })),
      tokens: m.tokens,
      responseTimeMs: m.responseTimeMs,
      createdAt: m.createdAt,
    }));

    return {
      conversation: {
        id: conversation._id.toString(),
        _id: conversation._id.toString(),
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        isArchived: conversation.isArchived,
      },
      messages: mappedMessages,
    };
  }

  public async createConversation(
    userId: string,
    initialTitle?: string
  ): Promise<IConversationModel> {
    const title = initialTitle ? initialTitle.slice(0, 100).trim() : 'New Conversation';
    return Conversation.create({
      userId: new Types.ObjectId(userId),
      title,
      lastMessageAt: new Date(),
    });
  }

  public async deleteConversation(
    conversationId: string,
    userId: string,
    isAdmin = false
  ): Promise<boolean> {
    const conversation = await Conversation.findById(conversationId).exec();
    if (!conversation) {
      return false;
    }

    if (!isAdmin && conversation.userId.toString() !== userId) {
      const error = new Error('FORBIDDEN');
      error.name = 'ForbiddenError';
      throw error;
    }

    await Message.deleteMany({ conversationId: conversation._id }).exec();
    await Conversation.findByIdAndDelete(conversation._id).exec();

    return true;
  }

  public async renameConversation(
    conversationId: string,
    userId: string,
    newTitle: string,
    isAdmin = false
  ): Promise<IConversationModel | null> {
    const conversation = await Conversation.findById(conversationId).exec();
    if (!conversation) {
      return null;
    }

    if (!isAdmin && conversation.userId.toString() !== userId) {
      const error = new Error('FORBIDDEN');
      error.name = 'ForbiddenError';
      throw error;
    }

    conversation.title = newTitle.trim();
    await conversation.save();
    return conversation;
  }

  public async getRecentMessages(
    conversationId: string,
    limit = 6
  ): Promise<Array<{ sender: MessageSender; content: string; sources?: IChatSource[] }>> {
    const recent = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('sender content sources')
      .exec();

    return recent.reverse().map((m) => ({
      sender: m.sender,
      content: m.content,
      sources: (m.sources || []).map((s) => ({
        documentId: s.documentId ? s.documentId.toString() : '',
        chunkId: s.chunkId ? s.chunkId.toString() : '',
        documentName: s.documentName,
        pageNumber: s.pageNumber,
        section: s.section,
        snippet: s.snippet,
        similarityScore: s.similarityScore ?? 1,
      })),
    }));
  }

  public async addMessage(
    conversationId: string,
    sender: MessageSender,
    content: string,
    sources: IChatSource[] = [],
    tokens?: ITokenUsage,
    responseTimeMs?: number
  ): Promise<IMessageModel> {
    const mappedSources = sources.map((s) => ({
      documentId: new Types.ObjectId(s.documentId),
      chunkId: s.chunkId ? new Types.ObjectId(s.chunkId) : undefined,
      documentName: s.documentName,
      pageNumber: s.pageNumber,
      section: s.section,
      snippet: s.snippet,
      similarityScore: s.similarityScore,
    }));

    const message = await Message.create({
      conversationId: new Types.ObjectId(conversationId),
      sender,
      content,
      sources: mappedSources,
      tokens,
      responseTimeMs,
    });

    const updateFields: Record<string, unknown> = {
      lastMessageAt: new Date(),
    };

    if (sender === MessageSender.USER) {
      const conv = await Conversation.findById(conversationId).exec();
      if (conv && conv.title === 'New Conversation') {
        updateFields.title = content.length > 50 ? `${content.slice(0, 47)}...` : content;
      }
    }

    await Conversation.findByIdAndUpdate(conversationId, updateFields).exec();

    return message;
  }
}

export const conversationService = new ConversationService();
export default conversationService;
