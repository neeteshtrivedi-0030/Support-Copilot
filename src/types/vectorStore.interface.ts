import { Department, DocumentAccessLevel } from '../enum';

export interface IVectorChunkPayload {
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  section?: string;
  department: Department;
  accessLevel: DocumentAccessLevel;
  documentName: string;
}
