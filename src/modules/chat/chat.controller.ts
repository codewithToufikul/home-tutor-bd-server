import type { Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
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

export const ChatController = {
  startConversation,
  getMyConversations,
  getConversationMessages,
  markAsRead,
};
