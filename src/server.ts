import './config/env.js'; // ⚠️ MUST be first — loads dotenv before any other module reads process.env
import http from 'node:http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import app from './app.js';
import { connectRedis } from './config/redis.js';
import { initializeChatSocket } from './modules/chat/chat.socket.js';
import './jobs/email.worker.js';
import './jobs/notification.worker.js';
import './jobs/payment.worker.js';
import './jobs/matching.worker.js';

const PORT = process.env.PORT || 5000;
const DB_URL = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/home-tutor-bd';

async function main() {
  try {
    await mongoose.connect(DB_URL);
    console.log('🌱 Connected to MongoDB successfully!');

    // Ensure critical sparse index for email in production
    try {
      const userIndexes = await mongoose.connection.collection('users').indexes();
      const emailIdx = userIndexes.find((idx: any) => idx.name === 'email_1');
      if (emailIdx && !emailIdx.sparse) {
        await mongoose.connection.collection('users').dropIndex('email_1');
        await mongoose.connection.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
        console.log('🔧 Upgraded users.email_1 index to sparse index');
      }
    } catch (idxErr) {
      console.warn('⚠️ Index sync warning (non-fatal):', idxErr);
    }

    await connectRedis();

    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
      },
    });

    initializeChatSocket(io);

    server.listen(PORT, () => {
      console.log(`🚀 Home Tutor BD Server running on port ${PORT} at http://localhost:${PORT}/api/v1`);
      console.log(`⚡ Real-time Socket.IO server initialized on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
  }
}

main();
