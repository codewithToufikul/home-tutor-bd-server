import { getIsRedisConnected, redisClient } from '../config/redis.js';

const memoryOtpStore = new Map<string, { otp: string; expiresAt: number }>();
const OTP_TTL_SECONDS = 10 * 60; // 10 minutes

export const generateOTP = (email: string): string => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const normalizedEmail = email.trim().toLowerCase();
  const key = `otp:${normalizedEmail}`;

  // 1. Store in Redis (Unix Socket / TCP)
  if (getIsRedisConnected()) {
    redisClient.setEx(key, OTP_TTL_SECONDS, otp).catch((err) => {
      console.warn('⚠️ Redis OTP save failed, falling back to memory:', err);
      memoryOtpStore.set(normalizedEmail, { otp, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 });
    });
  }

  // 2. Guaranteed in-memory fallback
  memoryOtpStore.set(normalizedEmail, { otp, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 });
  return otp;
};

export const verifyOTP = async (email: string, givenOTP: string): Promise<boolean> => {
  if (!givenOTP || !email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const cleanGivenOTP = givenOTP.trim();
  const key = `otp:${normalizedEmail}`;

  // 1. Check Redis first
  if (getIsRedisConnected()) {
    try {
      const storedOtp = await redisClient.get(key);
      if (storedOtp) {
        const isValid = String(storedOtp).trim() === cleanGivenOTP;
        if (isValid) {
          await redisClient.del(key);
          memoryOtpStore.delete(normalizedEmail);
        }
        return isValid;
      }
    } catch (err) {
      console.warn('⚠️ Redis OTP fetch failed, checking memory:', err);
    }
  }

  // 2. Fallback to memory
  const record = memoryOtpStore.get(normalizedEmail);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    memoryOtpStore.delete(normalizedEmail);
    return false;
  }

  const isValid = record.otp === cleanGivenOTP;
  if (isValid) {
    memoryOtpStore.delete(normalizedEmail);
  }

  return isValid;
};
