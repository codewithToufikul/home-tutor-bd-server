import type { Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { NotificationService } from './notification.service.js';

const getMyNotifications = async (req: CustomRequest, res: Response) => {
  const page = parseInt(req.query['page'] as string || '1', 10);
  const limit = parseInt(req.query['limit'] as string || '20', 10);

  const result = await NotificationService.getUserNotifications(
    req.user!.userId,
    page,
    limit,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notifications retrieved successfully.',
    data: {
      notifications: result.notifications,
      unreadCount: result.unreadCount,
    },
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
  const result = await NotificationService.markAsRead(
    String(req.params['id']),
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notification marked as read.',
    data: result,
  });
};

const markAllAsRead = async (req: CustomRequest, res: Response) => {
  const result = await NotificationService.markAllAsRead(req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All notifications marked as read.',
    data: result,
  });
};

export const NotificationController = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
