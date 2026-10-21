import { Document, Types } from 'mongoose';
import { Department, DocumentAccessLevel } from '../enum';

export interface IDocumentChunk {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  section?: string;
  tokenCount?: number;
  embeddingId?: string;
  department: Department;
  accessLevel: DocumentAccessLevel;
  documentName: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type IDocumentChunkModel = IDocumentChunk & Document;
