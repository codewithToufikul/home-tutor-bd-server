import { createClient } from 'redis';

const socketPath = process.env.REDIS_SOCKET_PATH;
const redisUrl = process.env.REDIS_URL;

/**
 * Redis Client Configuration
 * - cPanel: Uses Native Unix Domain Socket (`REDIS_SOCKET_PATH=/home/hometuto/.cagefs/tmp/redis.sock`)
 * - Local / TCP: Uses `REDIS_URL` (e.g. `redis://localhost:6379`)
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
            if (retries > 3) return false;
            return Math.min(retries * 50, 500);
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
    console.log('🔴 Redis Client Connected Successfully');
  }
});

redisClient.on('error', (err) => {
  isRedisConnected = false;
  console.warn('⚠️ Redis Client Warning:', err.message || err);
});

export const connectRedis = async () => {
  if (!socketPath && !redisUrl) {
    console.warn('⚠️ Neither REDIS_SOCKET_PATH nor REDIS_URL is configured. Operating in database-only mode.');
    return;
  }

  try {
    await redisClient.connect();
  } catch (_err) {
    isRedisConnected = false;
    console.warn('⚠️ Could not connect to Redis. Operating in database-only fallback mode.');
  }
};

export const getIsRedisConnected = () => isRedisConnected;