import { AppError } from '../../errors/AppError.js';
import { User } from '../user/user.model.js';
import { NotificationService } from '../notification/notification.service.js';
import { sendOneSignalPush, sendBroadcastPush } from '../../services/onesignal.service.js';
import type { INotice } from './notice.interface.js';
import { Notice } from './notice.model.js';

const createNotice = async (payload: Partial<INotice>, adminUserId?: string) => {
  if (!payload.title || !payload.content) {
    throw new AppError(400, 'Notice title and content are required.');
  }

  const notice = await Notice.create({
    ...payload,
    createdBy: adminUserId ? (adminUserId as any) : undefined,
    isPublished: payload.isPublished ?? true,
  });

  // Broadcast in-app notifications & push to targeted users asynchronously
  (async () => {
    try {
      let roleFilter: Record<string, unknown> = { status: 'active', role: { $nin: ['super_admin', 'admin', 'moderator'] } };
      if (payload.audience === 'Tutors') {
        roleFilter = { status: 'active', role: 'tutor' };
      } else if (payload.audience === 'Guardians') {
        roleFilter = { status: 'active', role: 'guardian' };
      } else if (payload.audience === 'Students') {
        roleFilter = { status: 'active', role: 'student' };
      } else if (payload.audience === 'Coaching') {
        roleFilter = { status: 'active', role: 'coaching' };
      }

      const users = await User.find(roleFilter).select('_id name email phone').lean();
      const userIds = users.map((u) => String(u._id));
      
      const notificationPromises = users.slice(0, 300).map((u) =>
        NotificationService.createNotification({
          userId: String(u._id),
          type: 'system',
          title: `📢 নতুন নোটিশ: ${notice.title}`,
          message: notice.content.slice(0, 150) + (notice.content.length > 150 ? '...' : ''),
          referenceId: String(notice._id),
          referenceType: 'Notice',
        }).catch(() => null)
      );

      await Promise.all(notificationPromises);

      // Trigger Push Notifications
      if (payload.audience === 'All') {
        await sendBroadcastPush({
          title: `📢 নোটিশ: ${notice.title}`,
          message: notice.content.slice(0, 120),
          url: '/notices',
          data: { noticeId: String(notice._id) },
        }).catch(() => null);
      } else if (userIds.length > 0) {
        await sendOneSignalPush({
          userIds,
          title: `📢 নোটিশ: ${notice.title}`,
          message: notice.content.slice(0, 120),
          url: '/notices',
          data: { noticeId: String(notice._id) },
        }).catch(() => null);
      }
    } catch (err) {
      console.warn('⚠️ Notice broadcast notification error:', err);
    }
  })();

  return notice;
};

const getNoticesForUser = async (userRole?: string) => {
  const now = new Date();
  const audienceList = ['All'];

  if (userRole) {
    const roleLower = userRole.toLowerCase();
    if (roleLower === 'tutor') audienceList.push('Tutors');
    else if (roleLower === 'guardian') audienceList.push('Guardians');
    else if (roleLower === 'student') audienceList.push('Students');
    else if (roleLower === 'coaching') audienceList.push('Coaching');
  } else {
    audienceList.push('Tutors', 'Guardians', 'Students', 'Coaching');
  }

  const query: Record<string, unknown> = {
    isPublished: true,
    audience: { $in: audienceList },
    $or: [
      { displayUntil: null },
      { displayUntil: { $gte: now } },
    ],
  };

  const notices = await Notice.find(query).sort({ createdAt: -1 }).populate('createdBy', 'name avatar role').lean();
  return notices;
};

const getAllNoticesAdmin = async () => {
  const notices = await Notice.find().sort({ createdAt: -1 }).populate('createdBy', 'name email avatar role').lean();
  return notices;
};

const getNoticeById = async (id: string) => {
  const notice = await Notice.findById(id).populate('createdBy', 'name email avatar role');
  if (!notice) {
    throw new AppError(404, 'Notice not found.');
  }
  return notice;
};

const updateNotice = async (id: string, payload: Partial<INotice>) => {
  const notice = await Notice.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true });
  if (!notice) {
    throw new AppError(404, 'Notice not found.');
  }
  return notice;
};

const deleteNotice = async (id: string) => {
  const notice = await Notice.findByIdAndDelete(id);
  if (!notice) {
    throw new AppError(404, 'Notice not found.');
  }
  return notice;
};

export const NoticeService = {
  createNotice,
  getNoticesForUser,
  getAllNoticesAdmin,
  getNoticeById,
  updateNotice,
  deleteNotice,
};
