import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions, isBullMQEnabled } from '../config/queue.js';

export const PAYMENT_QUEUE_NAME = 'payment-queue';

interface IPaymentJobData {
  transactionId: string;
  userId: string;
  amount: number;
}

if (!isBullMQEnabled || !redisConnectionOptions) {
  console.warn('⚠️ [Payment Worker] Redis not configured — BullMQ payment worker disabled.');
} else {
  const paymentWorker = new Worker<IPaymentJobData>(
    PAYMENT_QUEUE_NAME,
    async (job: Job<IPaymentJobData>) => {
      console.log(`⚙️ [BullMQ Worker processing] Payment Verification Job "${job.name}" for Txn ${job.data.transactionId}...`);
      // Async payment gateway verification / payout processing
    },
    {
      connection: redisConnectionOptions,
      concurrency: 3,
    },
  );

  paymentWorker.on('completed', (job) => {
    console.log(`✅ [BullMQ Worker] Payment Job "${job.name}" (ID: ${job.id}) completed.`);
  });
}
