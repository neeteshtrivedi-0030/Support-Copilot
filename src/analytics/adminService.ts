import { Types } from 'mongoose';
import {
  User,
  KnowledgeDocument,
  DocumentChunk,
  QueryLog,
  Feedback,
  Message,
  AuditLog,
} from '../models';
import {
  IUserListQuery,
  IUserListResult,
  IAdminAnalytics,
  IMostAskedQuestion,
  IMostUsedDocument,
} from '../types';
import {
  UserRole,
  DocumentProcessingStatus,
  DocumentFileType,
  QueryLogStatus,
  FeedbackRating,
  MessageSender,
  AuditAction,
  AuditResourceType,
} from '../enum';
import { authService } from '../auth/authService';
import { documentService } from '../documents/documentService';

export class AdminService {
  public async listUsers(query: IUserListQuery = {}): Promise<IUserListResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (query.role) {
      filter.role = query.role;
    } else {
      filter.role = UserRole.EMPLOYEE;
    }

    if (query.department) {
      filter.department = query.department;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      User.countDocuments(filter),
    ]);

    const sanitizedUsers = users.map((u) => authService.sanitizeUser(u));

    return {
      users: sanitizedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async deleteDocument(
    id: string,
    adminUserId: string,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<boolean> {
    const document = await KnowledgeDocument.findById(id).exec();
    if (!document) {
      return false;
    }

    const deleted = await documentService.deleteDocument(id);
    if (!deleted) {
      return false;
    }

    try {
      await AuditLog.create({
        userId: adminUserId,
        action: AuditAction.DELETE_DOCUMENT,
        resourceType: AuditResourceType.DOCUMENT,
        resourceId: id,
        details: {
          documentName: document.name,
          department: document.department,
          type: document.type,
          chunkCount: document.chunkCount,
        },
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      });
    } catch (auditError) {
      console.warn('[AdminService] Audit log creation warning:', auditError);
    }

    return true;
  }

  public async getAnalytics(): Promise<IAdminAnalytics> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      usersByRoleRaw,
      usersByDeptRaw,
      totalDocuments,
      docsByStatusRaw,
      docsByTypeRaw,
      docsByDeptRaw,
      totalChunks,
      totalQuestions,
      questionsToday,
      successfulQueries,
      failedQueries,
      noAnswerQueries,
      queryStatsRaw,
      totalFeedback,
      positiveFeedback,
      negativeFeedback,
      mostAskedQuestionsRaw,
      mostUsedDocsFromMessages,
    ] = await Promise.all([
      User.countDocuments({ role: UserRole.EMPLOYEE }),
      User.countDocuments({ role: UserRole.EMPLOYEE, isActive: true }),
      User.countDocuments({ role: UserRole.EMPLOYEE, isActive: false }),
      User.aggregate<{ _id: string; count: number }>([
        { $match: { role: UserRole.EMPLOYEE } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      User.aggregate<{ _id: string; count: number }>([
        { $match: { role: UserRole.EMPLOYEE } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]),

      KnowledgeDocument.countDocuments(),
      KnowledgeDocument.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      KnowledgeDocument.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      KnowledgeDocument.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]),
      DocumentChunk.countDocuments(),

      QueryLog.countDocuments(),
      QueryLog.countDocuments({ createdAt: { $gte: startOfToday } }),
      QueryLog.countDocuments({ status: QueryLogStatus.SUCCESS }),
      QueryLog.countDocuments({ status: QueryLogStatus.ERROR }),
      QueryLog.countDocuments({ status: QueryLogStatus.NO_ANSWER }),
      QueryLog.aggregate<{ _id: null; avgResponseTimeMs: number; avgSimilarityScore: number }>([
        {
          $group: {
            _id: null,
            avgResponseTimeMs: { $avg: '$responseTimeMs' },
            avgSimilarityScore: { $avg: '$averageSimilarityScore' },
          },
        },
      ]),

      Feedback.countDocuments(),
      Feedback.countDocuments({ rating: FeedbackRating.HELPFUL }),
      Feedback.countDocuments({ rating: FeedbackRating.NOT_HELPFUL }),

      QueryLog.aggregate<{ originalQuery: string; count: number; lastAskedAt?: Date }>([
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$query' } } },
            originalQuery: { $first: '$query' },
            count: { $sum: 1 },
            lastAskedAt: { $max: '$createdAt' },
          },
        },
        { $sort: { count: -1, lastAskedAt: -1 } },
        { $limit: 10 },
      ]),

      Message.aggregate<{ _id: Types.ObjectId; documentName: string; count: number }>([
        {
          $match: {
            sender: MessageSender.ASSISTANT,
            'sources.0': { $exists: true },
          },
        },
        { $unwind: '$sources' },
        {
          $group: {
            _id: '$sources.documentId',
            documentName: { $first: '$sources.documentName' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const usersByRole: Record<string, number> = {
      [UserRole.ADMIN]: 0,
      [UserRole.EMPLOYEE]: 0,
    };
    usersByRoleRaw.forEach((item) => {
      if (item._id) {
        usersByRole[item._id] = item.count;
      }
    });

    const usersByDepartment: Record<string, number> = {};
    usersByDeptRaw.forEach((item) => {
      if (item._id) {
        usersByDepartment[item._id] = item.count;
      }
    });

    const docsByStatus: Record<DocumentProcessingStatus, number> = {
      [DocumentProcessingStatus.PENDING]: 0,
      [DocumentProcessingStatus.PROCESSING]: 0,
      [DocumentProcessingStatus.PROCESSED]: 0,
      [DocumentProcessingStatus.FAILED]: 0,
    };
    docsByStatusRaw.forEach((item) => {
      if (item._id && item._id in docsByStatus) {
        docsByStatus[item._id as DocumentProcessingStatus] = item.count;
      }
    });

    const docsByType: Record<DocumentFileType, number> = {
      [DocumentFileType.PDF]: 0,
      [DocumentFileType.DOCX]: 0,
      [DocumentFileType.TXT]: 0,
    };
    docsByTypeRaw.forEach((item) => {
      if (item._id && item._id in docsByType) {
        docsByType[item._id as DocumentFileType] = item.count;
      }
    });

    const docsByDepartment: Record<string, number> = {};
    docsByDeptRaw.forEach((item) => {
      if (item._id) {
        docsByDepartment[item._id] = item.count;
      }
    });

    const queryStats = queryStatsRaw[0] || { avgResponseTimeMs: 0, avgSimilarityScore: 0 };
    const avgResponseTimeMs = Math.round(queryStats.avgResponseTimeMs || 0);
    const avgResponseTimeSec = Number((avgResponseTimeMs / 1000).toFixed(2));
    const avgSimilarityScore = Number((queryStats.avgSimilarityScore || 0).toFixed(3));

    const retrievalSuccessRate =
      totalQuestions > 0 ? Number(((successfulQueries / totalQuestions) * 100).toFixed(2)) : 0;
    const noAnswerRate =
      totalQuestions > 0 ? Number(((noAnswerQueries / totalQuestions) * 100).toFixed(2)) : 0;

    const positiveFeedbackRate =
      totalFeedback > 0 ? Number(((positiveFeedback / totalFeedback) * 100).toFixed(2)) : 0;

    let mostAskedQuestions: IMostAskedQuestion[] = mostAskedQuestionsRaw.map((item) => ({
      query: item.originalQuery,
      question: item.originalQuery,
      count: item.count,
      lastAskedAt: item.lastAskedAt,
    }));

    if (mostAskedQuestions.length === 0) {
      const fallbackQuestions = await Message.aggregate<{
        originalQuery: string;
        count: number;
        lastAskedAt?: Date;
      }>([
        { $match: { sender: MessageSender.USER } },
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$content' } } },
            originalQuery: { $first: '$content' },
            count: { $sum: 1 },
            lastAskedAt: { $max: '$createdAt' },
          },
        },
        { $sort: { count: -1, lastAskedAt: -1 } },
        { $limit: 10 },
      ]);

      mostAskedQuestions = fallbackQuestions.map((item) => ({
        query: item.originalQuery,
        question: item.originalQuery,
        count: item.count,
        lastAskedAt: item.lastAskedAt,
      }));
    }

    let mostUsedDocuments: IMostUsedDocument[] = mostUsedDocsFromMessages.map((item) => ({
      documentId: item._id ? item._id.toString() : '',
      documentName: item.documentName || 'Unknown Document',
      count: item.count,
      queryCount: item.count,
    }));

    if (mostUsedDocuments.length === 0) {
      const feedbackDocUsage = await Feedback.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { 'retrievedDocumentIds.0': { $exists: true } } },
        { $unwind: '$retrievedDocumentIds' },
        {
          $group: {
            _id: '$retrievedDocumentIds',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      if (feedbackDocUsage.length > 0) {
        const docIds = feedbackDocUsage.map((f) => f._id);
        const docs = await KnowledgeDocument.find({ _id: { $in: docIds } })
          .select('_id name department')
          .exec();
        const docMap = new Map<string, { name: string; department: string }>();
        docs.forEach((d) =>
          docMap.set(d._id.toString(), { name: d.name, department: d.department })
        );

        mostUsedDocuments = feedbackDocUsage.map((item) => {
          const docIdStr = item._id.toString();
          const docInfo = docMap.get(docIdStr);
          return {
            documentId: docIdStr,
            documentName: docInfo?.name || 'Document ' + docIdStr,
            count: item.count,
            queryCount: item.count,
            department: docInfo?.department,
          };
        });
      }
    }

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        byRole: usersByRole,
        byDepartment: usersByDepartment,
      },
      documents: {
        total: totalDocuments,
        byStatus: docsByStatus,
        byType: docsByType,
        byDepartment: docsByDepartment,
        totalChunks,
      },
      queries: {
        totalQuestions,
        questionsToday,
        successfulQueries,
        failedQueries,
        noAnswerQueries,
        averageResponseTimeMs: avgResponseTimeMs,
        averageResponseTimeSec: avgResponseTimeSec,
        averageSimilarityScore: avgSimilarityScore,
        retrievalSuccessRate,
        noAnswerRate,
      },
      feedback: {
        total: totalFeedback,
        positive: positiveFeedback,
        negative: negativeFeedback,
        positiveFeedbackRate,
      },
      mostAskedQuestions,
      mostUsedDocuments,

      // Flat top-level convenience fields for frontend stat cards & evaluation box
      totalUsers,
      activeUsers,
      totalDocuments,
      documentsProcessed: docsByStatus[DocumentProcessingStatus.PROCESSED] || 0,
      documentsProcessing: docsByStatus[DocumentProcessingStatus.PROCESSING] || 0,
      processingFailures: docsByStatus[DocumentProcessingStatus.FAILED] || 0,
      questionsToday,
      successfulRagQueries: successfulQueries,
      averageResponseTimeSec: avgResponseTimeSec,
      ragEvaluation: {
        retrievalSuccessRate: Number((retrievalSuccessRate / 100).toFixed(3)),
        positiveFeedbackRate: Number((positiveFeedbackRate / 100).toFixed(3)),
        averageResponseTimeMs: avgResponseTimeMs,
        noAnswerRate: Number((noAnswerRate / 100).toFixed(3)),
        averageRetrievalScore: avgSimilarityScore,
      },
    };
  }
}

export const adminService = new AdminService();
export default adminService;
