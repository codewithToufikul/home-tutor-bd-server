import fs from 'node:fs';
import { createClient } from 'redis';

const rawSocketPath = process.env.REDIS_SOCKET_PATH;
// সকেট ফাইল যদি লোকাল ফাইলসিস্টেমে বিদ্যমান থাকে (cPanel-এ), তাহলে সকেট দিয়ে কানেক্ট হবে
const socketPath = rawSocketPath && fs.existsSync(rawSocketPath) ? rawSocketPath : undefined;
const redisUrl = process.env.REDIS_URL || (!socketPath ? 'redis://127.0.0.1:6379' : undefined);

/**
 * Redis Client Configuration
 * - cPanel: Uses Native Unix Domain Socket (`/home/hometuto/.cagefs/tmp/redis.sock`) when file exists.
 * - Local Machine (Mac): Automatically falls back to `REDIS_URL` (`redis://127.0.0.1:6379`).
 */
export const redisClient = createClient(
  socketPath
    ? {
        socket: {
          path: socketPath,
          reconnectStrategy: (retries: number): number | false => {
            if (retries > 5) return false;
            return Math.min(retries * 50, 500);
          },
        },
      }
    : {
        ...(redisUrl ? { url: redisUrl } : {}),
        socket: {
          reconnectStrategy: (retries: number): number | false => {
            // লোকাল মেশিনে রেডিস না থাকলে ৩ বারের পর থেমে যাবে, ক্র্যাশ করবে না
            if (retries > 2) return false;
            return Math.min(retries * 50, 300);
          },
        },
      },
);

let isRedisConnected = false;

redisClient.on('connect', () => {
  isRedisConnected = true;
  if (socketPath) {
    console.log(`🔴 Redis Connected Successfully via Unix Socket (${socketPath})`);
  } else {
    console.log(`🔴 Redis Client Connected Successfully (${redisUrl || 'localhost:6379'})`);
  }
});

redisClient.on('error', (err) => {
  isRedisConnected = false;
  // Non-fatal warning so server keeps running even if local Redis is offline
  console.warn('⚠️ Redis Client Warning:', err.message || err);
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (_err) {
    isRedisConnected = false;
    console.warn('⚠️ Could not connect to Redis server. Operating in database-only fallback mode.');
  }
};

export const getIsRedisConnected = () => isRedisConnected;