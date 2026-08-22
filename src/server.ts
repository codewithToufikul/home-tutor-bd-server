import http from 'node:http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import app from './app.js';
import { connectRedis } from './config/redis.js';
import { initializeChatSocket } from './modules/chat/chat.socket.js';
import './jobs/email.worker.js';
import './jobs/notification.worker.js';
import './jobs/payment.worker.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const DB_URL = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/home-tutor-bd';

async function main() {
  try {
    await mongoose.connect(DB_URL);
    console.log('🌱 Connected to MongoDB successfully!');

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
