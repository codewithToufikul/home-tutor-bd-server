import type { Server } from 'socket.io';

let ioInstance: Server | null = null;

export const setIO = (io: Server) => {
  ioInstance = io;
};

export const getIO = (): Server | null => {
  return ioInstance;
};

export const sendRealtimeNotification = (userId: string, data: unknown) => {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('newNotification', data);
  }
};
