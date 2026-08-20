import { AppError } from '../../errors/AppError.js';
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
import type { ITutor } from './tutor.interface.js';
import { Tutor } from './tutor.model.js';

interface ITutorSearchQuery extends Record<string, string | undefined> {
  subject?: string;
  district?: string;
  area?: string;
  medium?: string;
  gender?: string;
  minSalary?: string;
  maxSalary?: string;
  isVerified?: string;
  isPremium?: string;
  sortBy?: string;
  sortOrder?: string;
  // Offset pagination
  page?: string;
  limit?: string;
  // Cursor pagination
  cursor?: string;
}

// ─── Build $match from filters ────────────────────────────────────────────
const buildFilterMatch = (query: ITutorSearchQuery): Record<string, unknown> => {
  const match: Record<string, unknown> = {};

  if (query.subject) match['subjects'] = { $in: [query.subject] };
  if (query.district) match['location.district'] = { $regex: query.district, $options: 'i' };
  if (query.area) match['location.area'] = { $regex: query.area, $options: 'i' };
  if (query.medium) match['mediums'] = { $in: [query.medium] };
  if (query.gender && query.gender !== 'Any' && query.gender !== 'All') {
    match['gender'] = query.gender;
  }
  if (query.isVerified === 'true') match['isVerified'] = true;
  if (query.isPremium === 'true') match['isPremium'] = true;

  if (query.minSalary || query.maxSalary) {
    const salaryFilter: Record<string, number> = {};
    if (query.minSalary) salaryFilter['$gte'] = parseInt(query.minSalary, 10);
    if (query.maxSalary) salaryFilter['$lte'] = parseInt(query.maxSalary, 10);
    match['salary'] = salaryFilter;
  }

  return match;
};

// ─── Shared pipeline stages (lookup + exclude blocked) ────────────────────
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
  { $unwind: { path: '$user', preserveNullAndEmpty: false } },
  { $match: { 'user.status': { $ne: 'blocked' } } },
];

// ─── Search Tutors — supports both offset & cursor pagination ─────────────
const searchTutors = async (query: ITutorSearchQuery) => {
  const limitNum = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10)));
  const sortMode = resolveSortMode(query.sortBy, query.sortOrder);
  const sortStage = buildSortStage(sortMode);
  const filterMatch = buildFilterMatch(query);

  // ─── CURSOR PAGINATION ─────────────────────────────────────────────────
  if (isPaginationCursor(query)) {
    const decoded = decodeCursor(query.cursor!);
    if (!decoded) throw new AppError(400, 'Invalid cursor value!');

    const cursorMatch = buildCursorMatchStage(decoded, sortMode);

    // Fetch limit+1 to know if there's a next page
    const pipeline = [
      { $match: filterMatch },
      ...userLookupStages,
      { $match: cursorMatch },      // keyset condition
      { $sort: sortStage },
      { $limit: limitNum + 1 },     // +1 to detect hasMore
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
      hasPrevCursor: true, // cursor always means we're past page 1
    };

    return { data, meta };
  }

  // ─── OFFSET PAGINATION (page + limit) ─────────────────────────────────
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

  return { data: result?.data ?? [], meta };
};

// ─── Other service methods ────────────────────────────────────────────────
const getTutorById = async (id: string) => {
  const tutor = await Tutor.findById(id).populate('userId', 'name email phone avatar status');
  if (!tutor) throw new AppError(404, 'Tutor profile not found!');
  return tutor;
};

const createMyProfile = async (userId: string, payload: Partial<ITutor>) => {
  const existing = await Tutor.findOne({ userId });
  if (existing) throw new AppError(400, 'Tutor profile already exists!');
  return await Tutor.create({ ...payload, userId });
};

const updateMyProfile = async (userId: string, payload: Partial<ITutor>) => {
  return await Tutor.findOneAndUpdate(
    { userId },
    { $set: payload },
    { new: true, upsert: true, runValidators: true },
  );
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
  return tutor;
};

export const TutorService = {
  searchTutors,
  getTutorById,
  createMyProfile,
  updateMyProfile,
  getMyProfile,
  getMyApplications,
  getMyHireRequests,
  addReview,
};
