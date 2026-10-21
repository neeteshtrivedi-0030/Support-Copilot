import { Schema, model, Model } from 'mongoose';
import { IMessageModel } from '../types/message.interface';
import { MessageSender } from '../enum';

const citationSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    chunkId: {
      type: Schema.Types.ObjectId,
      ref: 'DocumentChunk',
    },
    documentName: {
      type: String,
      required: true,
      trim: true,
    },
    pageNumber: {
      type: Number,
      min: 1,
    },
    section: {
      type: String,
      trim: true,
    },
    snippet: {
      type: String,
      required: true,
      trim: true,
    },
    similarityScore: {
      type: Number,
      min: 0,
      max: 1,
    },
  },
  { _id: false }
);

const tokenUsageSchema = new Schema(
  {
    promptTokens: { type: Number, min: 0 },
    completionTokens: { type: Number, min: 0 },
    totalTokens: { type: Number, min: 0 },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessageModel>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required for message'],
      index: true,
    },
    sender: {
      type: String,
      enum: {
        values: Object.values(MessageSender),
        message: 'Sender "{VALUE}" is invalid. Allowed: user, assistant, system',
      },
      required: [true, 'Message sender is required'],
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Message content cannot be empty'],
      trim: true,
    },
    sources: [citationSchema],
    tokens: tokenUsageSchema,
    responseTimeMs: {
      type: Number,
      min: [0, 'Response time cannot be negative'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
  }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message: Model<IMessageModel> = model<IMessageModel>('Message', messageSchema);
export default Message;
