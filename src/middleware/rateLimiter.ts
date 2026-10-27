import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';

const memoryStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Task 15: Redis Rate Limiting Scenario
 * Enforces 30 AI requests/minute per authenticated user (or IP fallback).
 */
export const aiRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const userId = req.user?._id?.toString() || req.ip || 'anonymous';
  const limit = 30; // 30 AI requests per minute per user
  const windowSec = 60;

  const redis = getRedisClient();
  if (redis) {
    try {
      const key = `ratelimit:ai:${userId}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSec);
      }
      if (current > limit) {
        return res.status(429).json({
          status: 'error',
          code: 429,
          message: 'Rate limit exceeded: Maximum 30 AI requests per minute.',
        });
      }
      return next();
    } catch (redisErr) {
      console.warn('[RateLimiter] Redis rate limiting error, falling back to memory:', redisErr);
    }
  }

  // In-memory fallback if Redis is temporarily offline
  const now = Date.now();
  const userRate = memoryStore.get(userId);
  if (!userRate || now > userRate.resetTime) {
    memoryStore.set(userId, { count: 1, resetTime: now + windowSec * 1000 });
    return next();
  }

  userRate.count += 1;
  if (userRate.count > limit) {
    return res.status(429).json({
      status: 'error',
      code: 429,
      message: 'Rate limit exceeded: Maximum 30 AI requests per minute.',
    });
  }

  return next();
};
