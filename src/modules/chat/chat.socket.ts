import type { Server, Socket } from 'socket.io';
import { setIO } from '../../services/socket.service.js';
import { verifyToken } from '../../utils/jwt.js';
import { SOCKET_EVENTS } from './chat.constants.js';
import type { MessageType } from './chat.interface.js';
import { ChatService } from './chat.service.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

const onlineUsersMap = new Map<string, Set<string>>();

export const initializeChatSocket = (io: Server) => {
  setIO(io);

  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token missing!'));
    }

    try {
      const secret = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
      const decoded = verifyToken(token, secret);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid or expired token!'));
    }
  });

  io.on(SOCKET_EVENTS.CONNECTION, (socket: AuthenticatedSocket) => {
    const userId = socket.userId;
    if (!userId) return;

    if (!onlineUsersMap.has(userId)) {
      onlineUsersMap.set(userId, new Set());
    }
    onlineUsersMap.get(userId)!.add(socket.id);

    socket.join(`user:${userId}`);

    io.emit(SOCKET_EVENTS.USER_ONLINE, { userId });
    io.emit(SOCKET_EVENTS.ONLINE_USERS, Array.from(onlineUsersMap.keys()));

    console.log(`🔌 Socket Connected: User ${userId} (Socket ${socket.id})`);

    socket.on(SOCKET_EVENTS.JOIN_ROOM, ({ conversationId }: { conversationId: string }) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, ({ conversationId }: { conversationId: string }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on(
      SOCKET_EVENTS.SEND_MESSAGE,
      async (data: {
        conversationId: string;
        receiverId: string;
        message: string;
        type?: MessageType;
        attachments?: string[];
      }) => {
        try {
          const savedMessage = await ChatService.createMessage({
            conversationId: data.conversationId,
            senderId: userId,
            receiverId: data.receiverId,
            message: data.message,
            type: data.type || 'text',
            attachments: data.attachments || [],
          });

          const roomName = `conversation:${data.conversationId}`;
          io.to(roomName).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, savedMessage);
          io.to(roomName).emit('receive_message', savedMessage);
          io.to(`user:${data.receiverId}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, savedMessage);
          io.to(`user:${data.receiverId}`).emit('receive_message', savedMessage);
          io.to(`user:${data.receiverId}`).emit('new_message_notification', savedMessage);
        } catch (err: unknown) {
          socket.emit('error', {
            message: err instanceof Error ? err.message : 'Failed to send message',
          });
        }
      },
    );

    socket.on(SOCKET_EVENTS.TYPING, ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.TYPING, {
        conversationId,
        userId,
      });
    });

    socket.on(SOCKET_EVENTS.STOP_TYPING, ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.STOP_TYPING, {
        conversationId,
        userId,
      });
    });

    socket.on(
      SOCKET_EVENTS.MESSAGE_READ,
      async ({ conversationId }: { conversationId: string }) => {
        try {
          await ChatService.markMessagesAsRead(conversationId, userId);
          io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_READ, {
            conversationId,
            readerId: userId,
          });
        } catch (err: unknown) {
          console.warn('Error marking messages as read:', err);
        }
      },
    );

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      const userSockets = onlineUsersMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsersMap.delete(userId);
          io.emit(SOCKET_EVENTS.USER_OFFLINE, { userId });
        }
      }

      io.emit(SOCKET_EVENTS.ONLINE_USERS, Array.from(onlineUsersMap.keys()));
      console.log(`🔌 Socket Disconnected: User ${userId} (Socket ${socket.id})`);
    });
  });
};
