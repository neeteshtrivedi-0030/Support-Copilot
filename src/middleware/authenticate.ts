import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { authService } from '../auth/authService';
import '../types';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawAccessToken = req.headers['x-access-token'];
    const token = typeof rawAccessToken === 'string' ? rawAccessToken.trim() : '';

    if (!token) {
      res.unauthorized(null, req.__('ACCESS_TOKEN_REQUIRED'));
      return;
    }

    let decoded: { userId: string };
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'TokenExpiredError') {
        res.unauthorized(null, req.__('ACCESS_TOKEN_EXPIRED'));
        return;
      }
      res.unauthorized(null, req.__('UNAUTHORIZED'));
      return;
    }

    const user = await authService.findUserById(decoded.userId);
    if (!user) {
      res.unauthorized(null, req.__('USER_NOT_FOUND'));
      return;
    }

    if (!user.isActive) {
      res.warn(null, req.__('ACCOUNT_INACTIVE'));
      return;
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    res.serverError(null, req.__('GENERAL_ERROR'), error);
  }
};

export default authenticate;
