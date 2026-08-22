import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions } from '../config/queue.js';
import { QUEUE_NAMES } from './email.queue.js';

interface INotificationJobData {
  userId: string;
  title: string;
  message: string;
  type: string;
}

export const notificationWorker = new Worker<INotificationJobData>(
  QUEUE_NAMES.NOTIFICATION,
  async (job: Job<INotificationJobData>) => {
    console.log(`⚙️ [BullMQ Worker processing] Notification Job "${job.name}" for User ${job.data.userId}...`);
    // Background heavy push notification processing
  },
  {
    connection: redisConnectionOptions,
    concurrency: 10,
  },
);

notificationWorker.on('completed', (job) => {
  console.log(`✅ [BullMQ Worker] Notification Job "${job.name}" (ID: ${job.id}) completed.`);
});
