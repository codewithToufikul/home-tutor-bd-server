import { AppError } from '../../errors/AppError.js';
import { sendFcmNotification } from '../../services/fcm.service.js';
import { sendOneSignalPush } from '../../services/onesignal.service.js';
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

  // 2. Trigger OneSignal Universal Push Notification (Web & Mobile Device Push)
  sendOneSignalPush({
    userIds: [String(payload.userId)],
    title: payload.title,
    message: payload.message,
    url: payload.referenceId ? `/tuitions/${payload.referenceId}` : '/dashboard',
    data: {
      type: payload.type,
      referenceId: payload.referenceId ? String(payload.referenceId) : '',
      referenceType: payload.referenceType || '',
    },
  }).catch((err) => console.warn('[OneSignal] Push notification error:', err));

  // 3. Fallback FCM Push Notification
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

/**
 * Dispatches Instant Push Notifications & Real-time Alerts to ALL Admin and Moderator accounts
 * whenever a new Tutor, Student, Guardian, or Coaching Center account is created.
 */
const notifyStaffOnNewUserRegistration = async (newUser: {
  _id: string | unknown;
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  role: string;
  location?: string | undefined;
}) => {
  try {
    const staffUsers = await User.find({
      role: { $in: ['super_admin', 'admin', 'moderator'] },
      status: { $ne: 'blocked' },
    }).select('_id fcmTokens');

    if (!staffUsers || staffUsers.length === 0) return;

    const roleNameMap: Record<string, string> = {
      tutor: 'টিউটর (Tutor)',
      student: 'শিক্ষার্থী (Student)',
      guardian: 'অভিভাবক (Guardian)',
      coaching: 'কোচিং সেন্টার (Coaching Center)',
    };

    const roleBadge = roleNameMap[newUser.role] || newUser.role;
    const identifier = newUser.phone || newUser.email || 'তথ্য নেই';

    let title = '';
    let message = '';
    let targetUrl = '/admin/users';

    if (newUser.role === 'tutor') {
      title = '👨‍🏫 নতুন টিউটর অ্যাকাউন্ট খোলা হয়েছে!';
      message = `টিউটর "${newUser.name}" (${identifier}) প্ল্যাটফর্মে নতুন রেজিস্ট্রেশন করেছেন।`;
      targetUrl = '/admin/all-tutors';
    } else if (newUser.role === 'student') {
      title = '🎓 নতুন শিক্ষার্থী অ্যাকাউন্ট তৈরি হয়েছে!';
      message = `শিক্ষার্থী "${newUser.name}" (${identifier}) প্ল্যাটফর্মে সফলভাবে যুক্ত হয়েছেন।`;
      targetUrl = '/admin/users';
    } else if (newUser.role === 'guardian') {
      title = '👨‍👩‍👦 নতুন অভিভাবক অ্যাকাউন্ট তৈরি হয়েছে!';
      message = `অভিভাবক "${newUser.name}" (${identifier}) প্ল্যাটফর্মে সফলভাবে যুক্ত হয়েছেন।`;
      targetUrl = '/admin/users';
    } else if (newUser.role === 'coaching') {
      title = '🏢 নতুন কোচিং সেন্টার রেজিস্ট্রেশন (অ্যাপ্রুভাল প্রয়োজন)!';
      message = `কোচিং সেন্টার "${newUser.name}" (${identifier}) রেজিস্ট্রেশন করেছেন। ড্যাশবোর্ড সক্রিয় করতে অনুমোদনের প্রয়োজন।`;
      targetUrl = '/admin/coaching-center';
    } else {
      title = `👤 নতুন ${roleBadge} অ্যাকাউন্ট খোলা হয়েছে!`;
      message = `ব্যবহারকারী "${newUser.name}" (${identifier}) প্ল্যাটফর্মে রেজিস্ট্রেশন করেছেন।`;
      targetUrl = '/admin/users';
    }

    const staffIds = staffUsers.map((s) => String(s._id));

    // 1. Create In-App Notification document for each admin/moderator
    const notificationDocs = staffUsers.map((staff) => ({
      userId: staff._id,
      type: 'user_registration' as NotificationType,
      title,
      message,
      referenceId: String(newUser._id),
      referenceType: 'User',
      isRead: false,
    }));
    await Notification.insertMany(notificationDocs);

    // 2. Emit real-time Socket.IO notification to all connected staff sockets
    for (const staff of staffUsers) {
      sendRealtimeNotification(String(staff._id), {
        title,
        message,
        type: 'user_registration',
        referenceId: String(newUser._id),
        referenceType: 'User',
        createdAt: new Date(),
        isRead: false,
      });
    }

    // 3. Trigger OneSignal Universal Web & Mobile Push Notification to all Admin & Moderator accounts
    await sendOneSignalPush({
      userIds: staffIds,
      title,
      message,
      url: targetUrl,
      data: {
        type: 'user_registration',
        userId: String(newUser._id),
        role: newUser.role,
      },
    }).catch((err) => console.warn('[OneSignal] Staff push notification error:', err));

    // 4. Trigger FCM Push Notification fallback
    const allFcmTokens = staffUsers.flatMap((s) => s.fcmTokens || []).filter(Boolean);
    if (allFcmTokens.length > 0) {
      sendFcmNotification({
        tokens: allFcmTokens,
        title,
        body: message,
        data: {
          type: 'user_registration',
          userId: String(newUser._id),
          role: newUser.role,
        },
      });
    }

    console.log(`🔔 [Staff Push Notification Sent] New ${newUser.role} registered (${newUser.name}). Notified ${staffUsers.length} admin/moderator account(s).`);
  } catch (error) {
    console.error('❌ Error sending new user registration push notification to staff:', error);
  }
};

export const NotificationService = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  notifyStaffOnNewUserRegistration,
};
