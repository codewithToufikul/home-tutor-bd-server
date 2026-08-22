import { AppError } from '../../errors/AppError.js';
import { sendFcmNotification } from '../../services/fcm.service.js';
import { sendRealtimeNotification } from '../../services/socket.service.js';
import { User } from '../user/user.model.js';
import type { NotificationType } from './notification.interface.js';
import { Notification } from './notification.model.js';

const createNotification = async (payload: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
}) => {
  const data: Record<string, unknown> = {
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    referenceType: payload.referenceType || '',
    isRead: false,
  };

  if (payload.referenceId) {
    data['referenceId'] = payload.referenceId;
  }

  const notification = await Notification.create(data);

  // 1. Emit real-time Socket.IO notification to web/app connected socket
  sendRealtimeNotification(payload.userId, notification);

  // 2. Trigger FCM Push Notification to user's mobile device(s)
  const user = await User.findById(payload.userId).select('fcmTokens');
  if (user && user.fcmTokens && user.fcmTokens.length > 0) {
    sendFcmNotification({
      tokens: user.fcmTokens,
      title: payload.title,
      body: payload.message,
      data: {
        type: payload.type,
        referenceId: payload.referenceId ? String(payload.referenceId) : '',
        referenceType: payload.referenceType || '',
      },
    });
  }

  return notification;
};

const getUserNotifications = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
) => {
  const skip = (page - 1) * limit;

  const notifications = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Notification.countDocuments({ userId });
  const unreadCount = await Notification.countDocuments({ userId, isRead: false });

  return {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const markAsRead = async (id: string, userId: string) => {
  const notification = await Notification.findOne({ _id: id, userId });
  if (!notification) {
    throw new AppError(404, 'Notification not found!');
  }

  notification.isRead = true;
  await notification.save();

  return notification;
};

const markAllAsRead = async (userId: string) => {
  await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
  return { success: true };
};

export const NotificationService = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
};
