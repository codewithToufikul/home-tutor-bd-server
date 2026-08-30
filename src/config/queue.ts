import type { ConnectionOptions } from 'bullmq';

const socketPath = process.env.REDIS_SOCKET_PATH;
const redisUrlString = process.env.REDIS_URL;

/**
 * REDIS_SOCKET_PATH অথবা REDIS_URL সেট থাকলে BullMQ সক্রিয় থাকবে।
 */
export const isBullMQEnabled = Boolean(socketPath || redisUrlString);

const parseRedisUrl = (urlStr: string): ConnectionOptions => {
  try {
    const parsed = new URL(urlStr);
    const isTls = parsed.protocol === 'rediss:' || urlStr.startsWith('rediss://');
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port || (isTls ? '6380' : '6379'), 10),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      maxRetriesPerRequest: null,
      enableAutoPipelining: true,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableAutoPipelining: true,
    };
  }
};

/**
 * BullMQ Connection Options (ioredis under the hood)
 * - cPanel: Connects instantly via Unix Socket (`path: '/home/hometuto/.cagefs/tmp/redis.sock'`)
 * - Local / TCP: Connects via host/port
 */
export const redisConnectionOptions: ConnectionOptions | null = socketPath
  ? {
      path: socketPath,
      maxRetriesPerRequest: null,
      enableAutoPipelining: true,
    }
  : redisUrlString
  ? parseRedisUrl(redisUrlString)
  : null;
