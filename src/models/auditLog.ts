import { Schema, model, Model } from 'mongoose';
import { IAuditLogModel } from '../types/auditLog.interface';
import { AuditAction, AuditResourceType } from '../enum';

const auditLogSchema = new Schema<IAuditLogModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor user ID is required for audit trail'],
      index: true,
    },
    action: {
      type: String,
      enum: {
        values: Object.values(AuditAction),
        message: 'Audit action "{VALUE}" is invalid',
      },
      required: [true, 'Audit action type is required'],
      index: true,
    },
    resourceType: {
      type: String,
      enum: {
        values: Object.values(AuditResourceType),
        message: 'Resource type "{VALUE}" is invalid',
      },
      required: [true, 'Resource type is required'],
      index: true,
    },
    resourceId: {
      type: String,
      trim: true,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
  }
);

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

export const AuditLog: Model<IAuditLogModel> = model<IAuditLogModel>('AuditLog', auditLogSchema);
export default AuditLog;
