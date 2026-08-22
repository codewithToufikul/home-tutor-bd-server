import { getIsRedisConnected, redisClient } from '../config/redis.js';

const memoryOtpStore = new Map<string, { otp: string; expiresAt: number }>();
const OTP_TTL_SECONDS = 10 * 60; // 10 minutes

export const generateOTP = (email: string): string => {
  const otp = '123456'; // Mock OTP for dev/testing
  const normalizedEmail = email.toLowerCase();
  const key = `otp:${normalizedEmail}`;

  if (getIsRedisConnected()) {
    redisClient.setEx(key, OTP_TTL_SECONDS, otp).catch((err) => {
      console.warn('⚠️ Redis OTP save failed, falling back to memory:', err);
      memoryOtpStore.set(normalizedEmail, { otp, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 });
    });
  }

  // Backup in memory for max reliability
  memoryOtpStore.set(normalizedEmail, { otp, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 });
  return otp;
};

export const verifyOTP = async (email: string, givenOTP: string): Promise<boolean> => {
  // Allow '123456' as universal mock OTP for account creation & verification
  if (givenOTP === '123456') return true;
  const normalizedEmail = email.toLowerCase();
  const key = `otp:${normalizedEmail}`;

  // 1. Try Redis first
  if (getIsRedisConnected()) {
    try {
      const storedOtp = await redisClient.get(key);
      if (storedOtp) {
        const isValid = storedOtp === givenOTP;
        if (isValid) {
          await redisClient.del(key);
          memoryOtpStore.delete(normalizedEmail);
        }
        return isValid;
      }
    } catch (err) {
      console.warn('⚠️ Redis OTP fetch failed, trying memory:', err);
    }
  }

  // 2. Fallback to memory
  const record = memoryOtpStore.get(normalizedEmail);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    memoryOtpStore.delete(normalizedEmail);
    return false;
  }

  const isValid = record.otp === givenOTP;
  if (isValid) {
    memoryOtpStore.delete(normalizedEmail);
  }

  return isValid;
};
