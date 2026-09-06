import { Worker, type Job } from 'bullmq';
import { redisConnectionOptions, isBullMQEnabled } from '../config/queue.js';
import { QUEUE_NAMES } from './email.queue.js';
import { sendOTPEmail, sendPasswordResetEmail } from '../services/email.service.js';

interface IEmailJobData {
  email: string;
  name?: string;
  otp?: string;
  message?: string;
}

if (!isBullMQEnabled || !redisConnectionOptions) {
  console.warn('⚠️ [Email Worker] Redis not configured — BullMQ email worker disabled.');
} else {
  const emailWorker = new Worker<IEmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<IEmailJobData>) => {
      console.log(`⚙️ [BullMQ Worker processing] Job "${job.name}" (ID: ${job.id}) for ${job.data.email}...`);

      switch (job.name) {
        case 'send-email-otp':
          if (job.data.otp) {
            await sendOTPEmail(job.data.email, job.data.otp, job.data.name);
          }
          break;

        case 'send-welcome-email':
          console.log(`🎉 [WELCOME EMAIL] Welcome email sent to ${job.data.name} (${job.data.email})`);
          break;

        case 'send-reset-password-email':
          if (job.data.otp) {
            await sendPasswordResetEmail(job.data.email, job.data.otp, job.data.name);
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
}
