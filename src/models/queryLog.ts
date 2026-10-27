import { Schema, model, Model } from 'mongoose';
import { IQueryLogModel } from '../types';
import { QueryLogStatus } from '../enum';

const queryLogSchema = new Schema<IQueryLogModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for query logging'],
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true,
    },
    query: {
      type: String,
      required: [true, 'Query text is required'],
      trim: true,
    },
    rewrittenQuery: {
      type: String,
      trim: true,
    },
    retrievedChunkCount: {
      type: Number,
      default: 0,
      min: [0, 'Retrieved chunk count cannot be negative'],
    },
    responseTimeMs: {
      type: Number,
      required: [true, 'Query execution time is required'],
      min: [0, 'Response time cannot be negative'],
    },
    averageSimilarityScore: {
      type: Number,
      min: 0,
      max: 1,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(QueryLogStatus),
        message: 'Query status "{VALUE}" is invalid',
      },
      default: QueryLogStatus.SUCCESS,
      index: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    departmentFilter: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
  }
);

queryLogSchema.index({ createdAt: -1, status: 1 });
queryLogSchema.index({ userId: 1, createdAt: -1 });
queryLogSchema.index({ query: 'text' });

export const QueryLog: Model<IQueryLogModel> = model<IQueryLogModel>('QueryLog', queryLogSchema);
export default QueryLog;
