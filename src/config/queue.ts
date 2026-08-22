import type { ConnectionOptions } from 'bullmq';

const redisUrlString = process.env.REDIS_URL || 'redis://localhost:6379';

const parseRedisUrl = (urlStr: string): ConnectionOptions => {
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
};

export const redisConnectionOptions: ConnectionOptions = parseRedisUrl(redisUrlString);
