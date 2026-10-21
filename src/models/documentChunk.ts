import { Schema, model, Model } from 'mongoose';
import { IDocumentChunkModel } from '../types/chunk.interface';
import { Department, DocumentAccessLevel } from '../enum';

const documentChunkSchema = new Schema<IDocumentChunkModel>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Associated document ID is required'],
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: [true, 'Chunk index sequence number is required'],
      min: [0, 'Chunk index cannot be negative'],
    },
    content: {
      type: String,
      required: [true, 'Chunk text content is required'],
      trim: true,
      minlength: [5, 'Chunk content must be at least 5 characters long'],
    },
    pageNumber: {
      type: Number,
      min: [1, 'Page number must be 1 or higher'],
    },
    section: {
      type: String,
      trim: true,
      maxlength: [200, 'Section title cannot exceed 200 characters'],
    },
    tokenCount: {
      type: Number,
      min: [1, 'Token count must be positive'],
    },
    embeddingId: {
      type: String,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      enum: {
        values: Object.values(Department),
        message: 'Department "{VALUE}" is invalid',
      },
      required: [true, 'Department is required for chunk-level RAG security filtering'],
      index: true,
    },
    accessLevel: {
      type: String,
      enum: {
        values: Object.values(DocumentAccessLevel),
        message: 'Access level "{VALUE}" is invalid',
      },
      default: DocumentAccessLevel.DEPARTMENT_ONLY,
      index: true,
    },
    documentName: {
      type: String,
      required: [true, 'Document name is required for citation generation'],
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
  }
);

documentChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
documentChunkSchema.index({ department: 1, accessLevel: 1 });
documentChunkSchema.index({ content: 'text', section: 'text', documentName: 'text' });

export const DocumentChunk: Model<IDocumentChunkModel> = model<IDocumentChunkModel>(
  'DocumentChunk',
  documentChunkSchema
);
export default DocumentChunk;
