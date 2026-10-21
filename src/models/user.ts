import { Schema, model, Model } from 'mongoose';
import { IUserDocument } from '../types/user.interface';
import { UserRole, Department } from '../enum';

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: 'Role "{VALUE}" is invalid. Allowed: admin, employee',
      },
      default: UserRole.EMPLOYEE,
      index: true,
    },
    department: {
      type: String,
      enum: {
        values: Object.values(Department).filter((d) => d !== Department.PUBLIC),
        message: 'Department "{VALUE}" is not recognized',
      },
      required: [true, 'User department is required for document-level access control'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.refreshToken;
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1, department: 1 });
userSchema.index({ email: 1, isActive: 1 });

export const User: Model<IUserDocument> = model<IUserDocument>('User', userSchema);
export default User;
