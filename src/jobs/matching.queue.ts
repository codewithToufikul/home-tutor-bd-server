import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/queue.js';
import { QUEUE_NAMES as BASE_QUEUE_NAMES } from './email.queue.js';

export const QUEUE_NAMES = {
  ...BASE_QUEUE_NAMES,
  MATCHING: 'tuition-matching-queue',
} as const;

/**
 * Tuition Auto Matching Queue
 * Job post হলে বা Admin Approve করলে এখানে job পাঠানো হয়।
 * Worker সব Tutor-এর Score calculate করে Top 5 shortlist করবে।
 */
export const matchingQueue = new Queue(QUEUE_NAMES.MATCHING, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000, // Retry: 3s, 6s, 12s
    },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});

export interface IMatchingJobData {
  jobId: string;
  triggeredBy: 'job_created' | 'job_approved' | 'manual_rematch';
}

/**
 * Matching Queue-এ একটি job পাঠায়।
 * Non-blocking — API response-এর জন্য অপেক্ষা করে না।
 */
export const addMatchingJob = async (data: IMatchingJobData): Promise<void> => {
  try {
    const job = await matchingQueue.add('run-auto-matching', data, {
      // একই jobId-এর জন্য duplicate job পাঠালে replace করবে
      jobId: `match:${data.jobId}`,
    });
    console.log(`🤖 [Matching Queue] Job added for TuitionJob ${data.jobId} (Queue ID: ${job.id})`);
  } catch (err) {
    console.warn(`⚠️ [Matching Queue] Failed to add matching job for ${data.jobId}:`, err instanceof Error ? err.message : err);
  }
};
