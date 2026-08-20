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
  sortBy?: string;
  sortOrder?: string;
  // Offset pagination
  page?: string;
  limit?: string;
  // Cursor pagination
  cursor?: string;
}

const buildFilterMatch = (query: ITuitionSearchQuery): Record<string, unknown> => {
  const match: Record<string, unknown> = {
    approvalStatus: 'Approved',
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

  // ─── CURSOR PAGINATION ─────────────────────────────────────────────────
  if (isPaginationCursor(query)) {
    const decoded = decodeCursor(query.cursor!);
    if (!decoded) throw new AppError(400, 'Invalid cursor value!');

    const cursorMatch = buildCursorMatchStage(decoded, sortMode);

    const pipeline = [
      { $match: filterMatch },
      userLookup,
      { $unwind: { path: '$postedByUser', preserveNullAndEmpty: true } },
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

  // ─── OFFSET PAGINATION ─────────────────────────────────────────────────
  const pageNum = Math.max(1, parseInt(query.page ?? '1', 10));
  const skip = (pageNum - 1) * limitNum;

  const pipeline = [
    { $match: filterMatch },
    userLookup,
    { $unwind: { path: '$postedByUser', preserveNullAndEmpty: true } },
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
  return await TuitionJob.create({ ...payload, postedBy, status: 'Open', approvalStatus: 'Approved' });
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

  return await Application.create({ jobId, tutorId, expectedSalary: expectedSalary ?? job.salary, status: 'Pending' });
};

export const TuitionService = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  applyToJob,
};
