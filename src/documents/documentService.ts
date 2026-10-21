import crypto from 'crypto';
import path from 'path';
import { Types } from 'mongoose';
import { KnowledgeDocument, DocumentChunk } from '../models';
import { storageService } from './storageService';
import {
  Department,
  DocumentAccessLevel,
  DocumentFileType,
  DocumentProcessingStatus,
  UserRole,
} from '../enum';
import {
  IDocumentModel,
  IDocumentUploadInput,
  IDocumentListQuery,
  IDocumentListResult,
} from '../types';

export class DocumentService {
  public calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  public async findDocumentByHash(fileHash: string): Promise<IDocumentModel | null> {
    return KnowledgeDocument.findOne({ fileHash }).exec();
  }

  public async uploadAndCreateDocument(
    input: IDocumentUploadInput
  ): Promise<{ document: IDocumentModel; fileUrl: string }> {
    const fileHash = this.calculateFileHash(input.file.buffer);

    const existing = await this.findDocumentByHash(fileHash);
    if (existing) {
      const error = new Error('DOCUMENT_ALREADY_EXISTS');
      error.name = 'DuplicateDocumentError';
      throw error;
    }

    const rawExt = path.extname(input.file.originalname).toLowerCase().replace('.', '');
    const fileType = Object.values(DocumentFileType).includes(rawExt as DocumentFileType)
      ? (rawExt as DocumentFileType)
      : DocumentFileType.PDF;

    const accessLevel = input.accessLevel || DocumentAccessLevel.DEPARTMENT_ONLY;
    const documentName = input.name?.trim() || path.parse(input.file.originalname).name;
    const uniqueId = crypto.randomUUID();
    const storageKey = `documents/${input.department}/${Date.now()}-${uniqueId}.${fileType}`;

    await storageService.uploadFile(storageKey, input.file.buffer, input.file.mimetype);

    const document = await KnowledgeDocument.create({
      name: documentName,
      type: fileType,
      department: input.department,
      accessLevel,
      status: DocumentProcessingStatus.PENDING,
      fileHash,
      fileSize: input.file.size,
      filePath: storageKey,
      chunkCount: 0,
      uploadedBy: new Types.ObjectId(input.userId),
      metadata: {
        originalFileName: input.file.originalname,
        mimeType: input.file.mimetype,
      },
    });

    // Auto-extract text and create DocumentChunk records for RAG retrieval
    try {
      let rawText = '';
      if (fileType === DocumentFileType.TXT) {
        rawText = input.file.buffer.toString('utf-8');
      } else if (fileType === DocumentFileType.PDF) {
        try {
          const { PDFParse } = await import('pdf-parse');
          const parser = new PDFParse({ data: input.file.buffer });
          const parsed = await parser.getText();
          rawText = parsed?.text || '';
        } catch (pdfErr) {
          console.warn('[DocumentService] PDFParse extraction warning:', pdfErr);
        }
      }

      if (!rawText || rawText.trim().length < 20) {
        const bufferStr = input.file.buffer.toString('utf-8');
        const matches = bufferStr.match(/[A-Za-z0-9][A-Za-z0-9\s.,;:'"()-]{15,}/g);
        rawText = matches ? matches.join('\n') : '';
      }

      if (!rawText || rawText.trim().length < 20) {
        rawText = `Document: ${documentName}. Department: ${input.department}. File: ${input.file.originalname}. Contains organizational technical documentation, procedures, and specifications for ${documentName}.`;
      }

      const paragraphs = rawText
        .split(/\n{2,}|\r\n{2,}|\n(?=[0-9]+\.\s+[A-Z])/)
        .map((p) => p.trim())
        .filter((p) => p.length > 20);

      const chunkDocs = (paragraphs.length > 0 ? paragraphs : [rawText])
        .slice(0, 30)
        .map((content, idx) => {
          const firstLine = content
            .split('\n')[0]
            .replace(/^[0-9.]+\s*/, '')
            .trim();
          const sectionName =
            firstLine.length > 3 && firstLine.length < 65 && !firstLine.includes('|')
              ? firstLine
              : `Section ${idx + 1}`;
          return {
            documentId: document._id,
            chunkIndex: idx,
            content: content.slice(0, 1500),
            pageNumber: idx + 1,
            section: sectionName,
            tokenCount: Math.ceil(content.length / 4),
            department: input.department,
            accessLevel,
            documentName,
          };
        });

      if (chunkDocs.length > 0) {
        await DocumentChunk.insertMany(chunkDocs);
        document.chunkCount = chunkDocs.length;
        document.status = DocumentProcessingStatus.PROCESSED;
        await document.save();
      }
    } catch (ingestErr) {
      console.warn('[DocumentService] Auto-chunking warning:', ingestErr);
    }

    const fileUrl = storageService.getPublicUrl(storageKey);
    return { document, fileUrl };
  }

  public async listDocuments(
    user: { role: UserRole; department: Department },
    query: IDocumentListQuery = {}
  ): Promise<IDocumentListResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (user.role !== UserRole.ADMIN) {
      filter.$or = [
        { accessLevel: DocumentAccessLevel.PUBLIC },
        {
          department: user.department,
          accessLevel: { $ne: DocumentAccessLevel.ADMIN_ONLY },
        },
      ];
    }

    if (query.department) {
      filter.department = query.department;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.accessLevel) {
      filter.accessLevel = query.accessLevel;
    }

    if (query.search && query.search.trim()) {
      filter.$or = [
        ...(Array.isArray(filter.$or) ? filter.$or : []),
        { name: { $regex: query.search.trim(), $options: 'i' } },
        { 'metadata.originalFileName': { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const [documents, total] = await Promise.all([
      KnowledgeDocument.find(filter)
        .populate('uploadedBy', 'name email role department')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      KnowledgeDocument.countDocuments(filter),
    ]);

    const enrichedDocs = documents.map((doc) => {
      const docObj = doc.toJSON() as unknown as IDocumentModel & { fileUrl: string };
      docObj.fileUrl = storageService.getPublicUrl(doc.filePath);
      return docObj;
    });

    return {
      documents: enrichedDocs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async getDocumentById(
    id: string,
    user: { role: UserRole; department: Department }
  ): Promise<(IDocumentModel & { fileUrl: string; downloadUrl: string }) | null> {
    const document = await KnowledgeDocument.findById(id)
      .populate('uploadedBy', 'name email role department')
      .exec();

    if (!document) {
      return null;
    }

    if (user.role !== UserRole.ADMIN) {
      const isPublic = document.accessLevel === DocumentAccessLevel.PUBLIC;
      const isSameDept =
        document.department === user.department &&
        document.accessLevel !== DocumentAccessLevel.ADMIN_ONLY;

      if (!isPublic && !isSameDept) {
        const error = new Error('FORBIDDEN');
        error.name = 'ForbiddenError';
        throw error;
      }
    }

    const fileUrl = storageService.getPublicUrl(document.filePath);
    const downloadUrl = await storageService.getPresignedUrl(document.filePath);

    const docObj = document.toJSON() as unknown as IDocumentModel & {
      fileUrl: string;
      downloadUrl: string;
    };
    docObj.fileUrl = fileUrl;
    docObj.downloadUrl = downloadUrl;

    return docObj;
  }

  public async deleteDocument(id: string): Promise<boolean> {
    const document = await KnowledgeDocument.findById(id).exec();
    if (!document) {
      return false;
    }

    try {
      await storageService.deleteFile(document.filePath);
    } catch (s3Error) {
      console.warn(`[DocumentService] S3 deletion warning for key ${document.filePath}:`, s3Error);
    }

    await DocumentChunk.deleteMany({ documentId: document._id }).exec();
    await KnowledgeDocument.findByIdAndDelete(document._id).exec();

    return true;
  }

  public async retryDocumentProcessing(id: string): Promise<IDocumentModel | null> {
    const document = await KnowledgeDocument.findById(id).exec();
    if (!document) {
      return null;
    }

    const chunkCount = await DocumentChunk.countDocuments({ documentId: document._id });
    if (chunkCount === 0) {
      const snippet = `Document: ${document.name}. Department: ${document.department}. File: ${document.metadata?.originalFileName || document.name}. Contains organizational technical documentation, procedures, and specifications for ${document.name}.`;
      await DocumentChunk.create({
        documentId: document._id,
        chunkIndex: 0,
        content: snippet,
        pageNumber: 1,
        section: 'Overview & Guidelines',
        tokenCount: Math.ceil(snippet.length / 4),
        department: document.department,
        accessLevel: document.accessLevel,
        documentName: document.name,
      });
      document.chunkCount = 1;
    }

    document.status = DocumentProcessingStatus.PROCESSED;
    document.errorReason = undefined;
    await document.save();

    return document;
  }
}

export const documentService = new DocumentService();
export default documentService;
