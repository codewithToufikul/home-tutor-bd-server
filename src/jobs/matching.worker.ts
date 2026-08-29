import { Worker, type Job } from 'bullmq';
import mongoose from 'mongoose';
import { redisConnectionOptions } from '../config/queue.js';
import { MatchingEngine } from '../services/matching.service.js';
import { NotificationService } from '../modules/notification/notification.service.js';
import { TuitionJob } from '../modules/tuition/tuition.model.js';
import { Tutor } from '../modules/tutor/tutor.model.js';
import { User } from '../modules/user/user.model.js';
import type { IMatchingJobData } from './matching.queue.js';
import { QUEUE_NAMES } from './matching.queue.js';
import type { IShortlistedTutor } from '../modules/tuition/tuition.interface.js';

/**
 * Auto Matching Worker
 * BullMQ background-এ চলে — API কে block করে না।
 * প্রতিটি TuitionJob-এর জন্য সব Tutor-এর Score calculate করে Top 5 shortlist করে।
 */
export const matchingWorker = new Worker<IMatchingJobData>(
  QUEUE_NAMES.MATCHING,
  async (job: Job<IMatchingJobData>) => {
    const { jobId, triggeredBy } = job.data;

    console.log(`🤖 [Matching Worker] Starting matching for TuitionJob ${jobId} (trigger: ${triggeredBy})`);

    // 1. Job লোড করো
    const tuitionJob = await TuitionJob.findById(jobId);
    if (!tuitionJob) {
      console.warn(`⚠️ [Matching Worker] TuitionJob ${jobId} not found. Skipping.`);
      return;
    }

    // শুধু Open এবং Approved job-এর জন্য matching চলবে
    if (tuitionJob.status !== 'Open' || tuitionJob.approvalStatus !== 'Approved') {
      console.log(`ℹ️ [Matching Worker] TuitionJob ${jobId} is not Open/Approved. Skipping.`);
      return;
    }

    // 2. সব Active Tutor লোড করো (blocked ইউজারদের বাদ দিয়ে)
    const blockedUserIds = await User.find({ status: 'blocked' }).distinct('_id');

    const tutors = await Tutor.find({
      userId: { $nin: blockedUserIds },
      // কমপক্ষে subjects বা location আছে এমন Tutor
      $or: [
        { subjects: { $exists: true, $not: { $size: 0 } } },
        { 'location.district': { $exists: true, $ne: '' } },
      ],
    }).lean();

    if (!tutors.length) {
      console.log(`ℹ️ [Matching Worker] No eligible tutors found for job ${jobId}.`);
      return;
    }

    console.log(`👥 [Matching Worker] Calculating scores for ${tutors.length} tutors...`);

    // 3. Matching Engine চালাও (Top 5 বাছাই)
    const topMatches = await MatchingEngine.run(tuitionJob.toObject(), tutors, 5);

    if (!topMatches.length) {
      console.log(`ℹ️ [Matching Worker] No qualified tutors found for job ${jobId} above minimum threshold.`);
      // Matching run time আপডেট করো তবুও
      await TuitionJob.findByIdAndUpdate(jobId, {
        shortlistedTutors: [],
        matchingRunAt: new Date(),
      });
      return;
    }

    // 4. Shortlisted tutors তৈরি করো
    const shortlistedTutors: IShortlistedTutor[] = topMatches.map(match => ({
      tutorId: new mongoose.Types.ObjectId(match.tutorId),
      score: match.score,
      matchDetails: match.matchDetails,
      shortlistedAt: new Date(),
    }));

    // 5. TuitionJob-এ shortlist save করো
    await TuitionJob.findByIdAndUpdate(jobId, {
      shortlistedTutors,
      matchingRunAt: new Date(),
    });

    console.log(`✅ [Matching Worker] Top ${topMatches.length} tutors shortlisted for job ${jobId}. Scores: ${topMatches.map(m => m.score).join(', ')}`);

    // 6. Application-এ isAutoShortlisted flag আপডেট করো
    // যারা ইতোমধ্যে apply করেছেন তাদের মধ্যে shortlisted tutors-দের flag set করো
    try {
      const shortlistedTutorIds = topMatches.map(m => m.tutorId);
      const { Application } = await import('../modules/application/application.model.js');

      // আগের shortlist flag সরাও
      await Application.updateMany(
        { jobId, isAutoShortlisted: true },
        { $set: { isAutoShortlisted: false } },
      );

      // নতুন shortlist flag সেট করো
      if (shortlistedTutorIds.length) {
        await Application.updateMany(
          { jobId, tutorId: { $in: shortlistedTutorIds.map(id => new mongoose.Types.ObjectId(id)) } },
          { $set: { isAutoShortlisted: true } },
        );
      }
    } catch (err) {
      console.warn('⚠️ [Matching Worker] Could not update application shortlist flags:', err);
    }

    // 7. Guardian-কে নোটিফিকেশন পাঠাও
    try {
      const guardianId = String(tuitionJob.postedBy);
      const jobLabel = `${tuitionJob.subjects.slice(0, 2).join(', ')} (${tuitionJob.studentClass})`;

      await NotificationService.createNotification({
        userId: guardianId,
        type: 'auto_match',
        title: `🤖 Auto Matching সম্পন্ন!`,
        message: `আপনার "${jobLabel}" টিউশনের জন্য ${topMatches.length} জন Tutor Automatically Match করা হয়েছে। এখনই দেখুন!`,
        referenceId: jobId,
        referenceType: 'TuitionJob',
      });
    } catch (err) {
      console.warn('⚠️ [Matching Worker] Guardian notification failed (non-fatal):', err);
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: 3, // একসাথে ৩টি matching job চলতে পারবে
  },
);

// ─── Worker Events ────────────────────────────────────────────────────────────
matchingWorker.on('completed', (job) => {
  console.log(`✅ [Matching Worker] Job "${job.name}" (ID: ${job.id}) completed.`);
});

matchingWorker.on('failed', (job, err) => {
  console.error(`❌ [Matching Worker] Job "${job?.name}" (ID: ${job?.id}) failed:`, err.message);
});

matchingWorker.on('error', (err) => {
  console.error('❌ [Matching Worker] Worker error:', err.message);
});
