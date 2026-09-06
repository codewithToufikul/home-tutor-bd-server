import mongoose from 'mongoose';
import { AppError } from '../../errors/AppError.js';
import { CACHE_TTL, CacheService } from '../../services/cache.service.js';
import {
  buildCursorMatchStage,
  buildNextCursor,
  buildSortStage,
  decodeCursor,
  isPaginationCursor,
  resolveSortMode,
} from '../../utils/pagination.js';
import type { CursorMeta, OffsetMeta } from '../../utils/pagination.js';
import { Application } from '../application/application.model.js';
import { HireRequest } from '../hire/hire.model.js';
import { User } from '../user/user.model.js';
import type { ITutor } from './tutor.interface.js';
import { Tutor } from './tutor.model.js';

interface ITutorSearchQuery extends Record<string, string | undefined> {
  search?: string;
  subject?: string;
  district?: string;
  area?: string;
  medium?: string;
  studentClass?: string;
  gender?: string;
  minSalary?: string;
  maxSalary?: string;
  isVerified?: string;
  isPremium?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: string;
  limit?: string;
  cursor?: string;
}

const buildFilterMatch = (query: ITutorSearchQuery): Record<string, unknown> => {
  const match: Record<string, unknown> = {};

  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    match['$or'] = [
      { university: { $regex: s, $options: 'i' } },
      { department: { $regex: s, $options: 'i' } },
      { qualification: { $regex: s, $options: 'i' } },
      { 'location.district': { $regex: s, $options: 'i' } },
      { 'location.area': { $regex: s, $options: 'i' } },
      { subjects: { $elemMatch: { $regex: s, $options: 'i' } } },
    ];
  }

  if (query.subject && query.subject !== 'All') {
    match['subjects'] = { $elemMatch: { $regex: query.subject, $options: 'i' } };
  }
  if (query.district && query.district !== 'All') {
    match['location.district'] = { $regex: query.district, $options: 'i' };
  }
  if (query.area && query.area !== 'All') {
    match['location.area'] = { $regex: query.area, $options: 'i' };
  }
  if (query.medium && query.medium !== 'All') {
    match['mediums'] = { $elemMatch: { $regex: query.medium, $options: 'i' } };
  }
  if (query.studentClass && query.studentClass !== 'All') {
    match['preferredClasses'] = { $elemMatch: { $regex: query.studentClass, $options: 'i' } };
  }
  if (query.gender && query.gender !== 'Any' && query.gender !== 'All') {
    match['gender'] = { $regex: query.gender, $options: 'i' };
  }
  
  // By default, ONLY verified tutors are visible publicly!
  if (query.isVerified === 'all') {
    // Admin or specific query for all tutors
  } else if (query.isVerified === 'false') {
    match['isVerified'] = false;
  } else {
    match['isVerified'] = true;
  }

  if (query.isPremium === 'true') match['isPremium'] = true;

  if (query.minSalary || query.maxSalary) {
    const salaryFilter: Record<string, number> = {};
    if (query.minSalary) salaryFilter['$gte'] = parseInt(query.minSalary, 10);
    if (query.maxSalary) salaryFilter['$lte'] = parseInt(query.maxSalary, 10);
    match['salary'] = salaryFilter;
  }

  return match;
};

const userLookupStages = [
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'user',
      pipeline: [{ $project: { name: 1, email: 1, phone: 1, avatar: 1, status: 1 } }],
    },
  },
  { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
  { $match: { 'user.status': { $ne: 'blocked' } } },
];

const searchTutors = async (query: ITutorSearchQuery) => {
  // Build Redis cache key based on query parameters
  const cacheKey = `tutors:search:${new URLSearchParams(query as Record<string, string>).toString()}`;
  const cachedData = await CacheService.getCache<{ data: unknown; meta: unknown }>(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const limitNum = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10)));
  const sortMode = resolveSortMode(query.sortBy, query.sortOrder);
  const sortStage = buildSortStage(sortMode);
  const filterMatch = buildFilterMatch(query);

  let resultData;

  if (isPaginationCursor(query)) {
    const decoded = decodeCursor(query.cursor!);
    if (!decoded) throw new AppError(400, 'Invalid cursor value!');

    const cursorMatch = buildCursorMatchStage(decoded, sortMode);

    const pipeline = [
      { $match: filterMatch },
      ...userLookupStages,
      { $match: cursorMatch },
      { $sort: sortStage },
      { $limit: limitNum + 1 },
      { $project: { userId: 0, nid: 0, cv: 0 } },
    ];

    const docs = await Tutor.aggregate(pipeline);
    const hasMore = docs.length > limitNum;
    const data = hasMore ? docs.slice(0, limitNum) : docs;

    const lastDoc = data[data.length - 1] as Record<string, unknown> | undefined;
    const nextCursor = hasMore && lastDoc ? buildNextCursor(lastDoc, sortMode) : null;

    const meta: CursorMeta = {
      type: 'cursor',
      limit: limitNum,
      nextCursor,
      hasMore,
      hasPrevCursor: true,
    };

    resultData = { data, meta };
  } else {
    const pageNum = Math.max(1, parseInt(query.page ?? '1', 10));
    const skip = (pageNum - 1) * limitNum;

    const pipeline = [
      { $match: filterMatch },
      ...userLookupStages,
      { $sort: sortStage },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum },
            { $project: { userId: 0, nid: 0, cv: 0 } },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Tutor.aggregate(pipeline);
    const total: number = result?.totalCount?.[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limitNum);

    const meta: OffsetMeta = {
      type: 'offset',
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    };

    resultData = { data: result?.data ?? [], meta };
  }

  // Cache response for 300 seconds
  await CacheService.setCache(cacheKey, resultData, CACHE_TTL.SEARCH_TUTORS);

  return resultData;
};

const getTutorById = async (id: string) => {
  const cacheKey = `tutor:detail:${id}`;
  const cached = await CacheService.getCache(cacheKey);
  if (cached) return cached;

  let tutor = null;
  if (mongoose.isValidObjectId(id)) {
    tutor = await Tutor.findById(id).populate('userId', 'name avatar status role');
    if (!tutor) {
      tutor = await Tutor.findOne({ userId: id }).populate('userId', 'name avatar status role');
    }
  }

  if (!tutor) throw new AppError(404, 'Tutor profile not found!');

  await CacheService.setCache(cacheKey, tutor, CACHE_TTL.SEARCH_TUTORS);
  return tutor;
};

const createMyProfile = async (userId: string, payload: Partial<ITutor>) => {
  const existing = await Tutor.findOne({ userId });
  if (existing) throw new AppError(400, 'Tutor profile already exists!');

  const created = await Tutor.create({ ...payload, userId });

  // Cache invalidation
  await CacheService.invalidatePattern('tutors:search:*');
  await CacheService.deleteCache('homepage:data');

  return created;
};

const updateMyProfile = async (
  userId: string,
  payload: Partial<ITutor> & { photoUrl?: string; avatar?: string; name?: string; fullName?: string },
) => {
  const updateData: any = { ...payload };

  const avatarUrl = updateData.avatar || updateData.photoUrl;
  const newName = updateData.name || updateData.fullName;

  // Sync avatar and name to User model if provided
  if (avatarUrl || newName) {
    const userUpdate: Record<string, string> = {};
    if (avatarUrl) userUpdate.avatar = avatarUrl;
    if (newName) userUpdate.name = newName;
    await User.findByIdAndUpdate(userId, { $set: userUpdate });
  }

  // If tutor uploads NID card or Student ID card, set verification status to Pending
  if (updateData.nidCard || updateData.studentIdCard) {
    const existing = await Tutor.findOne({ userId });
    const hasNid = Boolean(updateData.nidCard || existing?.nidCard);
    const hasStudentId = Boolean(updateData.studentIdCard || existing?.studentIdCard);

    if (hasNid && hasStudentId && !existing?.isVerified) {
      updateData.verificationStatus = 'Pending';
      updateData.submittedAt = new Date();
      updateData.rejectionReason = '';
    }
  }

  const profile = await Tutor.findOneAndUpdate(
    { userId },
    { $set: updateData },
    { new: true, upsert: true, runValidators: true },
  );

  // Invalidate tutor search and detail caches
  await CacheService.invalidatePattern('tutors:search:*');
  if (profile?._id) {
    await CacheService.deleteCache(`tutor:detail:${profile._id}`);
  }
  await CacheService.deleteCache('homepage:data');

  return profile;
};

const submitVerification = async (
  userId: string,
  payload: { nidCard: string; studentIdCard: string; nid?: string },
) => {
  if (!payload.nidCard || !payload.studentIdCard) {
    throw new AppError(400, 'NID Card এবং Student/Tutor ID Card উভয় ডকুমেন্ট প্রদান করা আবশ্যক!');
  }

  const updateData: Partial<ITutor> = {
    nidCard: payload.nidCard,
    studentIdCard: payload.studentIdCard,
    verificationStatus: 'Pending',
    submittedAt: new Date(),
    rejectionReason: '',
  };

  if (payload.nid) {
    updateData.nid = payload.nid;
  }

  const profile = await Tutor.findOneAndUpdate(
    { userId },
    { $set: updateData },
    { new: true, upsert: true, runValidators: true },
  );

  // Also sync with Verification model so admin can view in verification requests
  try {
    const { Verification } = await import('../verification/verification.model.js');
    await Verification.findOneAndUpdate(
      { tutorId: userId },
      {
        tutorId: userId,
        nidDocument: payload.nidCard,
        studentIdDocument: payload.studentIdCard,
        status: 'Pending',
      },
      { upsert: true, new: true },
    );
  } catch (err) {
    console.warn('⚠️ Could not sync verification model:', err);
  }

  // Send real-time notification to all staff (Super Admin, Admin, Moderator)
  try {
    const { User } = await import('../user/user.model.js');
    const { NotificationService } = await import('../notification/notification.service.js');
    
    const tutorUser = await User.findById(userId);
    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } });
    
    const tutorName = tutorUser?.name || 'টিউটর';
    const tutorUni = profile?.university ? ` (${profile.university})` : '';

    for (const staff of staffUsers) {
      await NotificationService.createNotification({
        userId: String(staff._id),
        type: 'tutor_verification',
        title: '👨‍🏫 নতুন টিউটর ভেরিফিকেশন আবেদন জমা হয়েছে',
        message: `টিউটর "${tutorName}"${tutorUni} ভেরিফিকেশনের জন্য NID এবং আইডি কার্ড জমা দিয়েছেন। অ্যাডমিন প্যানেল থেকে পর্যালোচনা করুন।`,
        referenceId: String(userId),
        referenceType: 'Tutor',
      });
    }
  } catch (err) {
    console.warn('⚠️ Could not send staff verification notification:', err);
  }

  // Invalidate cache
  await CacheService.invalidatePattern('tutors:search:*');
  if (profile?._id) {
    await CacheService.deleteCache(`tutor:detail:${profile._id}`);
  }
  await CacheService.deleteCache('homepage:data');

  return profile;
};

const getMyProfile = async (userId: string) => {
  const profile = await Tutor.findOne({ userId }).populate('userId', 'name email phone avatar status');
  if (!profile) throw new AppError(404, 'Tutor profile not found!');
  return profile;
};

const getMyApplications = async (userId: string) => {
  return await Application.find({ tutorId: userId })
    .populate({ path: 'jobId', populate: { path: 'postedBy', select: 'name email phone avatar' } })
    .sort({ createdAt: -1 });
};

const getMyHireRequests = async (userId: string) => {
  return await HireRequest.find({ tutorId: userId })
    .populate('guardianId', 'name email phone avatar')
    .populate('jobId')
    .sort({ createdAt: -1 });
};

const addReview = async (tutorId: string, rating: number) => {
  const tutor = await Tutor.findById(tutorId);
  if (!tutor) throw new AppError(404, 'Tutor not found!');
  if (rating < 1 || rating > 5) throw new AppError(400, 'Rating must be between 1 and 5!');

  const newCount = tutor.reviewCount + 1;
  tutor.rating = Number(((tutor.rating * tutor.reviewCount + rating) / newCount).toFixed(1));
  tutor.reviewCount = newCount;
  await tutor.save();

  // Cache invalidation
  await CacheService.invalidatePattern('tutors:search:*');
  await CacheService.deleteCache(`tutor:detail:${tutorId}`);
  await CacheService.deleteCache('homepage:data');

  return tutor;
};

export const TutorService = {
  searchTutors,
  getTutorById,
  createMyProfile,
  updateMyProfile,
  submitVerification,
  getMyProfile,
  getMyApplications,
  getMyHireRequests,
  addReview,
};
