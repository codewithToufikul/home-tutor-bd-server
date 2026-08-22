import { getIsRedisConnected, redisClient } from '../config/redis.js';

export const CACHE_TTL = {
  SEARCH_TUTORS: 300,       // 5 minutes
  SEARCH_JOBS: 300,         // 5 minutes
  HOMEPAGE: 600,            // 10 minutes
  DISTRICTS: 86400,         // 24 hours
  SUBJECTS: 86400,          // 24 hours
  PUBLIC_CONFIG: 86400,     // 24 hours
};

const getCache = async <T>(key: string): Promise<T | null> => {
  if (!getIsRedisConnected()) return null;
  try {
    const data = await redisClient.get(key);
    if (data) {
      return JSON.parse(data) as T;
    }
  } catch (err) {
    console.warn(`Redis getCache error for key ${key}:`, err);
  }
  return null;
};

const setCache = async <T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> => {
  if (!getIsRedisConnected()) return;
  try {
    await redisClient.set(key, JSON.stringify(value), {
      EX: ttlSeconds,
    });
  } catch (err) {
    console.warn(`Redis setCache error for key ${key}:`, err);
  }
};

const deleteCache = async (key: string): Promise<void> => {
  if (!getIsRedisConnected()) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.warn(`Redis deleteCache error for key ${key}:`, err);
  }
};

const invalidatePattern = async (pattern: string): Promise<void> => {
  if (!getIsRedisConnected()) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🧹 Redis cache invalidated ${keys.length} keys matching pattern: ${pattern}`);
    }
  } catch (err) {
    console.warn(`Redis invalidatePattern error for pattern ${pattern}:`, err);
  }
};

export const CacheService = {
  getCache,
  setCache,
  deleteCache,
  invalidatePattern,
};
