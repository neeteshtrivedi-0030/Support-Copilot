import Redis from 'ioredis';
import { env } from './env';

let redisClient: Redis | null = null;

export const initRedis = (): Redis | null => {
  if (!env.REDIS_ENABLED) {
    console.log('[Redis] Redis is disabled in configuration. Skipping connection.');
    return null;
  }

  if (redisClient) {
    return redisClient;
  }
  try {
    const redisUrl = env.REDIS_URL || 'redis://127.0.0.1:6379';
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) {
          console.warn('[Redis] Max reconnect attempts reached. Continuing without cache.');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected to Redis server successfully.');
    });

    redisClient.on('error', (err) => {
      console.warn('[Redis] Redis connection warning/error:', err.message);
    });

    return redisClient;
  } catch (error) {
    console.warn('[Redis] Failed to initialize Redis client:', error);
    return null;
  }
};

export const getRedisClient = (): Redis | null => {
  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[Redis] Redis connection closed gracefully.');
    } catch (err) {
      console.error('[Redis] Error disconnecting Redis:', err);
    } finally {
      redisClient = null;
    }
  }
};
