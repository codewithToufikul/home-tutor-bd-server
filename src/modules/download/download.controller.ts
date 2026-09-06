import type { Response } from 'express';
import { uploadToR2 } from '../../config/r2.js';
import { AppError } from '../../errors/AppError.js';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { NotificationService } from '../notification/notification.service.js';
import { User } from '../user/user.model.js';
import { sendResponse } from '../../utils/response.js';
import { DownloadFile } from './download.model.js';

// Admin / Moderator: Upload a new PDF/file
const uploadFile = async (req: CustomRequest, res: Response) => {
  if (!req.file) throw new AppError(400, 'No file uploaded!');

  const { title, description, category, targetRoles, isPublished } = req.body;
  if (!title?.trim()) throw new AppError(400, 'File title is required!');

  // Parse targetRoles — may come as JSON string or comma-separated
  let roles: string[] = [];
  try {
    roles = typeof targetRoles === 'string'
      ? (targetRoles.startsWith('[') ? JSON.parse(targetRoles) : targetRoles.split(',').map((r: string) => r.trim()))
      : Array.isArray(targetRoles) ? targetRoles : ['all'];
  } catch {
    roles = ['all'];
  }
  if (!roles.length) roles = ['all'];

  // Upload file to Cloudflare R2
  const folder = 'home-tutor-bd/downloads';
  const result = await uploadToR2(req.file.buffer, folder, req.file.originalname, req.file.mimetype);

  const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
  const fileExt = (req.file.originalname.split('.').pop() || 'PDF').toUpperCase();

  if (!req.user?.userId) throw new AppError(401, 'Unauthorized');

  const downloadFile = await DownloadFile.create({
    title: title.trim(),
    description: (description || '').trim(),
    fileUrl: result.url,
    publicId: result.key,
    fileName: req.file.originalname,
    fileType: fileExt,
    fileSize: `${fileSizeMB} MB`,
    category: (category as any) || 'General',
    targetRoles: roles as Array<'student' | 'tutor' | 'coaching' | 'guardian' | 'all'>,
    uploadedBy: req.user.userId,
    isPublished: isPublished !== 'false' && isPublished !== false,
  });

  // Send push notifications to target users
  const roleFilter: Record<string, any> = roles.includes('all')
    ? {}
    : { role: { $in: roles } };

  const targetUsers = (await User.find(roleFilter).select('_id').lean()) as Array<{ _id: any }>;

  const notifTitle = `📄 নতুন PDF আপলোড: ${title.trim()}`;
  const notifMessage = `"${title.trim()}" - ${category || 'General'} ক্যাটাগরিতে একটি নতুন ডকুমেন্ট পাওয়া গেছে। এখনই ডাউনলোড করুন।`;

  const notifPromises = targetUsers.map((u) =>
    NotificationService.createNotification({
      userId: String(u._id),
      type: 'system',
      title: notifTitle,
      message: notifMessage,
      referenceId: String((downloadFile as any)._id),
      referenceType: 'download',
    }).catch(() => null)
  );
  await Promise.allSettled(notifPromises);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'File uploaded and notifications sent successfully!',
    data: downloadFile,
  });
};

// Public/Users: Get all published files (filtered by role)
const getFiles = async (req: CustomRequest, res: Response) => {
  const { category, search, page = '1', limit = '20' } = req.query as Record<string, string>;
  const userRole = req.user?.role || 'student';

  const filter: Record<string, unknown> = {
    isPublished: true,
    $or: [
      { targetRoles: 'all' },
      { targetRoles: userRole },
    ],
  };

  if (category && category !== 'All') filter.category = category;
  if (search) filter.$text = { $search: search };

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [files, total] = await Promise.all([
    DownloadFile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    DownloadFile.countDocuments(filter),
  ]);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Download files fetched successfully.',
    data: {
      files,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    },
  });
};

// Admin: Get ALL files (including drafts)
const getAdminFiles = async (req: CustomRequest, res: Response) => {
  const files = await DownloadFile.find({})
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name email role')
    .lean();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All download files fetched.',
    data: files,
  });
};

// Track download count increment
const incrementDownload = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const file = await DownloadFile.findByIdAndUpdate(
    id,
    { $inc: { downloadsCount: 1 } },
    { new: true }
  );
  if (!file) throw new AppError(404, 'File not found!');

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Download count updated.',
    data: { fileUrl: file.fileUrl, fileName: file.fileName },
  });
};

// Admin: Toggle published status
const togglePublished = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const file = await DownloadFile.findById(id);
  if (!file) throw new AppError(404, 'File not found!');
  file.isPublished = !file.isPublished;
  await file.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `File ${file.isPublished ? 'published' : 'unpublished'} successfully.`,
    data: file,
  });
};

// Admin: Delete file
const deleteFile = async (req: CustomRequest, res: Response) => {
  const { id } = req.params;
  const file = await DownloadFile.findByIdAndDelete(id);
  if (!file) throw new AppError(404, 'File not found!');

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'File deleted successfully.',
    data: null,
  });
};

export const DownloadController = {
  uploadFile,
  getFiles,
  getAdminFiles,
  incrementDownload,
  togglePublished,
  deleteFile,
};
