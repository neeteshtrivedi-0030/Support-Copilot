import { Document, Types } from 'mongoose';
import { UserRole, Department } from '../enum';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  department: Department;
  isActive: boolean;
  refreshToken?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IUserDocument = IUser & Document;

export interface IRegisterDto {
  name: string;
  email: string;
  password: string;
  department: Department;
  role?: UserRole;
}

export interface ILoginDto {
  email: string;
  password: string;
  deviceToken?: string;
}

export interface IUserQueryOptions {
  isActive?: boolean;
  selectPassword?: boolean;
  selectRefreshToken?: boolean;
}

export interface ISanitizedUser {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  department: Department;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthResponse {
  user: ISanitizedUser;
  tokens: IAuthTokens;
}
