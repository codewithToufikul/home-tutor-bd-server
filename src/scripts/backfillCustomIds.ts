import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { TuitionJob } from '../modules/tuition/tuition.model.js';
import { generateTuitionCustomId } from '../modules/tuition/tuition.service.js';

dotenv.config();

const DB_URL = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/home-tutor-bd';

async function backfillCustomIds() {
  try {
    await mongoose.connect(DB_URL);
    console.log('Connected to MongoDB');

    const jobsWithoutCustomId = await TuitionJob.find({
      $or: [{ customId: { $exists: false } }, { customId: null }, { customId: '' }],
    }).sort({ createdAt: 1 });

    console.log(`Found ${jobsWithoutCustomId.length} jobs without customId.`);

    for (const job of jobsWithoutCustomId) {
      const district = job.location?.district || 'Dhaka';
      const customId = await generateTuitionCustomId(district);
      job.customId = customId;
      await job.save();
      console.log(`Assigned ${customId} to job ${job._id} (${district})`);
    }

    console.log('Finished backfilling customIds!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error during backfill:', err);
    process.exit(1);
  }
}

backfillCustomIds();
