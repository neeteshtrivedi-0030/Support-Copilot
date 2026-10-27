import { Schema, model, Model } from 'mongoose';
import { IDocumentModel } from '../types';
import {
  Department,
  DocumentFileType,
  DocumentProcessingStatus,
  DocumentAccessLevel,
} from '../enum';

const documentMetadataSchema = new Schema(
  {
    originalFileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    encoding: { type: String },
    author: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],
    pageCount: { type: Number, min: 0 },
    wordCount: { type: Number, min: 0 },
  },
  { _id: false }
);

const documentSchema = new Schema<IDocumentModel>(
  {
    name: {
      type: String,
      required: [true, 'Document name/title is required'],
      trim: true,
      minlength: [2, 'Document name must be at least 2 characters long'],
      maxlength: [255, 'Document name cannot exceed 255 characters'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: Object.values(DocumentFileType),
        message: 'File format "{VALUE}" is not supported. Allowed formats: pdf, docx, txt',
      },
      required: [true, 'Document format type is required'],
      lowercase: true,
      index: true,
    },
    department: {
      type: String,
      enum: {
        values: Object.values(Department),
        message: 'Department "{VALUE}" is invalid',
      },
      required: [true, 'Department is required for access control enforcement'],
      index: true,
    },
    accessLevel: {
      type: String,
      enum: {
        values: Object.values(DocumentAccessLevel),
        message: 'Access level "{VALUE}" is not supported',
      },
      default: DocumentAccessLevel.DEPARTMENT_ONLY,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(DocumentProcessingStatus),
        message: 'Processing status "{VALUE}" is invalid',
      },
      default: DocumentProcessingStatus.PENDING,
      index: true,
    },
    fileHash: {
      type: String,
      required: [true, 'SHA-256 document hash is required for deduplication'],
      unique: true,
      trim: true,
      index: true,
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [1, 'File size must be greater than 0 bytes'],
      max: [52428800, 'File size exceeds maximum limit of 50MB (52,428,800 bytes)'],
    },
    filePath: {
      type: String,
      required: [true, 'File storage path is required'],
      trim: true,
    },
    chunkCount: {
      type: Number,
      default: 0,
      min: [0, 'Chunk count cannot be negative'],
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploading user ID is required'],
      index: true,
    },
    errorReason: {
      type: String,
      trim: true,
    },
    metadata: {
      type: documentMetadataSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

documentSchema.index({ department: 1, accessLevel: 1 });
documentSchema.index({ status: 1, createdAt: -1 });
documentSchema.index({ uploadedBy: 1, createdAt: -1 });
documentSchema.index({ name: 'text', 'metadata.originalFileName': 'text' });

export const KnowledgeDocument: Model<IDocumentModel> = model<IDocumentModel>(
  'Document',
  documentSchema
);
export default KnowledgeDocument;
