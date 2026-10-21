import { Schema, model, Model } from 'mongoose';
import { IFeedbackModel } from '../types/feedback.interface';
import { FeedbackRating } from '../enum';

const feedbackSchema = new Schema<IFeedbackModel>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: [true, 'Message ID is required for feedback'],
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required for feedback'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID submitting feedback is required'],
      index: true,
    },
    rating: {
      type: String,
      enum: {
        values: Object.values(FeedbackRating),
        message: 'Rating must be either "helpful" or "not_helpful"',
      },
      required: [true, 'Feedback rating is required'],
      index: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Feedback comment cannot exceed 500 characters'],
    },
    retrievedDocumentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
  }
);

feedbackSchema.index({ messageId: 1, userId: 1 }, { unique: true });
feedbackSchema.index({ rating: 1, createdAt: -1 });

export const Feedback: Model<IFeedbackModel> = model<IFeedbackModel>('Feedback', feedbackSchema);
export default Feedback;
