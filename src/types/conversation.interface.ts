import { Document, Types } from 'mongoose';

export interface IConversation {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  isArchived: boolean;
  lastMessageAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type IConversationModel = IConversation & Document;
