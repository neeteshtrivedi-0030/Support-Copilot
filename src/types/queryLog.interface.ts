import { Document, Types } from 'mongoose';
import { QueryLogStatus } from '../enum';

export interface IQueryLog {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  query: string;
  rewrittenQuery?: string;
  retrievedChunkCount: number;
  responseTimeMs: number;
  averageSimilarityScore?: number;
  status: QueryLogStatus;
  errorMessage?: string;
  departmentFilter?: string;
  createdAt: Date;
}

export type IQueryLogModel = IQueryLog & Document;
