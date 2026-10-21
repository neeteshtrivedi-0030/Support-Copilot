import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { BaseController } from '../controllers/baseController';
import { authService } from './authService';
import { env } from '../config/env';

export class AuthController extends BaseController {
  public register = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { name, email, password, department, role } = req.body;

      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        if (!existingUser.isActive) {
          return res.warn(null, req.__('ACCOUNT_INACTIVE'));
        }
        return res.warn(null, req.__('EMAIL_EXISTS'));
      }

      const user = await authService.createUser({
        name,
        email,
        password,
        department,
        role,
      });

      const tokens = authService.generateTokens(user);
      await authService.saveRefreshToken(user._id.toString(), tokens.refreshToken);

      return res.success(
        {
          user: authService.sanitizeUser(user),
          tokens,
        },
        req.__('REGISTER_SUCCESS')
      );
    } catch (error) {
      return res.serverError(null, req.__('REGISTER_FAILED'), error);
    }
  };

  public login = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email, password } = req.body;

      const user = await authService.findUserByEmail(email, {
        selectPassword: true,
      });

      if (!user) {
        return res.warn(null, req.__('INVALID_CREDENTIALS'));
      }

      if (!user.isActive) {
        return res.warn(null, req.__('ACCOUNT_INACTIVE'));
      }

      const isPasswordValid = await authService.comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.warn(null, req.__('INVALID_CREDENTIALS'));
      }

      const tokens = authService.generateTokens(user);
      await authService.saveRefreshToken(user._id.toString(), tokens.refreshToken);
      await authService.updateLastLogin(user._id.toString());

      return res.success(
        {
          user: authService.sanitizeUser(user),
          tokens,
        },
        req.__('LOGIN_SUCCESS')
      );
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public logout = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user?._id.toString() || req.userId;

      if (userId) {
        await authService.saveRefreshToken(userId, '');
      }

      return res.success(null, req.__('LOGOUT_SUCCESS'));
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };

  public refreshToken = async (req: Request, res: Response): Promise<Response> => {
    try {
      const rawRefreshToken =
        req.headers['x-refresh-token'] || req.headers['refreshtoken'] || req.body?.refreshToken;
      const refreshToken = typeof rawRefreshToken === 'string' ? rawRefreshToken.trim() : '';

      if (!refreshToken) {
        return res.unauthorized(null, req.__('REFRESH_TOKEN_REQUIRED'));
      }

      let decoded: { userId: string };
      try {
        decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
      } catch (err: unknown) {
        const error = err as Error;
        if (error.name === 'TokenExpiredError') {
          return res.unauthorized(null, req.__('REFRESH_TOKEN_EXPIRED'));
        }
        return res.unauthorized(null, req.__('INVALID_REFRESH_TOKEN'));
      }

      const user = await authService.findUserById(decoded.userId, {
        selectRefreshToken: true,
      });

      if (!user) {
        return res.unauthorized(null, req.__('USER_NOT_FOUND'));
      }

      if (!user.isActive) {
        return res.warn(null, req.__('ACCOUNT_INACTIVE'));
      }

      if (user.refreshToken !== refreshToken) {
        return res.unauthorized(null, req.__('REFRESH_TOKEN_EXPIRED'));
      }

      const tokens = authService.generateTokens(user);
      await authService.saveRefreshToken(user._id.toString(), tokens.refreshToken);

      return res.success(
        {
          tokens,
        },
        req.__('REFRESH_SUCCESS')
      );
    } catch (error) {
      return res.serverError(null, req.__('GENERAL_ERROR'), error);
    }
  };
}

export const authController = new AuthController();
export default authController;
