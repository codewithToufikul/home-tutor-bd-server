import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const DB_URL = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/home-tutor-bd';

async function main() {
  try {
    await mongoose.connect(DB_URL);
    console.log('🌱 Connected to MongoDB successfully!');

    app.listen(PORT, () => {
      console.log(`🚀 Home Tutor BD Server running on port ${PORT} at http://localhost:${PORT}/api/v1`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
  }
}

main();
