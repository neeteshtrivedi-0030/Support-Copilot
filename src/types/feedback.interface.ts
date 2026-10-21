import { Document, Types } from 'mongoose';
import { FeedbackRating } from '../enum';

export interface IFeedback {
  _id: Types.ObjectId;
  messageId: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  rating: FeedbackRating;
  comment?: string;
  retrievedDocumentIds?: Types.ObjectId[];
  createdAt: Date;
}

export type IFeedbackModel = IFeedback & Document;
