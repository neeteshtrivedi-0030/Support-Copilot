import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models';
import { env } from '../config/env';
import {
  IUserDocument,
  IRegisterDto,
  ISanitizedUser,
  IAuthTokens,
  IUserQueryOptions,
} from '../types';
import { UserRole } from '../enum';

export class AuthService {
  public async findUserByEmail(
    email: string,
    options: IUserQueryOptions = {}
  ): Promise<IUserDocument | null> {
    const filter: Record<string, unknown> = {
      email: email.toLowerCase().trim(),
    };

    if (options.isActive !== undefined) {
      filter.isActive = options.isActive;
    }

    let query = User.findOne(filter);

    if (options.selectPassword) {
      query = query.select('+passwordHash');
    }

    if (options.selectRefreshToken) {
      query = query.select('+refreshToken');
    }

    return query.exec();
  }

  public async findUserById(
    id: string,
    options: IUserQueryOptions = {}
  ): Promise<IUserDocument | null> {
    const filter: Record<string, unknown> = {
      _id: id,
    };

    if (options.isActive !== undefined) {
      filter.isActive = options.isActive;
    }

    let query = User.findOne(filter);

    if (options.selectPassword) {
      query = query.select('+passwordHash');
    }

    if (options.selectRefreshToken) {
      query = query.select('+refreshToken');
    }

    return query.exec();
  }

  public async checkExistingUser(
    queryFilter: Record<string, unknown>,
    options: IUserQueryOptions = {}
  ): Promise<IUserDocument | null> {
    const filter: Record<string, unknown> = {
      ...queryFilter,
    };

    if (options.isActive !== undefined) {
      filter.isActive = options.isActive;
    }

    let query = User.findOne(filter);

    if (options.selectPassword) {
      query = query.select('+passwordHash');
    }

    return query.exec();
  }

  public async createUser(data: IRegisterDto): Promise<IUserDocument> {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    const user = await User.create({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash,
      role: data.role || UserRole.EMPLOYEE,
      department: data.department,
      isActive: true,
    });

    return user;
  }

  public async comparePassword(plainText: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainText, passwordHash);
  }

  public generateTokens(user: IUserDocument): IAuthTokens {
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      department: user.department,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign({ userId: user._id.toString() }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  public async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { refreshToken });
  }

  public async updateLastLogin(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { lastLoginAt: new Date() });
  }

  public sanitizeUser(user: IUserDocument): ISanitizedUser {
    return {
      id: user._id.toString(),
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
export default authService;
