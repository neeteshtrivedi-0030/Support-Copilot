import { Document, Types } from 'mongoose';
import { AuditAction, AuditResourceType } from '../enum';

export interface IAuditLog {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type IAuditLogModel = IAuditLog & Document;
