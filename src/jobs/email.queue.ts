import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/queue.js';

export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  NOTIFICATION: 'notification-queue',
} as const;

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Retry after 2s, 4s, 8s if email server fails
    },
    removeOnComplete: 100, // Keep last 100 completed jobs for audit
    removeOnFail: 500,
  },
});

export const addEmailJob = async (
  name: 'send-email-otp' | 'send-welcome-email' | 'send-reset-password-email',
  data: {
    email: string;
    name?: string;
    otp?: string;
    message?: string;
  },
) => {
  try {
    const job = await emailQueue.add(name, data);
    console.log(`📥 [BullMQ] Email Job Added: "${name}" for ${data.email} (Job ID: ${job.id})`);
    return job;
  } catch (err) {
    console.warn(`⚠️ [BullMQ Warning] Failed to queue email job "${name}". Running fallback:`, err instanceof Error ? err.message : err);
  }
};
