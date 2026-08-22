import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        // Stop reconnecting after 3 attempts in local dev if Redis server is not running
        return false;
      }
      return Math.min(retries * 50, 500);
    },
  },
});

let isRedisConnected = false;

redisClient.on('connect', () => {
  isRedisConnected = true;
  console.log('🔴 Redis Client Connected Successfully');
});

redisClient.on('error', (err) => {
  isRedisConnected = false;
  console.warn('⚠️ Redis Client Warning:', err.message || err);
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (_err) {
    console.warn('⚠️ Could not connect to Redis server. Operating in database-only mode (bypassing cache).');
  }
};

export const getIsRedisConnected = () => isRedisConnected;
