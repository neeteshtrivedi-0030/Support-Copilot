import { Department, DocumentAccessLevel, DocumentFileType } from '../enum';

export interface IDocumentSeedChunk {
  section: string;
  pageNumber: number;
  content: string;
}

export interface IDocumentSeed {
  name: string;
  type: DocumentFileType;
  department: Department;
  accessLevel: DocumentAccessLevel;
  filePath: string;
  chunks: IDocumentSeedChunk[];
}

export type DocumentSeed = IDocumentSeed;
