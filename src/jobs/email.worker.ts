import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions } from '../config/queue.js';
import { QUEUE_NAMES } from './email.queue.js';
import { sendOTPEmail } from '../services/email.service.js';

interface IEmailJobData {
  email: string;
  name?: string;
  otp?: string;
  message?: string;
}

export const emailWorker = new Worker<IEmailJobData>(
  QUEUE_NAMES.EMAIL,
  async (job: Job<IEmailJobData>) => {
    console.log(`⚙️ [BullMQ Worker processing] Job "${job.name}" (ID: ${job.id}) for ${job.data.email}...`);

    switch (job.name) {
      case 'send-email-otp':
        if (job.data.otp) {
          await sendOTPEmail(job.data.email, job.data.otp);
        }
        break;

      case 'send-welcome-email':
        console.log(`🎉 [WELCOME EMAIL] Welcome email sent to ${job.data.name} (${job.data.email})`);
        break;

      case 'send-reset-password-email':
        if (job.data.otp) {
          await sendOTPEmail(job.data.email, job.data.otp);
        }
        break;

      default:
        console.warn(`⚠️ Unknown email job type: ${job.name}`);
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: 5,
  },
);

emailWorker.on('completed', (job) => {
  console.log(`✅ [BullMQ Worker] Email Job "${job.name}" (ID: ${job.id}) completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`❌ [BullMQ Worker Error] Email Job "${job?.name}" (ID: ${job?.id}) failed:`, err.message);
});
