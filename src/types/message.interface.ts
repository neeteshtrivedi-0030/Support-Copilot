import { Document, Types } from 'mongoose';
import { MessageSender } from '../enum';

export interface IMessageSourceCitation {
  documentId: Types.ObjectId;
  chunkId?: Types.ObjectId;
  documentName: string;
  pageNumber?: number;
  section?: string;
  snippet: string;
  similarityScore?: number;
}

export interface IMessageTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  sender: MessageSender;
  content: string;
  sources?: IMessageSourceCitation[];
  tokens?: IMessageTokenUsage;
  responseTimeMs?: number;
  createdAt: Date;
}

export type IMessageModel = IMessage & Document;
