import { Schema, model, Model } from 'mongoose';
import { IConversationModel } from '../types';

const conversationSchema = new Schema<IConversationModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner user ID is required for conversation'],
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: 'New Conversation',
      maxlength: [150, 'Conversation title cannot exceed 150 characters'],
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

conversationSchema.index({ userId: 1, updatedAt: -1 });
conversationSchema.index({ userId: 1, isArchived: 1 });

export const Conversation: Model<IConversationModel> = model<IConversationModel>(
  'Conversation',
  conversationSchema
);
export default Conversation;
