import { Queue } from 'bullmq';
import { redisConnectionOptions, isBullMQEnabled } from '../config/queue.js';
import { sendOTPEmail, sendPasswordResetEmail } from '../services/email.service.js';

export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  NOTIFICATION: 'notification-queue',
} as const;

export const emailQueue = isBullMQEnabled && redisConnectionOptions
  ? new Queue(QUEUE_NAMES.EMAIL, {
      connection: redisConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  : null;

export const addEmailJob = async (
  name: 'send-email-otp' | 'send-welcome-email' | 'send-reset-password-email',
  data: {
    email: string;
    name?: string;
    otp?: string;
    message?: string;
  },
) => {
  // ✅ Redis/BullMQ available — queue-এ job দাও (async, non-blocking)
  if (emailQueue) {
    try {
      const job = await emailQueue.add(name, data);
      console.log(`📥 [BullMQ] Email Job Added: "${name}" for ${data.email} (Job ID: ${job.id})`);
      return job;
    } catch (err) {
      console.warn(`⚠️ [BullMQ] Failed to queue "${name}", falling back to direct send:`, err instanceof Error ? err.message : err);
      // BullMQ ব্যর্থ হলেও fallback-এ যাবে (নিচে)
    }
  } else {
    console.warn(`⚠️ [BullMQ] Redis not configured — direct send fallback for "${name}".`);
  }

  // 🔁 Fallback: Redis/BullMQ ছাড়াই সরাসরি email পাঠাও
  try {
    if (name === 'send-email-otp') {
      if (data.otp) {
        await sendOTPEmail(data.email, data.otp, data.name);
        console.log(`✅ [Direct Email] Registration OTP email sent directly to ${data.email}`);
      }
    } else if (name === 'send-reset-password-email') {
      if (data.otp) {
        await sendPasswordResetEmail(data.email, data.otp, data.name);
        console.log(`✅ [Direct Email] Password reset OTP email sent directly to ${data.email}`);
      }
    } else if (name === 'send-welcome-email') {
      // Welcome email: Redis ছাড়া কাজ করে না এমন কিছু নেই, log করা যথেষ্ট
      console.log(`📧 [Direct Email] Welcome email skipped for ${data.email} (BullMQ unavailable)`);
    }
  } catch (err) {
    console.error(`❌ [Direct Email] Failed to send "${name}" to ${data.email}:`, err instanceof Error ? err.message : err);
  }
};

