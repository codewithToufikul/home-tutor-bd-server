import '../src/config/env.js';
import mongoose from 'mongoose';
import { User } from '../src/modules/user/user.model.js';
import { Tutor } from '../src/modules/tutor/tutor.model.js';
import { Notification } from '../src/modules/notification/notification.model.js';

const DB_URL = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/home-tutor-bd';

async function cleanSpam() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(DB_URL);
    console.log('🌱 Connected to database.');

    // Regex to detect spam keywords / URLs in name or email
    const spamRegex = /(https?:\/\/|www\.|\.ly|bit\.ly|TL bonus|bonus seni bekliyor|casino|70\.000|bekliyor)/i;

    // Find all users matching spam patterns
    const spamUsers = await User.find({
      $or: [
        { name: { $regex: spamRegex } },
        { email: { $regex: /(bit\.ly|casino|betting)/i } },
      ],
    }).select('_id name email role');

    console.log(`🔎 Found ${spamUsers.length} spam user account(s).`);

    if (spamUsers.length === 0) {
      console.log('✅ No spam users found. Database is clean!');
      process.exit(0);
    }

    const spamUserIds = spamUsers.map((u) => u._id);

    // 1. Delete Tutor profiles associated with these spam users
    const deletedTutors = await Tutor.deleteMany({ userId: { $in: spamUserIds } });
    console.log(`🗑️ Deleted ${deletedTutors.deletedCount} associated tutor profile(s).`);

    // 2. Delete Notifications referencing these spam users or containing spam text
    const deletedNotifications = await Notification.deleteMany({
      $or: [
        { referenceId: { $in: spamUserIds.map((id) => String(id)) } },
        { message: { $regex: spamRegex } },
        { title: { $regex: spamRegex } },
      ],
    });
    console.log(`🗑️ Deleted ${deletedNotifications.deletedCount} spam notification(s).`);

    // 3. Delete the Spam Users from User collection
    const deletedUsers = await User.deleteMany({ _id: { $in: spamUserIds } });
    console.log(`🗑️ Deleted ${deletedUsers.deletedCount} spam user(s).`);

    console.log('🎉 Cleanup completed successfully! All spam accounts and notifications removed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanSpam();
