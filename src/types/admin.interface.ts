import { UserRole, Department, DocumentProcessingStatus, DocumentFileType } from '../enum';
import { ISanitizedUser } from './user.interface';

export interface IUserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  department?: Department;
  isActive?: boolean;
}

export interface IUserListResult {
  users: ISanitizedUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IAdminUserAnalytics {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
  byDepartment: Record<string, number>;
}

export interface IAdminDocumentAnalytics {
  total: number;
  byStatus: Record<DocumentProcessingStatus, number>;
  byType: Record<DocumentFileType, number>;
  byDepartment: Record<string, number>;
  totalChunks: number;
}

export interface IAdminQueryAnalytics {
  totalQuestions: number;
  questionsToday: number;
  successfulQueries: number;
  failedQueries: number;
  noAnswerQueries: number;
  averageResponseTimeMs: number;
  averageResponseTimeSec: number;
  averageSimilarityScore: number;
  retrievalSuccessRate: number;
  noAnswerRate: number;
}

export interface IAdminFeedbackAnalytics {
  total: number;
  positive: number;
  negative: number;
  positiveFeedbackRate: number;
}

export interface IMostAskedQuestion {
  query: string;
  question?: string;
  count: number;
  lastAskedAt?: Date;
}

export interface IMostUsedDocument {
  documentId: string;
  documentName: string;
  count: number;
  queryCount?: number;
  department?: string;
}

export interface IAdminAnalytics {
  users: IAdminUserAnalytics;
  documents: IAdminDocumentAnalytics;
  queries: IAdminQueryAnalytics;
  feedback: IAdminFeedbackAnalytics;
  mostAskedQuestions: IMostAskedQuestion[];
  mostUsedDocuments: IMostUsedDocument[];

  // Flat top-level convenience fields for frontend stat cards & evaluation box
  totalUsers?: number;
  activeUsers?: number;
  totalDocuments?: number;
  documentsProcessed?: number;
  documentsProcessing?: number;
  processingFailures?: number;
  questionsToday?: number;
  successfulRagQueries?: number;
  averageResponseTimeSec?: number;
  ragEvaluation?: {
    retrievalSuccessRate: number;
    positiveFeedbackRate: number;
    averageResponseTimeMs: number;
    noAnswerRate: number;
    averageRetrievalScore: number;
  };
}
