import { Document, Types } from 'mongoose';
import {
  Department,
  DocumentFileType,
  DocumentProcessingStatus,
  DocumentAccessLevel,
} from '../enum';

export interface IDocumentMetadata {
  originalFileName: string;
  mimeType: string;
  encoding?: string;
  author?: string;
  keywords?: string[];
  pageCount?: number;
  wordCount?: number;
  [key: string]: unknown;
}

export interface IDocument {
  _id: Types.ObjectId;
  name: string;
  type: DocumentFileType;
  department: Department;
  accessLevel: DocumentAccessLevel;
  status: DocumentProcessingStatus;
  fileHash: string;
  fileSize: number;
  filePath: string;
  chunkCount: number;
  uploadedBy: Types.ObjectId;
  errorReason?: string;
  metadata?: IDocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export type IDocumentModel = IDocument & Document;

export interface IDocumentUploadInput {
  file: Express.Multer.File;
  name?: string;
  department: Department;
  accessLevel?: DocumentAccessLevel;
  userId: string;
}

export interface IDocumentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  department?: Department;
  status?: DocumentProcessingStatus;
  type?: DocumentFileType;
  accessLevel?: DocumentAccessLevel;
}

export interface IDocumentListResult {
  documents: Array<IDocumentModel & { fileUrl: string }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
