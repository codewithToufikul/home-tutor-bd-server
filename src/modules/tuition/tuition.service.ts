import { AppError } from '../../errors/AppError.js';
import {
  buildCursorMatchStage,
  buildNextCursor,
  buildSortStage,
  decodeCursor,
  isPaginationCursor,
  resolveSortMode,
  type CursorMeta,
  type OffsetMeta,
} from '../../utils/pagination.js';
import { Application } from '../application/application.model.js';
import { NotificationService } from '../notification/notification.service.js';
import { User } from '../user/user.model.js';
import type { ITuitionJob } from './tuition.interface.js';
import { TuitionJob } from './tuition.model.js';

interface ITuitionSearchQuery extends Record<string, string | undefined> {
  district?: string;
  area?: string;
  subject?: string;
  medium?: string;
  studentClass?: string;
  minSalary?: string;
  maxSalary?: string;
  status?: string;
  approvalStatus?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: string;
  limit?: string;
  cursor?: string;
}

const buildFilterMatch = (query: ITuitionSearchQuery): Record<string, unknown> => {
  const match: Record<string, unknown> = {
    // 'all' = no approvalStatus filter (admin view); default is 'Approved' for public
    ...(query['approvalStatus'] && query['approvalStatus'] !== 'all'
      ? { approvalStatus: query['approvalStatus'] }
      : query['approvalStatus'] === 'all'
        ? {}
        : { approvalStatus: 'Approved' }),
    status: query.status || 'Open',
  };

  if (query.district) match['location.district'] = { $regex: query.district, $options: 'i' };
  if (query.area) match['location.area'] = { $regex: query.area, $options: 'i' };
  if (query.subject) match['subjects'] = { $in: [query.subject] };
  if (query.medium) match['medium'] = query.medium;
  if (query.studentClass) match['studentClass'] = { $regex: query.studentClass, $options: 'i' };

  if (query.minSalary || query.maxSalary) {
    const salaryFilter: Record<string, number> = {};
    if (query.minSalary) salaryFilter['$gte'] = parseInt(query.minSalary, 10);
    if (query.maxSalary) salaryFilter['$lte'] = parseInt(query.maxSalary, 10);
    match['salary'] = salaryFilter;
  }

  return match;
};

const getAllJobs = async (query: ITuitionSearchQuery) => {
  const limitNum = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10)));
  const sortMode = resolveSortMode(query.sortBy, query.sortOrder);
  const sortStage = buildSortStage(sortMode);
  const filterMatch = buildFilterMatch(query);

  const userLookup = {
    $lookup: {
      from: 'users',
      localField: 'postedBy',
      foreignField: '_id',
      as: 'postedByUser',
      pipeline: [{ $project: { name: 1, phone: 1, avatar: 1 } }],
    },
  };

  if (isPaginationCursor(query)) {
    const decoded = decodeCursor(query.cursor!);
    if (!decoded) throw new AppError(400, 'Invalid cursor value!');

    const cursorMatch = buildCursorMatchStage(decoded, sortMode);

    const pipeline = [
      { $match: filterMatch },
      userLookup,
      { $unwind: { path: '$postedByUser', preserveNullAndEmptyArrays: true } },
      { $match: cursorMatch },
      { $sort: sortStage },
      { $limit: limitNum + 1 },
    ];

    const docs = await TuitionJob.aggregate(pipeline);
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

    return { data, meta };
  }

  const pageNum = Math.max(1, parseInt(query.page ?? '1', 10));
  const skip = (pageNum - 1) * limitNum;

  const pipeline = [
    { $match: filterMatch },
    userLookup,
    { $unwind: { path: '$postedByUser', preserveNullAndEmptyArrays: true } },
    { $sort: sortStage },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limitNum }],
        totalCount: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await TuitionJob.aggregate(pipeline);
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

  return { data: result?.data ?? [], meta };
};

const getJobById = async (id: string) => {
  const job = await TuitionJob.findById(id).populate('postedBy', 'name email phone avatar');
  if (!job) throw new AppError(404, 'Tuition job not found!');
  return job;
};

const createJob = async (postedBy: string, payload: Partial<ITuitionJob>) => {
  const job = await TuitionJob.create({ ...payload, postedBy, status: 'Open', approvalStatus: 'Pending' });

  // Send notification to all admins about new tuition job pending approval
  try {
    const adminUsers = await User.find({ role: 'admin' });
    const poster = await User.findById(postedBy);
    for (const admin of adminUsers) {
      await NotificationService.createNotification({
        userId: String(admin._id),
        type: 'tuition_job',
        title: 'নতুন টিউশন জব পেন্ডিং অ্যাপ্রুভাল',
        message: `${poster?.name || 'একজন গার্ডিয়ান/স্টুডেন্ট'} একটি নতুন টিউশন জব পোস্ট করেছেন। অ্যাপ্রুভ করুন।`,
        referenceId: String(job._id),
        referenceType: 'TuitionJob',
      });
    }
  } catch (notifErr) {
    console.warn('⚠️ Admin notification error (non-fatal):', notifErr);
  }

  return job;
};

const updateJob = async (id: string, userId: string, userRole: string, payload: Partial<ITuitionJob>) => {
  const job = await TuitionJob.findById(id);
  if (!job) throw new AppError(404, 'Tuition job not found!');
  if (userRole !== 'admin' && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to update this job!');
  }
  return await TuitionJob.findByIdAndUpdate(id, { $set: payload }, { new: true });
};

const deleteJob = async (id: string, userId: string, userRole: string) => {
  const job = await TuitionJob.findById(id);
  if (!job) throw new AppError(404, 'Tuition job not found!');
  if (userRole !== 'admin' && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to delete this job!');
  }
  await TuitionJob.findByIdAndDelete(id);
  return { message: 'Tuition job deleted successfully.' };
};

const applyToJob = async (jobId: string, tutorId: string, expectedSalary?: number) => {
  const job = await TuitionJob.findById(jobId);
  if (!job) throw new AppError(404, 'Tuition job not found!');
  if (job.status !== 'Open') throw new AppError(400, 'This job is no longer open!');

  const existing = await Application.findOne({ jobId, tutorId });
  if (existing) throw new AppError(400, 'You have already applied for this job!');

  const application = await Application.create({
    jobId,
    tutorId,
    expectedSalary: expectedSalary ?? job.salary,
    status: 'Pending',
  });

  // Notify guardian who posted the job
  const tutorUser = await User.findById(tutorId);
  const tutorName = tutorUser?.name || 'একজন টিউটর';

  await NotificationService.createNotification({
    userId: String(job.postedBy),
    type: 'application',
    title: 'নতুন টিউশন আবেদন',
    message: `${tutorName} আপনার পোস্ট করা টিউশন জবে আবেদন করেছেন।`,
    referenceId: jobId,
    referenceType: 'TuitionJob',
  });

  // Notify all admins about the new tutor application
  try {
    const adminUsers = await User.find({ role: 'admin' });
    for (const admin of adminUsers) {
      await NotificationService.createNotification({
        userId: String(admin._id),
        type: 'application',
        title: 'টিউশন জব আবেদন জমা হয়েছে',
        message: `${tutorName} (${tutorUser?.email || ''}) একটি টিউশন জবে (${job.medium} - ৳${job.salary}) আবেদন করেছেন।`,
        referenceId: jobId,
        referenceType: 'TuitionJob',
      });
    }
  } catch (err) {
    console.warn('⚠️ Admin notification error on job application:', err);
  }

  return application;
};

export const TuitionService = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  applyToJob,
};
