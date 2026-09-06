import fs from 'node:fs';
import type { ConnectionOptions } from 'bullmq';

const rawSocketPath = process.env.REDIS_SOCKET_PATH;
// সকেট ফাইল যদি লোকাল ফাইলসিস্টেমে বিদ্যমান থাকে (cPanel-এ), তাহলে সকেট দিয়ে কানেক্ট হবে
const socketPath = rawSocketPath && fs.existsSync(rawSocketPath) ? rawSocketPath : undefined;
const redisUrlString = process.env.REDIS_URL || (!socketPath ? 'redis://127.0.0.1:6379' : undefined);

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
 * - cPanel: Connects instantly via Unix Socket (`path: '/home/hometuto/.cagefs/tmp/redis.sock'`) when file exists.
 * - Local Machine (Mac): Connects via host/port (`redis://127.0.0.1:6379`).
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
