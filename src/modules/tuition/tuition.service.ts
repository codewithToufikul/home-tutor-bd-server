import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { AppError } from '../../errors/AppError.js';
import { addMatchingJob } from '../../jobs/matching.queue.js';
import { RuleBasedMatcher } from '../../services/matching.service.js';
import { CACHE_TTL, CacheService } from '../../services/cache.service.js';
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
import { Tutor } from '../tutor/tutor.model.js';
import { User } from '../user/user.model.js';
import type { ITuitionJob } from './tuition.interface.js';
import { TuitionJob } from './tuition.model.js';

interface ITuitionSearchQuery extends Record<string, string | undefined> {
  search?: string;
  jobId?: string;
  district?: string;
  area?: string;
  subject?: string;
  category?: string;
  medium?: string;
  studentClass?: string;
  tuitionType?: string;
  gender?: string;
  genderPreference?: string;
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

const DISTRICT_CODE_MAP: Record<string, string> = {
  dhaka: 'DHA',
  chattogram: 'CTG',
  chittagong: 'CTG',
  sylhet: 'SYL',
  rajshahi: 'RAJ',
  khulna: 'KHU',
  barishal: 'BAR',
  barisal: 'BAR',
  rangpur: 'RAN',
  mymensingh: 'MYM',
  cumilla: 'COM',
  comilla: 'COM',
  gazipur: 'GAZ',
  narayanganj: 'NAR',
  bogura: 'BOG',
  bogra: 'BOG',
  "cox's bazar": 'COX',
  coxsbazar: 'COX',
  dinajpur: 'DIN',
  feni: 'FEN',
  jessore: 'JAS',
  jashore: 'JAS',
  kushtia: 'KUS',
  noakhali: 'NOA',
  pabna: 'PAB',
  tangail: 'TAN',
  faridpur: 'FAR',
  kishoreganj: 'KIS',
  manikganj: 'MAN',
  munshiganj: 'MUN',
  narsingdi: 'NSD',
  gopalganj: 'GOP',
  shariatpur: 'SHA',
  madaripur: 'MAD',
  rajbari: 'RJB',
  brahmanbaria: 'BRA',
  chandpur: 'CHA',
  lakshmipur: 'LAK',
  habiganj: 'HAB',
  moulvibazar: 'MOU',
  sunamganj: 'SUN',
  natore: 'NAT',
  naogaon: 'NAO',
  chapainawabganj: 'NWB',
  joypurhat: 'JOY',
  sirajganj: 'SIR',
  bagerhat: 'BAG',
  chuadanga: 'CHU',
  jhenaidah: 'JHE',
  magura: 'MAG',
  meherpur: 'MEH',
  narail: 'NRL',
  satkhira: 'SAT',
  bhola: 'BHO',
  jhalokati: 'JHA',
  patuakhali: 'PAT',
  pirojpur: 'PIR',
  barguna: 'BRG',
  kurigram: 'KUR',
  gaibandha: 'GAI',
  lalmonirhat: 'LAL',
  nilphamari: 'NIL',
  panchagarh: 'PAN',
  thakurgaon: 'THA',
  jamalpur: 'JAM',
  netrokona: 'NET',
  sherpur: 'SHE',
};

export const generateTuitionCustomId = async (district: string): Promise<string> => {
  const cleanDistrict = (district || 'Dhaka').trim().toLowerCase();
  const prefix = DISTRICT_CODE_MAP[cleanDistrict] || cleanDistrict.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'DHA';

  // Count existing records with this prefix to get sequential number
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  const latestWithPrefix = await TuitionJob.findOne({ customId: regex })
    .sort({ createdAt: -1, _id: -1 })
    .select('customId');

  let nextNum = 1;
  if (latestWithPrefix && latestWithPrefix.customId) {
    const match = latestWithPrefix.customId.match(regex);
    if (match && match[1]) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  } else {
    const count = await TuitionJob.countDocuments({ customId: new RegExp(`^${prefix}-`, 'i') });
    nextNum = count + 1;
  }

  let customId = `${prefix}-${String(nextNum).padStart(3, '0')}`;
  let attempt = 0;
  while (await TuitionJob.exists({ customId: new RegExp(`^${customId}$`, 'i') }) && attempt < 500) {
    nextNum++;
    customId = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    attempt++;
  }

  return customId;
};

const buildFilterMatch = (query: ITuitionSearchQuery): Record<string, unknown> => {
  const match: Record<string, unknown> = {
    // 'all' = no approvalStatus filter (admin view); default is 'Approved' for public
    ...(query['approvalStatus'] && query['approvalStatus'] !== 'all'
      ? { approvalStatus: query['approvalStatus'] }
      : query['approvalStatus'] === 'all'
        ? {}
        : { approvalStatus: 'Approved' }),
    ...(query.status && query.status !== 'all'
      ? { status: query.status }
      : query.status === 'all'
        ? {}
        : { status: { $in: ['Open', 'open'] } }),
  };

  // Search by Custom ID (e.g. DHA-001, DHA031, 031, dha 31), MongoDB _id or general keyword
  const searchVal = (query.search || query.jobId || '').trim();
  if (searchVal) {
    if (mongoose.isValidObjectId(searchVal)) {
      match['$or'] = [
        { _id: new mongoose.Types.ObjectId(searchVal) },
        { customId: { $regex: searchVal, $options: 'i' } },
      ];
    } else {
      const escaped = searchVal.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const customIdPatterns: string[] = [escaped];

      // Check if user entered letters + digits (e.g. dha031, dha 031, dha-31, dha31)
      const prefixNumberMatch = searchVal.match(/^([a-zA-Z]+)[\s\-_]*0*(\d+)$/);
      if (prefixNumberMatch) {
        const prefix = prefixNumberMatch[1];
        const num = prefixNumberMatch[2];
        customIdPatterns.push(`^${prefix}[\\s\\-_]*0*${num}$`);
        customIdPatterns.push(`${prefix}[\\s\\-_]*0*${num}`);
      } else {
        const alphaParts = searchVal.match(/[a-zA-Z]+|\d+/g);
        if (alphaParts && alphaParts.length > 1) {
          customIdPatterns.push(alphaParts.join('[\\s\\-_]*0*'));
        }
      }

      // Check if user entered pure digits (e.g. 031, 31, 1)
      const pureDigitsMatch = searchVal.match(/^0*(\d+)$/);
      if (pureDigitsMatch) {
        const num = pureDigitsMatch[1];
        customIdPatterns.push(`[\\s\\-_]0*${num}$`);
        customIdPatterns.push(`0*${num}$`);
      }

      // Flexible separators for multi-word or hyphenated inputs (e.g. dha - 031)
      const flexibleParts = searchVal.split(/[\s\-_]+/).filter(Boolean).map(p => p.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'));
      if (flexibleParts.length > 1) {
        customIdPatterns.push(flexibleParts.join('[\\s\\-_]*'));
      }

      const combinedCustomIdRegex = Array.from(new Set(customIdPatterns)).join('|');

      match['$or'] = [
        { customId: { $regex: combinedCustomIdRegex, $options: 'i' } },
        { 'location.district': { $regex: escaped, $options: 'i' } },
        { 'location.area': { $regex: escaped, $options: 'i' } },
        { 'location.upazila': { $regex: escaped, $options: 'i' } },
        { 'location.detailedAddress': { $regex: escaped, $options: 'i' } },
        { subjects: { $elemMatch: { $regex: escaped, $options: 'i' } } },
        { studentClass: { $regex: escaped, $options: 'i' } },
        { medium: { $regex: escaped, $options: 'i' } },
        { tuitionType: { $regex: escaped, $options: 'i' } },
      ];
    }
  }

  if (query.district && query.district !== 'All') {
    match['location.district'] = query.district.trim();
  }
  if (query.area && query.area !== 'All') {
    match['location.area'] = { $regex: query.area.trim(), $options: 'i' };
  }
  const sub = query.subject || query.category;
  if (sub && sub !== 'All') {
    match['subjects'] = sub.trim();
  }
  if (query.medium && query.medium !== 'All') {
    match['medium'] = query.medium.trim();
  }
  if (query.studentClass && query.studentClass !== 'All') {
    match['studentClass'] = query.studentClass.trim();
  }
  if (query.tuitionType && query.tuitionType !== 'All') {
    match['tuitionType'] = query.tuitionType.trim();
  }
  const gender = query.genderPreference || query.gender;
  if (gender && gender !== 'All' && gender !== 'Any') {
    match['genderPreference'] = { $in: [gender.trim(), 'Any'] };
  }

  if (query.minSalary || query.maxSalary) {
    const salaryFilter: Record<string, number> = {};
    if (query.minSalary) salaryFilter['$gte'] = parseInt(query.minSalary, 10);
    if (query.maxSalary) salaryFilter['$lte'] = parseInt(query.maxSalary, 10);
    match['salary'] = salaryFilter;
  }

  return match;
};

const getAllJobs = async (query: ITuitionSearchQuery) => {
  const cacheKey = `jobs:${JSON.stringify(query)}`;
  const cached = await CacheService.getCache<{ data: any[]; meta: any }>(cacheKey);
  if (cached) return cached;

  const limitNum = Math.min(1000, Math.max(1, parseInt(query.limit ?? '20', 10)));
  const sortMode = resolveSortMode(query.sortBy || 'createdAt', query.sortOrder || 'desc');
  const sortStage = buildSortStage(sortMode);
  const filterMatch = buildFilterMatch(query);

  const userLookup = {
    $lookup: {
      from: 'users',
      localField: 'postedBy',
      foreignField: '_id',
      as: 'postedByUser',
      pipeline: [{ $project: { name: 1, phone: 1, avatar: 1, email: 1, role: 1 } }],
    },
  };

  let resultData: { data: any[]; meta: any };

  if (isPaginationCursor(query)) {
    const decoded = decodeCursor(query.cursor!);
    if (!decoded) throw new AppError(400, 'Invalid cursor value!');

    const cursorMatch = buildCursorMatchStage(decoded, sortMode);

    const pipeline = [
      { $match: filterMatch },
      { $match: cursorMatch },
      { $sort: sortStage },
      { $limit: limitNum + 1 },
      userLookup,
      { $unwind: { path: '$postedByUser', preserveNullAndEmptyArrays: true } },
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

    resultData = { data, meta };
  } else {
    const pageNum = Math.max(1, parseInt(query.page ?? '1', 10));
    const skip = (pageNum - 1) * limitNum;

    const pipeline = [
      { $match: filterMatch },
      { $sort: sortStage },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum },
            userLookup,
            { $unwind: { path: '$postedByUser', preserveNullAndEmptyArrays: true } },
          ],
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

    resultData = { data: result?.data ?? [], meta };
  }

  // Cache public job search results (TTL: 5 minutes)
  await CacheService.setCache(cacheKey, resultData, CACHE_TTL.SEARCH_JOBS);

  return resultData;
};

const getJobById = async (id: string) => {
  let query: Record<string, unknown> = {};
  if (mongoose.isValidObjectId(id)) {
    query = { $or: [{ _id: new mongoose.Types.ObjectId(id) }, { customId: id.toUpperCase() }] };
  } else {
    query = { customId: id.toUpperCase() };
  }

  const job = await TuitionJob.findOne(query).populate('postedBy', 'name email phone avatar');
  if (!job) throw new AppError(404, 'Tuition job not found!');
  return job;
};

const createJob = async (
  postedBy?: string,
  payload: Partial<ITuitionJob> & {
    phone?: string;
    name?: string;
    contactName?: string;
    whatsappNumber?: string;
    universityPreference?: string;
    location?: any;
  } = {},
) => {
  let finalPostedBy = postedBy;

  if (!finalPostedBy) {
    if (payload.phone) {
      const rawPhone = payload.phone.trim();
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      const phoneSuffix = cleanPhone.slice(-10);
      let existingUser = await User.findOne({
        $or: [
          { phone: rawPhone },
          ...(phoneSuffix ? [{ phone: new RegExp(`${phoneSuffix}$`) }] : []),
        ],
      });
      if (!existingUser) {
        const randomPass = `Guest@${cleanPhone || '1234'}`;
        existingUser = await User.create({
          name: payload.contactName || payload.name || `Guardian (${cleanPhone.slice(-4) || 'Guest'})`,
          phone: rawPhone,
          password: randomPass,
          role: 'guardian',
          isEmailVerified: false,
          isPhoneVerified: true,
          isApproved: true,
          status: 'active',
        });

        // Instant push notification to all admins & moderators
        NotificationService.notifyStaffOnNewUserRegistration({
          _id: existingUser._id,
          name: existingUser.name,
          phone: existingUser.phone,
          role: 'guardian',
        }).catch((err) => console.warn('⚠️ Staff guest registration notification error:', err));
      }
      finalPostedBy = String(existingUser._id);
    } else {
      const adminUser = await User.findOne({ role: { $in: ['super_admin', 'admin'] } });
      if (adminUser) {
        finalPostedBy = String(adminUser._id);
      }
    }
  }

  if (!finalPostedBy) {
    throw new AppError(400, 'Could not determine user account for this tutor request.');
  }

  // Normalize location — preserve all BD Geo fields
  let location: any = { district: 'Dhaka', area: 'All Areas' };
  if (typeof payload.location === 'object' && payload.location !== null) {
    location = {
      division:        payload.location.division || '',
      district:        payload.location.district || 'Dhaka',
      upazila:         payload.location.upazila || '',
      union:           payload.location.union || '',
      ward:            payload.location.ward || '',
      area:            payload.location.area || 'All Areas',
      detailedAddress: payload.location.detailedAddress || '',
    };
  } else if (typeof payload.location === 'string') {
    location = {
      district: payload.location || 'Dhaka',
      area:     (payload as any).area || 'All Areas',
    };
  }

  // Normalize salary & salary range
  const rawSalaryInput = (payload as any).salaryOffer ?? payload.salary ?? payload.salaryRange;
  const isNegotiableInput = (payload as any).negotiable || (payload as any).salaryNegotiable || rawSalaryInput === 'Negotiable' || rawSalaryInput === '0' || rawSalaryInput === 0;
  
  let salary = 5000;
  let salaryMax: number | undefined = undefined;
  let salaryRange: string | undefined = undefined;
  let negotiable = Boolean(isNegotiableInput);

  if (negotiable) {
    salary = 0;
    salaryRange = 'Negotiable';
  } else if (typeof rawSalaryInput === 'string' && rawSalaryInput.includes('-')) {
    const parts = rawSalaryInput.split('-').map((p: string) => parseInt(p.replace(/[^0-9]/g, ''), 10)).filter((n: number) => !isNaN(n));
    if (parts.length >= 2) {
      const minVal = parts[0] ?? 5000;
      const maxVal = parts[1] ?? minVal;
      salary = Math.min(minVal, maxVal);
      salaryMax = Math.max(minVal, maxVal);
      salaryRange = `${salary}-${salaryMax}`;
    } else if (parts.length === 1) {
      salary = parts[0] ?? 5000;
      salaryRange = String(salary);
    }
  } else if (typeof rawSalaryInput === 'number' && !isNaN(rawSalaryInput)) {
    salary = rawSalaryInput;
    salaryRange = String(rawSalaryInput);
  } else if (rawSalaryInput) {
    salary = parseInt(String(rawSalaryInput).replace(/[^0-9]/g, ''), 10) || 5000;
    salaryRange = String(salary);
  }

  if ((payload as any).salaryMax && typeof (payload as any).salaryMax === 'number') {
    salaryMax = (payload as any).salaryMax;
    salaryRange = `${salary}-${salaryMax}`;
  }

  // Normalize subjects
  const subjects = Array.isArray(payload.subjects) && payload.subjects.length > 0
    ? payload.subjects
    : ['All Subjects'];

  // Generate customized Tuition ID (e.g. DHA-001, CTG-001, RAJ-001)
  const customId = payload.customId || (await generateTuitionCustomId(location.district));

  const createPayload: Record<string, any> = {
    ...payload,
    customId,
    postedBy: finalPostedBy,
    location,
    salary,
    salaryMax,
    salaryRange,
    negotiable,
    subjects,
    studentClass: payload.studentClass || 'Class 10',
    medium: payload.medium || 'Bangla Medium',
    tuitionType: payload.tuitionType || 'Home Tuition',
    genderPreference: payload.genderPreference || 'Any',
    tutoringDays: Array.isArray(payload.tutoringDays) ? payload.tutoringDays : [payload.tutoringDays || '3 Days/Week'],
    universityPreference: payload.universityPreference || '',
    phone: payload.phone || '',
    whatsappNumber: payload.whatsappNumber || '',
    contactName: payload.contactName || payload.name || '',
    description: payload.description || '',
    status: 'Open',
    approvalStatus: 'Approved',
  };

  const job = (await TuitionJob.create(createPayload)) as any;

  // Trigger background Auto Matching worker!
  try {
    addMatchingJob({
      jobId: String(job._id),
      triggeredBy: 'job_created',
    });
  } catch (err) {
    console.warn('⚠️ Auto matching queue error (non-fatal):', err);
  }

  // Send notification to all staff (Super Admin, Admin, Moderator) about new tuition job
  try {
    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } }).select('_id');
    const poster = await User.findById(finalPostedBy).select('name');
    const posterName = poster?.name || 'A user';

    await Promise.all(
      staffUsers.map((staff) =>
        NotificationService.createNotification({
          userId: String(staff._id),
          type: 'tuition_job',
          title: `New Tuition Job [${job.customId}]`,
          message: `${posterName} posted tuition job #${job.customId} for ${job.studentClass} (${location.area}, ${location.district} - ৳${salary})`,
          referenceId: String(job._id),
          referenceType: 'TuitionJob',
        }).catch((err) => console.warn(`⚠️ Staff notification failed for ${staff._id}:`, err)),
      ),
    );
  } catch (notifErr) {
    console.warn('⚠️ Staff notification error on job creation (non-fatal):', notifErr);
  }

  // Invalidate jobs cache
  await CacheService.invalidatePattern('jobs:*');

  return job;
};

const updateJob = async (id: string, userId: string, userRole: string, payload: Partial<ITuitionJob>) => {
  const job = await TuitionJob.findById(id);
  if (!job) throw new AppError(404, 'Tuition job not found!');
  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to update this job!');
  }

  // 🛡️ Moderator Protection: Moderator cannot edit jobs created by Admin or Super Admin
  if (userRole === 'moderator') {
    const posterUser = await User.findById(job.postedBy).select('role');
    if (posterUser && ['admin', 'super_admin'].includes(posterUser.role)) {
      throw new AppError(403, 'মডারেটর হিসেবে আপনি এডমিনের তৈরি করা টিউশন পোস্ট পরিবর্তন বা এডিট করতে পারবেন না।');
    }
  }

  const cleanPayload: any = { ...payload };

  // Parse salary / salary range if provided
  if (cleanPayload.salary !== undefined || cleanPayload.salaryOffer !== undefined || cleanPayload.salaryRange !== undefined || cleanPayload.negotiable !== undefined) {
    const rawSal = cleanPayload.salaryOffer ?? cleanPayload.salaryRange ?? cleanPayload.salary;
    const isNeg = cleanPayload.negotiable || cleanPayload.salaryNegotiable || rawSal === 'Negotiable' || rawSal === '0' || rawSal === 0;
    if (isNeg) {
      cleanPayload.salary = 0;
      cleanPayload.salaryMax = undefined;
      cleanPayload.salaryRange = 'Negotiable';
      cleanPayload.negotiable = true;
    } else if (typeof rawSal === 'string' && rawSal.includes('-')) {
      const parts = rawSal.split('-').map((p: string) => parseInt(p.replace(/[^0-9]/g, ''), 10)).filter((n: number) => !isNaN(n));
      if (parts.length >= 2) {
        const minVal = parts[0] ?? 5000;
        const maxVal = parts[1] ?? minVal;
        cleanPayload.salary = Math.min(minVal, maxVal);
        cleanPayload.salaryMax = Math.max(minVal, maxVal);
        cleanPayload.salaryRange = `${cleanPayload.salary}-${cleanPayload.salaryMax}`;
        cleanPayload.negotiable = false;
      } else if (parts.length === 1) {
        cleanPayload.salary = parts[0] ?? 5000;
        cleanPayload.salaryMax = undefined;
        cleanPayload.salaryRange = String(cleanPayload.salary);
        cleanPayload.negotiable = false;
      }
    } else if (typeof rawSal === 'number' && !isNaN(rawSal)) {
      cleanPayload.salary = rawSal;
      cleanPayload.salaryRange = String(rawSal);
      cleanPayload.negotiable = false;
    } else if (rawSal) {
      cleanPayload.salary = parseInt(String(rawSal).replace(/[^0-9]/g, ''), 10) || 5000;
      cleanPayload.salaryRange = String(cleanPayload.salary);
      cleanPayload.negotiable = false;
    }
  }

  // Sanitize universityPreference
  if (Array.isArray(cleanPayload.universityPreference)) {
    cleanPayload.universityPreference = cleanPayload.universityPreference.flat(Infinity).find((u: any) => typeof u === 'string' && u.trim() !== '') || '';
  } else if (cleanPayload.universityPreference !== undefined) {
    cleanPayload.universityPreference = String(cleanPayload.universityPreference || '').trim();
  }

  // Sanitize requirements
  if (cleanPayload.requirements !== undefined) {
    if (Array.isArray(cleanPayload.requirements)) {
      cleanPayload.requirements = cleanPayload.requirements.flat(Infinity).filter((r: any) => typeof r === 'string' && r.trim() !== '');
    } else if (typeof cleanPayload.requirements === 'string' && cleanPayload.requirements.trim()) {
      cleanPayload.requirements = [cleanPayload.requirements.trim()];
    } else {
      cleanPayload.requirements = [];
    }
  }

  // Sanitize tutoringDays
  if (cleanPayload.tutoringDays !== undefined) {
    if (Array.isArray(cleanPayload.tutoringDays)) {
      cleanPayload.tutoringDays = cleanPayload.tutoringDays.flat(Infinity).filter((d: any) => typeof d === 'string' && d.trim() !== '');
    } else if (typeof cleanPayload.tutoringDays === 'string' && cleanPayload.tutoringDays.trim()) {
      cleanPayload.tutoringDays = [cleanPayload.tutoringDays.trim()];
    }
  }

  // Sanitize subjects
  if (cleanPayload.subjects !== undefined) {
    if (Array.isArray(cleanPayload.subjects)) {
      cleanPayload.subjects = cleanPayload.subjects.flat(Infinity).filter((s: any) => typeof s === 'string' && s.trim() !== '');
    } else if (typeof cleanPayload.subjects === 'string' && cleanPayload.subjects.trim()) {
      cleanPayload.subjects = [cleanPayload.subjects.trim()];
    }
  }

  const updatedJob = await TuitionJob.findByIdAndUpdate(id, { $set: cleanPayload }, { new: true });

  // Re-run matching if core criteria modified
  if (
    cleanPayload.subjects ||
    cleanPayload.location ||
    cleanPayload.salary ||
    cleanPayload.salaryMax ||
    cleanPayload.medium ||
    cleanPayload.studentClass ||
    cleanPayload.genderPreference
  ) {
    addMatchingJob({
      jobId: id,
      triggeredBy: 'manual_rematch',
    });
  }

  // Invalidate jobs cache
  await CacheService.invalidatePattern('jobs:*');

  return updatedJob;
};

const deleteJob = async (id: string, userId: string, userRole: string) => {
  const job = await TuitionJob.findById(id);
  if (!job) throw new AppError(404, 'Tuition job not found!');
  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to delete this job!');
  }

  // 🛡️ Moderator Protection: Moderator cannot delete jobs created by Admin or Super Admin
  if (userRole === 'moderator') {
    const posterUser = await User.findById(job.postedBy).select('role');
    if (posterUser && ['admin', 'super_admin'].includes(posterUser.role)) {
      throw new AppError(403, 'মডারেটর হিসেবে আপনি এডমিনের তৈরি করা টিউশন পোস্ট মুছে ফেলতে পারবেন না।');
    }
  }

  await TuitionJob.findByIdAndDelete(id);

  // Invalidate jobs cache
  await CacheService.invalidatePattern('jobs:*');

  return { message: 'Tuition job deleted successfully.' };
};

const applyToJob = async (
  jobId: string,
  tutorUserId: string,
  payload: {
    expectedSalary?: number;
    coverLetter?: string;
    availableTime?: string[];
    signatureImage?: string;
    ipAddress?: string;
    userAgent?: string;
    agreedToTerms?: boolean;
  } = {},
) => {
  const job = await TuitionJob.findById(jobId);
  if (!job) throw new AppError(404, 'Tuition job not found!');
  if (job.status !== 'Open') throw new AppError(400, 'This job is no longer open!');

  const existing = await Application.findOne({ jobId, tutorId: tutorUserId });
  if (existing) throw new AppError(400, 'You have already applied for this job!');

  // Strict verification & profile completeness check: Tutor must complete all 5 profile sections
  const tutorProfile = await Tutor.findOne({ userId: tutorUserId });
  if (!tutorProfile) {
    throw new AppError(400, 'অনুগ্রহ করে প্রথমে আপনার টিউটর প্রোফাইল সম্পূর্ণ করুন।');
  }

  // ── 1. Educational Info Check
  const hasEducational = Boolean(
    (tutorProfile.university && (tutorProfile.department || tutorProfile.qualification)) ||
    ((tutorProfile as any).sscInstitute && (tutorProfile as any).sscResult) ||
    ((tutorProfile as any).hscInstitute && (tutorProfile as any).hscResult) ||
    ((tutorProfile as any).gradInstitute && (tutorProfile as any).gradDept)
  );
  if (!hasEducational) {
    throw new AppError(400, 'টিউশন জবে আবেদনের পূর্বে আপনার শিক্ষাগত তথ্য (Educational Info) সম্পূর্ণ করুন।');
  }

  // ── 2. Tuition Info Check
  const hasTuitionInfo = Boolean(
    (Array.isArray(tutorProfile.subjects) && tutorProfile.subjects.length > 0) &&
    (
      (Array.isArray(tutorProfile.preferredAreas) && tutorProfile.preferredAreas.length > 0) ||
      (tutorProfile.location?.district) ||
      (Array.isArray(tutorProfile.mediums) && tutorProfile.mediums.length > 0) ||
      (Array.isArray(tutorProfile.preferredClasses) && tutorProfile.preferredClasses.length > 0)
    )
  );
  if (!hasTuitionInfo) {
    throw new AppError(400, 'টিউশন জবে আবেদনের পূর্বে আপনার টিউশন পছন্দসমূহ (Tuition Info) সম্পূর্ণ করুন।');
  }

  // ── 3. Personal Info Check
  const tutorUser = await User.findById(tutorUserId);
  const hasPersonalInfo = Boolean(
    (tutorUser?.name || (tutorProfile as any).fullName) &&
    (tutorUser?.phone || (tutorProfile as any).phone) &&
    (tutorProfile.gender)
  );
  if (!hasPersonalInfo) {
    throw new AppError(400, 'টিউশন জবে আবেদনের পূর্বে আপনার ব্যক্তিগত তথ্য (Personal Info) সম্পূর্ণ করুন।');
  }

  // ── 4. Documents Info Check
  const hasDocuments = Boolean(
    tutorProfile.nid &&
    tutorProfile.nidCard &&
    tutorProfile.studentIdCard
  );
  if (!hasDocuments) {
    throw new AppError(
      403,
      'টিউশন জবে আবেদন করার জন্য আপনার NID নাম্বার, NID কার্ডের ছবি এবং স্টুডেন্ট আইডি কার্ড আপলোড করতে হবে।',
    );
  }

  // ── 5. Verification Info (Admin Approval) Check
  if (!tutorProfile.isVerified) {
    if (tutorProfile.verificationStatus === 'Pending') {
      throw new AppError(
        403,
        'আপনার ভেরিফিকেশন আবেদনটি বর্তমানে অ্যাডমিন রিভিউতে রয়েছে। অ্যাডমিন অনুমোদন করার পর আপনি টিউশন জবে আবেদন করতে পারবেন।',
      );
    }
    if (tutorProfile.verificationStatus === 'Rejected') {
      throw new AppError(
        403,
        'আপনার ভেরিফিকেশন আবেদনটি প্রত্যাখ্যাত হয়েছে। অনুগ্রহ করে প্রোফাইল থেকে পুনরায় সঠিক ডকুমেন্টস আপলোড করে ভেরিফিকেশন সাবমিট করুন।',
      );
    }
    throw new AppError(
      403,
      'টিউশন জবে আবেদন করার জন্য প্রোফাইলের Verification ট্যাবে গিয়ে আবেদনটি সাবমিট করুন এবং অ্যাডমিন অনুমোদনের অপেক্ষা করুন।',
    );
  }

  // Calculate Match Score for this tutor
  let matchScore = 0;
  let isAutoShortlisted = false;

  if (tutorProfile) {
    const matcher = new RuleBasedMatcher();
    const matchResult = await matcher.calculate(job.toObject(), tutorProfile.toObject());
    matchScore = matchResult.score;

    // Check if tutor was already in job's shortlistedTutors list
    if (job.shortlistedTutors && job.shortlistedTutors.length > 0) {
      isAutoShortlisted = job.shortlistedTutors.some(
        (st) => String(st.tutorId) === String(tutorProfile._id),
      );
    }
  }

  const salary = Number(payload.expectedSalary ?? job.salary);
  const mediaFee = Math.round(salary * 0.60); // 60% of Tuition Monthly Salary

  const customJobId = job.customId || `JOB-${String(job._id).slice(-6).toUpperCase()}`;
  const timestampHash = Date.now().toString(36).toUpperCase();
  const contractId = `TMC/${customJobId}/${timestampHash}`;
  const signedAt = new Date();

  const rawIp = payload.ipAddress || '127.0.0.1';
  const rawUserAgent = payload.userAgent || 'Web Browser';

  // Generate SHA-256 Cryptographic Lock Code
  const securityHash = crypto
    .createHash('sha256')
    .update(`${tutorUserId}|${jobId}|${salary}|${mediaFee}|${rawIp}|${signedAt.toISOString()}`)
    .digest('hex');

  const locArea = typeof job.location === 'object' ? (job.location?.area || '') : ((job as any).area || '');
  const locDistrict = typeof job.location === 'object' ? (job.location?.district || '') : (typeof job.location === 'string' ? job.location : '');

  const application = await Application.create({
    jobId,
    tutorId: tutorUserId,
    expectedSalary: salary,
    coverLetter: payload.coverLetter || '',
    availableTime: payload.availableTime || [],
    matchScore,
    isAutoShortlisted,
    status: 'Pending',

    // Digital Legal Contract Deed Data
    contractId,
    signatureImage: payload.signatureImage || '',
    ipAddress: rawIp,
    userAgent: rawUserAgent,
    signedAt,
    mediaFee,
    securityHash,
    agreedToTerms: Boolean(payload.agreedToTerms),
    tutorSnapshot: {
      name: tutorUser?.name || 'Tutor',
      email: tutorUser?.email || '',
      phone: tutorUser?.phone || '',
      nid: tutorProfile.nid || '',
      nidCard: tutorProfile.nidCard || '',
      studentIdCard: tutorProfile.studentIdCard || '',
      university: tutorProfile.university || '',
      department: tutorProfile.department || '',
      qualification: tutorProfile.qualification || '',
      permanentAddress: (tutorProfile as any)?.permanentAddress || (tutorProfile?.location ? `${tutorProfile.location?.area || ''}, ${tutorProfile.location?.district || ''}` : ''),
      emergencyPhone: (tutorProfile as any)?.emergencyPhone || (tutorProfile as any)?.parentPhone || tutorUser?.phone || '',
      avatar: tutorUser?.avatar || '',
    },
    tuitionSnapshot: {
      customId: customJobId,
      studentClass: job.studentClass || '',
      medium: job.medium || '',
      salary,
      mediaFee,
      location: locDistrict,
      area: locArea,
      subjects: job.subjects || [],
    },
  });

  // Notify guardian who posted the job
  const tutorName = tutorUser?.name || 'একজন টিউটর';

  await NotificationService.createNotification({
    userId: String(job.postedBy),
    type: 'application',
    title: 'নতুন টিউশন আবেদন',
    message: `${tutorName} আপনার পোস্ট করা টিউশন জবে আবেদন করেছেন।`,
    referenceId: jobId,
    referenceType: 'TuitionJob',
  });

  // Notify all staff (Super Admin, Admin, Moderator)
  try {
    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } }).select('_id');
    await Promise.all(
      staffUsers.map((staff) =>
        NotificationService.createNotification({
          userId: String(staff._id),
          type: 'application',
          title: 'টিউশন জব আবেদন জমা হয়েছে',
          message: `${tutorName} (${tutorUser?.email || ''}) একটি টিউশন জবে (${job.medium} - ৳${job.salary}) আবেদন করেছেন।`,
          referenceId: jobId,
          referenceType: 'TuitionJob',
        }).catch((err) => console.warn(`⚠️ Staff notification failed for ${staff._id}:`, err)),
      ),
    );
  } catch (err) {
    console.warn('⚠️ Staff notification error on job application:', err);
  }

  return application;
};

const getShortlistedTutors = async (jobId: string, userId: string, userRole: string) => {
  let job = await TuitionJob.findById(jobId).populate({
    path: 'shortlistedTutors.tutorId',
    populate: { path: 'userId', select: 'name email phone avatar status' },
  });

  if (!job) throw new AppError(404, 'Tuition job not found!');

  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to view shortlisted tutors for this job.');
  }

  // If shortlist is empty, run matching engine on the fly immediately!
  if (!job.shortlistedTutors || job.shortlistedTutors.length === 0) {
    try {
      const blockedUserIds = await User.find({ status: 'blocked' }).distinct('_id');
      const tutors = await Tutor.find({
        userId: { $nin: blockedUserIds },
      }).lean();

      if (tutors.length > 0) {
        const { MatchingEngine } = await import('../../services/matching.service.js');
        const topMatches = await MatchingEngine.run(job.toObject(), tutors as any, 5);

        if (topMatches.length > 0) {
          const newShortlist = topMatches.map((match) => ({
            tutorId: new mongoose.Types.ObjectId(match.tutorId),
            score: match.score,
            matchDetails: match.matchDetails,
            shortlistedAt: new Date(),
          }));

          await TuitionJob.findByIdAndUpdate(jobId, {
            shortlistedTutors: newShortlist,
            matchingRunAt: new Date(),
          });

          // Reload populated job
          const reloaded = await TuitionJob.findById(jobId).populate({
            path: 'shortlistedTutors.tutorId',
            populate: { path: 'userId', select: 'name email phone avatar status' },
          });
          if (reloaded) {
            job = reloaded;
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ On-demand matching calculation error:', err);
    }
  }

  // Privacy Protection: Mask sensitive contact details (phone, email, NID) before confirmation
  const isStaffUser = ['admin', 'super_admin', 'moderator'].includes(userRole);
  const sanitizedShortlist = (job.shortlistedTutors || []).map((st: any) => {
    const rawObj = st.toObject ? st.toObject() : st;
    const tutorDoc = rawObj.tutorId || {};
    const userDoc = tutorDoc.userId || {};

    if (!isStaffUser) {
      return {
        ...rawObj,
        tutorId: {
          ...tutorDoc,
          nid: undefined,
          nidCard: undefined,
          studentIdCard: undefined,
          cv: undefined,
          certificates: undefined,
          userId: {
            _id: userDoc._id,
            name: userDoc.name || 'Registered Tutor',
            avatar: userDoc.avatar || '',
            phone: '🔒 টিউশন নিশ্চিত করার পর দৃশ্যমান হবে',
            email: '🔒 Hidden',
            status: userDoc.status,
          },
        },
      };
    }
    return rawObj;
  });

  return {
    jobId: job._id,
    matchingRunAt: job.matchingRunAt,
    shortlistedTutors: sanitizedShortlist,
  };
};

const rematchJob = async (jobId: string, userId: string, userRole: string) => {
  const job = await TuitionJob.findById(jobId);
  if (!job) throw new AppError(404, 'Tuition job not found!');

  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to re-run matching for this job.');
  }

  await addMatchingJob({
    jobId,
    triggeredBy: 'manual_rematch',
  });

  return { message: 'Auto Matching triggered in background. Shortlist will update momentarily.' };
};

export const TuitionService = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  applyToJob,
  getShortlistedTutors,
  rematchJob,
};
