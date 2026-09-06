import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { AppError } from '../../errors/AppError.js';
import { addMatchingJob } from '../../jobs/matching.queue.js';
import { RuleBasedMatcher } from '../../services/matching.service.js';
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
  while (await TuitionJob.exists({ customId }) && attempt < 100) {
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
      : {}),
  };

  // Search by Custom ID (e.g. DHA-001), MongoDB _id or general keyword
  const searchVal = (query.search || query.jobId || '').trim();
  if (searchVal) {
    if (mongoose.isValidObjectId(searchVal)) {
      match['$or'] = [
        { _id: new mongoose.Types.ObjectId(searchVal) },
        { customId: { $regex: searchVal, $options: 'i' } },
      ];
    } else {
      match['$or'] = [
        { customId: { $regex: searchVal, $options: 'i' } },
        { 'location.district': { $regex: searchVal, $options: 'i' } },
        { 'location.area': { $regex: searchVal, $options: 'i' } },
        { subjects: { $elemMatch: { $regex: searchVal, $options: 'i' } } },
        { studentClass: { $regex: searchVal, $options: 'i' } },
        { medium: { $regex: searchVal, $options: 'i' } },
      ];
    }
  }

  if (query.district && query.district !== 'All') {
    match['location.district'] = { $regex: query.district, $options: 'i' };
  }
  if (query.area && query.area !== 'All') {
    match['location.area'] = { $regex: query.area, $options: 'i' };
  }
  const sub = query.subject || query.category;
  if (sub && sub !== 'All') {
    match['subjects'] = { $elemMatch: { $regex: sub, $options: 'i' } };
  }
  if (query.medium && query.medium !== 'All') {
    match['medium'] = { $regex: query.medium, $options: 'i' };
  }
  if (query.studentClass && query.studentClass !== 'All') {
    match['studentClass'] = { $regex: query.studentClass, $options: 'i' };
  }
  if (query.tuitionType && query.tuitionType !== 'All') {
    match['tuitionType'] = { $regex: query.tuitionType, $options: 'i' };
  }
  const gender = query.genderPreference || query.gender;
  if (gender && gender !== 'All' && gender !== 'Any') {
    match['genderPreference'] = { $in: [new RegExp(gender, 'i'), 'Any'] };
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
  const limitNum = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10)));
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

  const applicationsLookup = {
    $lookup: {
      from: 'applications',
      localField: '_id',
      foreignField: 'jobId',
      as: 'applications',
      pipeline: [
        {
          $lookup: {
            from: 'users',
            localField: 'tutorId',
            foreignField: '_id',
            as: 'tutor',
            pipeline: [{ $project: { name: 1, phone: 1, avatar: 1, email: 1 } }],
          },
        },
        { $unwind: { path: '$tutor', preserveNullAndEmptyArrays: true } },
      ],
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
      applicationsLookup,
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
    applicationsLookup,
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
      let existingUser = await User.findOne({ phone: payload.phone });
      if (!existingUser) {
        const cleanPhone = payload.phone.replace(/[^0-9]/g, '');
        const randomPass = `Guest@${cleanPhone || '1234'}`;
        existingUser = await User.create({
          name: payload.contactName || payload.name || `Guardian (${cleanPhone.slice(-4) || 'Guest'})`,
          phone: payload.phone,
          // No auto-generated email: will be undefined and display as N/A
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

  // Normalize salary
  const salary = typeof payload.salary === 'number' && !isNaN(payload.salary)
    ? payload.salary
    : parseInt(String(payload.salary || 5000), 10) || 5000;

  // Normalize subjects
  const subjects = Array.isArray(payload.subjects) && payload.subjects.length > 0
    ? payload.subjects
    : ['All Subjects'];

  // Generate customized Tuition ID (e.g. DHA-001, CTG-001, RAJ-001)
  const customId = payload.customId || (await generateTuitionCustomId(location.district));

  const job = await TuitionJob.create({
    ...payload,
    customId,
    postedBy: finalPostedBy,
    location,
    salary,
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
  });

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
    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } });
    const poster = await User.findById(finalPostedBy);
    for (const staff of staffUsers) {
      await NotificationService.createNotification({
        userId: String(staff._id),
        type: 'tuition_job',
        title: `New Tuition Job [${job.customId}]`,
        message: `${poster?.name || 'A user'} posted tuition job #${job.customId} for ${job.studentClass} (${location.area}, ${location.district} - ৳${salary})`,
        referenceId: String(job._id),
        referenceType: 'TuitionJob',
      });
    }
  } catch (notifErr) {
    console.warn('⚠️ Staff notification error on job creation (non-fatal):', notifErr);
  }

  return job;
};

const updateJob = async (id: string, userId: string, userRole: string, payload: Partial<ITuitionJob>) => {
  const job = await TuitionJob.findById(id);
  if (!job) throw new AppError(404, 'Tuition job not found!');
  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to update this job!');
  }

  const cleanPayload: any = { ...payload };

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
    cleanPayload.medium ||
    cleanPayload.studentClass ||
    cleanPayload.genderPreference
  ) {
    addMatchingJob({
      jobId: id,
      triggeredBy: 'manual_rematch',
    });
  }

  return updatedJob;
};

const deleteJob = async (id: string, userId: string, userRole: string) => {
  const job = await TuitionJob.findById(id);
  if (!job) throw new AppError(404, 'Tuition job not found!');
  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to delete this job!');
  }
  await TuitionJob.findByIdAndDelete(id);
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

  // Strict verification check: Tutor must be verified by admin
  const tutorProfile = await Tutor.findOne({ userId: tutorUserId });
  if (!tutorProfile) {
    throw new AppError(400, 'অনুগ্রহ করে প্রথমে আপনার টিউটর প্রোফাইল সম্পূর্ণ করুন।');
  }

  if (!tutorProfile.isVerified) {
    if (!tutorProfile.nidCard || !tutorProfile.studentIdCard) {
      throw new AppError(
        403,
        'টিউশন জবে আবেদন করার জন্য আপনার NID কার্ড এবং স্টুডেন্ট/টিউটর আইডি কার্ড আপলোড করে প্রোফাইল ভেরিফাই করতে হবে।',
      );
    }
    throw new AppError(
      403,
      'আপনার ভেরিফিকেশন আবেদনটি বর্তমানে অ্যাডমিন রিভিউতে রয়েছে। অ্যাডমিন অনুমোদন করার পর আপনি টিউশন জবে আবেদন করতে পারবেন।',
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

  const tutorUser = await User.findById(tutorUserId);
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
    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } });
    for (const staff of staffUsers) {
      await NotificationService.createNotification({
        userId: String(staff._id),
        type: 'application',
        title: 'টিউশন জব আবেদন জমা হয়েছে',
        message: `${tutorName} (${tutorUser?.email || ''}) একটি টিউশন জবে (${job.medium} - ৳${job.salary}) আবেদন করেছেন।`,
        referenceId: jobId,
        referenceType: 'TuitionJob',
      });
    }
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
