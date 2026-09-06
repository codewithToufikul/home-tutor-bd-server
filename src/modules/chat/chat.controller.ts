import type { Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { getIO } from '../../services/socket.service.js';
import { sendOneSignalPush } from '../../services/onesignal.service.js';
import { SOCKET_EVENTS } from './chat.constants.js';
import { ChatService } from './chat.service.js';

const startConversation = async (req: CustomRequest, res: Response) => {
  const result = await ChatService.getOrCreateConversation(
    req.user!.userId,
    req.body.targetUserId,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Conversation retrieved or created successfully.',
    data: result,
  });
};

const getMyConversations = async (req: CustomRequest, res: Response) => {
  const result = await ChatService.getUserConversations(req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Conversations retrieved successfully.',
    data: result,
  });
};

const getConversationMessages = async (req: CustomRequest, res: Response) => {
  const page = parseInt(req.query['page'] as string || '1', 10);
  const limit = parseInt(req.query['limit'] as string || '50', 10);

  const result = await ChatService.getConversationMessages(
    String(req.params['id']),
    req.user!.userId,
    page,
    limit,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Messages retrieved successfully.',
    data: result.messages,
    meta: {
      type: 'offset',
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
      hasNextPage: result.pagination.page < result.pagination.totalPages,
      hasPrevPage: result.pagination.page > 1,
    },
  });
};

const markAsRead = async (req: CustomRequest, res: Response) => {
  const result = await ChatService.markMessagesAsRead(
    String(req.params['id']),
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Messages marked as read.',
    data: result,
  });
};

const sendMessage = async (req: CustomRequest, res: Response) => {
  const conversationId = String(req.params['id']);
  const { receiverId, message, type, attachments } = req.body;
  const senderId = req.user!.userId;

  const result = await ChatService.createMessage({
    conversationId,
    senderId,
    receiverId,
    message,
    type,
    attachments,
  });

    try {
      const io = getIO();
      if (io) {
        io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, result);
        io.to(`conversation:${conversationId}`).emit('receive_message', result);
        io.to(`user:${receiverId}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, result);
        io.to(`user:${receiverId}`).emit('receive_message', result);
        io.to(`user:${receiverId}`).emit('new_message_notification', result);
      }
    } catch (socketErr) {
      console.warn('⚠️ Socket emission error:', socketErr);
    }

    // Trigger OneSignal push notification to receiver
    const senderObj = (result as any)?.senderId || {};
    const senderName = typeof senderObj === 'object' && senderObj?.name ? senderObj.name : ((req.user as any)?.name || req.user?.email || 'Home Tutor BD');
    const roleBadge = typeof senderObj === 'object' && senderObj?.role ? (senderObj.role === 'tutor' ? ' (টিউটর)' : senderObj.role === 'student' ? ' (স্টুডেন্ট)' : senderObj.role === 'guardian' ? ' (অভিভাবক)' : ' (অ্যাডমিন)') : '';
    
    let snippet = message ? (message.length > 85 ? message.substring(0, 85) + '...' : message) : 'আপনাকে একটি মেসেজ পাঠিয়েছেন';
    if (type === 'image' || (!message && attachments?.length)) {
      snippet = '📷 একটি ছবি/ফাইল পাঠিয়েছেন';
    }

    sendOneSignalPush({
      userIds: [String(receiverId)],
      title: `💬 ${senderName}${roleBadge}`,
      message: snippet,
      url: `/chat/${senderId}`,
      data: {
        type: 'chat',
        conversationId: String(conversationId),
        senderId: String(senderId),
      },
    }).catch((err) => console.warn('[OneSignal] REST Chat push error:', err));

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Message sent successfully.',
    data: result,
  });
};

const getContacts = async (req: CustomRequest, res: Response) => {
  const result = await ChatService.getAvailableContacts(req.user!.userId, req.user!.role);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Contacts retrieved successfully.',
    data: result,
  });
};

const searchUsers = async (req: CustomRequest, res: Response) => {
  const q = String(req.query['query'] || '');
  const result = await ChatService.searchUsersForChat(q, req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Users retrieved successfully.',
    data: result,
  });
};

export const ChatController = {
  startConversation,
  getMyConversations,
  getConversationMessages,
  markAsRead,
  sendMessage,
  getContacts,
  searchUsers,
};
