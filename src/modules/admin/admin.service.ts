import { NotificationService } from '../notification/notification.service.js';
import { AppError } from '../../errors/AppError.js';
import { Application } from '../application/application.model.js';
import { Payment, Withdrawal } from '../payment/payment.model.js';
import { TuitionJob } from '../tuition/tuition.model.js';
import { Tutor } from '../tutor/tutor.model.js';
import { User } from '../user/user.model.js';
import { Verification } from '../verification/verification.model.js';
import { Coaching } from '../coaching/coaching.model.js';
import { CacheService } from '../../services/cache.service.js';

const getDashboardStats = async () => {
  const cacheKey = 'admin:dashboard:stats';
  const cached = await CacheService.getCache<any>(cacheKey);
  if (cached) return cached;

  const [
    totalUsers,
    totalTutors,
    totalStudents,
    totalGuardians,
    totalCoaching,
    totalJobs,
    totalApplications,
    pendingVerifications,
    pendingJobs,
    pendingWithdrawals,
    activeTuitions,
    closedTuitions,
    recentJobsDocs,
    recentApplicationsDocs,
    recentUsersDocs,
  ] = await Promise.all([
    User.countDocuments({ role: { $nin: ['super_admin', 'admin', 'moderator'] } }),
    User.countDocuments({ role: 'tutor' }),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'guardian' }),
    User.countDocuments({ role: 'coaching' }),
    TuitionJob.countDocuments(),
    Application.countDocuments(),
    Verification.countDocuments({ status: 'Pending' }),
    TuitionJob.countDocuments({ approvalStatus: 'Pending' }),
    Withdrawal.countDocuments({ status: 'Pending' }),
    TuitionJob.countDocuments({
      status: { $in: ['Matched', 'Running', 'Active', 'Confirmed', 'Hired', 'matched', 'hired', 'active'] },
    } as any),
    TuitionJob.countDocuments({
      status: { $in: ['Closed', 'closed', 'Cancelled', 'cancelled'] },
    } as any),
    TuitionJob.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('customId studentClass subjects location salary status approvalStatus createdAt')
      .populate('postedBy', 'name email phone avatar')
      .lean(),
    Application.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('status appliedAt createdAt expectedSalary matchScore')
      .populate('tutorId', 'name email phone avatar')
      .populate('jobId', 'customId studentClass subjects location salary')
      .lean(),
    User.find({ role: { $nin: ['super_admin', 'admin'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role avatar createdAt status')
      .lean(),
  ]);

  const openTuitions = Math.max(0, totalJobs - activeTuitions - closedTuitions);

  // Parallel 6-month historical trends
  const now = new Date();
  const monthPromises = [];
  for (let i = 5; i >= 0; i--) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const monthName = startOfMonth.toLocaleString('en-US', { month: 'short' });
    const year = startOfMonth.getFullYear();

    monthPromises.push(
      Promise.all([
        TuitionJob.countDocuments({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } }),
        Application.countDocuments({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } }),
        Application.countDocuments({
          status: { $in: ['accepted', 'Accepted'] },
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        } as any),
      ]).then(([jobs, applications, matched]) => ({
        month: monthName,
        year,
        label: `${monthName} ${year}`,
        jobs,
        applications,
        matched,
      })),
    );
  }

  // Parallel 4-week breakdown for current month
  const weekPromises = [];
  for (let w = 1; w <= 4; w++) {
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), (w - 1) * 7 + 1);
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), Math.min(w * 7, 31), 23, 59, 59, 999);

    weekPromises.push(
      Promise.all([
        TuitionJob.countDocuments({ createdAt: { $gte: startOfWeek, $lte: endOfWeek } }),
        Application.countDocuments({ createdAt: { $gte: startOfWeek, $lte: endOfWeek } }),
        Application.countDocuments({
          status: { $in: ['accepted', 'Accepted'] },
          createdAt: { $gte: startOfWeek, $lte: endOfWeek },
        } as any),
      ]).then(([jobs, applications, matched]) => ({
        week: `Week ${w}`,
        label: `W${w} (${startOfWeek.getDate()}-${endOfWeek.getDate()} ${now.toLocaleString('en-US', { month: 'short' })})`,
        jobs,
        applications,
        matched,
      })),
    );
  }

  const [monthlyTrends, weeklyTrends] = await Promise.all([
    Promise.all(monthPromises),
    Promise.all(weekPromises),
  ]);

  const stats = {
    totalUsers,
    totalTutors,
    totalStudents,
    totalGuardians,
    totalCoaching,
    totalJobs,
    totalApplications,
    pendingVerifications,
    pendingJobs,
    pendingWithdrawals,
    activeTuitions,
    openTuitions,
    closedTuitions,
    monthlyTrends,
    weeklyTrends,
    recentJobs: recentJobsDocs,
    recentApplications: recentApplicationsDocs,
    recentUsers: recentUsersDocs,
  };

  await CacheService.setCache(cacheKey, stats, 60); // 1 minute TTL
  return stats;
};

const getAllUsers = async (query: Record<string, unknown>) => {
  const cacheKey = `admin:users:${JSON.stringify(query)}`;
  const cached = await CacheService.getCache<any[]>(cacheKey);
  if (cached) return cached;

  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .select('name username email phone role permissions createdBy avatar isEmailVerified isPhoneVerified isApproved status createdAt lastLoginAt tradeLicense')
    .lean();

  const userIds = users.map((u) => u._id);
  const [tutorProfiles, verifications, coachingProfiles] = await Promise.all([
    Tutor.find({ userId: { $in: userIds } })
      .select('userId university department qualification experience mediums preferredClasses preferredAreas salary rating reviewCount isVerified verificationStatus isPremium gender location bio submittedAt verifiedAt rejectionReason nid nidCard studentIdCard certificates')
      .lean(),
    Verification.find({ tutorId: { $in: userIds } })
      .select('tutorId status rejectionReason createdAt nidDocument studentIdDocument')
      .lean(),
    Coaching.find({ userId: { $in: userIds } })
      .select('userId name instituteName district location isVerified about createdAt tradeLicense batches phone')
      .lean(),
  ]);

  const tutorMap = new Map(tutorProfiles.map((t) => [String(t.userId), t]));
  const verifMap = new Map(verifications.map((v: any) => [String(v.tutorId), v]));
  const coachingMap = new Map(coachingProfiles.map((c: any) => [String(c.userId), c]));

  const enrichedUsers = users.map((u: any) => {
    const tutorDoc: any = tutorMap.get(String(u._id));
    const verifDoc: any = verifMap.get(String(u._id));
    const coachingDoc: any = coachingMap.get(String(u._id));

    const nidCard = tutorDoc?.nidCard || verifDoc?.nidDocument || '';
    const studentIdCard = tutorDoc?.studentIdCard || verifDoc?.studentIdDocument || '';
    const tradeLicense = coachingDoc?.tradeLicense || u.tradeLicense || '';
    const isApproved = Boolean(u.isApproved || tutorDoc?.isVerified || coachingDoc?.isVerified || verifDoc?.status === 'Approved');
    const hasDocs = Boolean(nidCard || studentIdCard || tradeLicense);
    const verificationStatus = isApproved ? 'Approved' : (tutorDoc?.verificationStatus || (hasDocs ? 'Pending' : 'Unsubmitted'));

    // Coaching batch metrics
    const batches = coachingDoc?.batches || [];
    const activeBatchesCount = batches.filter((b: any) => b.status === 'Active').length;
    const totalStudentsCount = batches.reduce((sum: number, b: any) => sum + (Number(b.enrolledCount) || 0), 0);
    const batchClasses = Array.from(new Set(batches.map((b: any) => b.className).filter(Boolean)));
    const batchSubjects = Array.from(new Set(batches.map((b: any) => b.subject).filter(Boolean)));
    const fees = batches.map((b: any) => Number(b.fee) || 0).filter((f: number) => f > 0);
    const feeRange = fees.length > 0 
      ? (Math.min(...fees) === Math.max(...fees) ? `৳${Math.min(...fees)}` : `৳${Math.min(...fees)} - ৳${Math.max(...fees)}`)
      : 'N/A';

    return {
      ...u,
      phone: u.phone || tutorDoc?.phone || coachingDoc?.phone || '',
      tutorProfile: tutorDoc || null,
      coachingProfile: coachingDoc || null,
      instituteName: coachingDoc?.instituteName || u.name || 'Coaching Center',
      tradeLicense,
      batches,
      totalBatches: batches.length,
      activeBatches: activeBatchesCount,
      totalStudents: totalStudentsCount,
      batchClasses,
      batchSubjects,
      feeRange,
      nidCard,
      studentIdCard,
      verificationStatus,
      isVerified: isApproved,
      university: tutorDoc?.university || u.university || '',
      department: tutorDoc?.department || u.department || '',
      qualification: tutorDoc?.qualification || '',
      experience: tutorDoc?.experience || '',
      subjects: tutorDoc?.subjects || batchSubjects || [],
      preferredAreas: tutorDoc?.preferredAreas || [],
      mediums: tutorDoc?.mediums || [],
      preferredClasses: tutorDoc?.preferredClasses || batchClasses || [],
      salary: tutorDoc?.salary || 0,
      gender: tutorDoc?.gender || u.gender || 'Male',
      location: coachingDoc?.location || u.address || tutorDoc?.location || u.location || { district: coachingDoc?.district || u.district || 'Dhaka', area: 'All Areas' },
      district: coachingDoc?.district || u.district || (typeof u.location === 'object' ? u.location?.district : u.location) || 'Dhaka',
      bio: coachingDoc?.about || tutorDoc?.bio || u.bio || '',
      rating: tutorDoc?.rating ?? 5,
      reviewCount: tutorDoc?.reviewCount ?? 0,
      totalTuitionsCompleted: tutorDoc?.totalTuitionsCompleted ?? 0,
      isPremium: Boolean(tutorDoc?.isPremium),
      certificates: tutorDoc?.certificates || [],
      nid: tutorDoc?.nid || '',
      rejectionReason: tutorDoc?.rejectionReason || verifDoc?.rejectionReason || '',
      submittedAt: tutorDoc?.submittedAt || verifDoc?.createdAt || coachingDoc?.createdAt || null,
      verifiedAt: tutorDoc?.verifiedAt || null,
    };
  });

  await CacheService.setCache(cacheKey, enrichedUsers, 60); // 1 minute TTL
  return enrichedUsers;
};

const updateUserStatus = async (id: string, status: 'active' | 'blocked' | 'pending') => {
  const user = await User.findByIdAndUpdate(id, { status }, { returnDocument: 'after' });
  if (!user) {
    throw new AppError(404, 'User not found!');
  }

  // Invalidate user and admin dashboard caches
  try {
    await Promise.all([
      CacheService.invalidatePattern('admin:users*'),
      CacheService.deleteCache('admin:dashboard:stats'),
    ]);
  } catch (err) {
    console.warn('⚠️ Cache invalidation error on updateUserStatus:', err);
  }

  return user;
};

const getPendingTutors = async () => {
  const cacheKey = 'admin:tutors:pending';
  const cached = await CacheService.getCache<any[]>(cacheKey);
  if (cached) return cached;

  const tutors = await Tutor.find({ isVerified: false })
    .populate('userId', 'name email phone avatar status')
    .sort({ createdAt: -1 })
    .lean();

  await CacheService.setCache(cacheKey, tutors, 60);
  return tutors;
};

const approveTutor = async (id: string, isApproved: boolean, rejectionReason?: string) => {
  // Update User approval status
  let user = await User.findByIdAndUpdate(
    id,
    { isApproved },
    { returnDocument: 'after' },
  );

  // Update or create corresponding Tutor profile
  let tutor = await Tutor.findOne({ $or: [{ _id: id }, { userId: id }] });
  if (tutor) {
    tutor.isVerified = isApproved;
    tutor.verificationStatus = isApproved ? 'Approved' : 'Rejected';
    tutor.verifiedAt = isApproved ? new Date() : null;
    if (rejectionReason) {
      tutor.rejectionReason = rejectionReason;
    }
    await tutor.save();
    if (!user && tutor.userId) {
      user = await User.findByIdAndUpdate(tutor.userId, { isApproved }, { returnDocument: 'after' });
    }
  } else if (user && user.role === 'tutor') {
    tutor = await Tutor.create({
      userId: user._id,
      isVerified: isApproved,
      verificationStatus: isApproved ? 'Approved' : 'Rejected',
      verifiedAt: isApproved ? new Date() : null,
      rejectionReason: rejectionReason || '',
    });
  }

  // Also update Coaching profile if exists
  await Coaching.findOneAndUpdate(
    { $or: [{ _id: id }, { userId: id }] },
    { isVerified: isApproved }
  );

  if (!user && !tutor) {
    const coaching = await Coaching.findOne({ $or: [{ _id: id }, { userId: id }] });
    if (!coaching) {
      throw new AppError(404, 'User or Profile not found!');
    }
  }

  // Invalidate tutor and admin caches
  try {
    await Promise.all([
      CacheService.invalidatePattern('tutors:search:*'),
      CacheService.invalidatePattern('admin:users*'),
      CacheService.deleteCache('admin:tutors:pending'),
      CacheService.deleteCache('admin:dashboard:stats'),
      CacheService.deleteCache('homepage:data'),
      tutor?._id ? CacheService.deleteCache(`tutor:detail:${tutor._id}`) : Promise.resolve(),
    ]);
  } catch (err) {
    console.warn('⚠️ Cache invalidation error:', err);
  }

  if (user && isApproved) {
    try {
      const isCoaching = user.role === 'coaching';
      await NotificationService.createNotification({
        userId: String(user._id),
        type: 'tutor_verification',
        title: isCoaching ? 'কোচিং সেন্টার অ্যাকাউন্ট অনুমোদন সফল হয়েছে 🎉' : 'অ্যাকাউন্ট ভেরিফিকেশন সফল হয়েছে 🎉',
        message: isCoaching 
          ? 'অভিনন্দন! অ্যাডমিন আপনার কোচিং সেন্টার অ্যাকাউন্ট অনুমোদন করেছেন। এখন থেকে আপনি কোচিং ড্যাশবোর্ডে লগইন করে ব্যাচ ও মেম্বার পরিচালনা করতে পারবেন।'
          : 'অভিনন্দন! অ্যাডমিন আপনার NID ও আইডি কার্ড পর্যালোচনা করে টিউটর অ্যাকাউন্ট ভেরিফাই করেছেন। এখন থেকে আপনি সকল টিউশন জবে আবেদন করতে পারবেন।',
        referenceId: String(user._id),
        referenceType: isCoaching ? 'Coaching' : 'Tutor',
      });
    } catch (err) {
      console.warn('⚠️ User account approval notification error:', err);
    }
  } else if (user && !isApproved && rejectionReason) {
    try {
      await NotificationService.createNotification({
        userId: String(user._id),
        type: 'tutor_verification',
        title: 'ভেরিফিকেশন আবেদন প্রত্যাখ্যাত হয়েছে',
        message: `আপনার ভেরিফিকেশন আবেদনটি প্রত্যাখ্যাত হয়েছে। কারণ: ${rejectionReason}। অনুগ্রহ করে সঠিক ডকুমেন্ট পুনরায় আপলোড করুন।`,
        referenceId: String(user._id),
        referenceType: 'Tutor',
      });
    } catch (err) {
      console.warn('⚠️ User account rejection notification error:', err);
    }
  }

  return { user, tutor };
};

const getPendingJobs = async () => {
  const cacheKey = 'admin:jobs:pending';
  const cached = await CacheService.getCache<any[]>(cacheKey);
  if (cached) return cached;

  const jobs = await TuitionJob.find({ approvalStatus: 'Pending' })
    .populate('postedBy', 'name email phone avatar')
    .sort({ createdAt: -1 })
    .lean();

  await CacheService.setCache(cacheKey, jobs, 60);
  return jobs;
};

const approveJob = async (jobId: string, approvalStatus: 'Approved' | 'Rejected', userRole?: string) => {
  const existingJob = await TuitionJob.findById(jobId);
  if (!existingJob) {
    throw new AppError(404, 'Tuition job not found!');
  }

  // 🛡️ Moderator Protection: Moderator cannot change approval status of jobs created by Admin / Super Admin
  if (userRole === 'moderator') {
    const posterUser = await User.findById(existingJob.postedBy).select('role');
    if (posterUser && ['admin', 'super_admin'].includes(posterUser.role)) {
      throw new AppError(403, 'মডারেটর হিসেবে আপনি এডমিনের তৈরি করা টিউশন পোস্ট অনুমোদন বা পরিবর্তন করতে পারবেন না।');
    }
  }

  const job = await TuitionJob.findByIdAndUpdate(jobId, { approvalStatus }, { returnDocument: 'after' });

  // Invalidate public and admin jobs cache
  try {
    await Promise.all([
      CacheService.invalidatePattern('jobs:*'),
      CacheService.deleteCache('admin:jobs:pending'),
      CacheService.deleteCache('admin:dashboard:stats'),
    ]);
  } catch (err) {
    console.warn('⚠️ Cache invalidation error on job approval:', err);
  }

  return job;
};

const getVerifications = async () => {
  const cacheKey = 'admin:verifications:all';
  const cached = await CacheService.getCache<any[]>(cacheKey);
  if (cached) return cached;

  const verifications = await Verification.find()
    .populate('tutorId', 'name email phone avatar')
    .sort({ createdAt: -1 })
    .lean();

  await CacheService.setCache(cacheKey, verifications, 60);
  return verifications;
};

const updateVerificationStatus = async (
  id: string,
  adminId: string,
  status: 'Approved' | 'Rejected',
  rejectionReason?: string,
) => {
  const verification = await Verification.findById(id);
  if (!verification) {
    throw new AppError(404, 'Verification request not found!');
  }

  verification.status = status;
  verification.reviewedBy = adminId as any;
  verification.reviewedAt = new Date();
  if (rejectionReason) {
    verification.rejectionReason = rejectionReason;
  }

  await verification.save();

  if (status === 'Approved') {
    await Tutor.findOneAndUpdate({ userId: verification.tutorId }, { isVerified: true });
  }

  // Invalidate caches
  try {
    await Promise.all([
      CacheService.deleteCache('admin:verifications:all'),
      CacheService.invalidatePattern('admin:users*'),
      CacheService.deleteCache('admin:dashboard:stats'),
      CacheService.invalidatePattern('tutors:search:*'),
    ]);
  } catch (err) {
    console.warn('⚠️ Cache invalidation error on verification update:', err);
  }

  return verification;
};

const getPayments = async () => {
  const cacheKey = 'admin:payments:all';
  const cached = await CacheService.getCache<any>(cacheKey);
  if (cached) return cached;

  const [payments, withdrawals] = await Promise.all([
    Payment.find().populate('userId', 'name email phone').sort({ createdAt: -1 }).lean(),
    Withdrawal.find().populate('userId', 'name email phone').sort({ createdAt: -1 }).lean(),
  ]);

  const result = { payments, withdrawals };
  await CacheService.setCache(cacheKey, result, 60);
  return result;
};

const updatePaymentStatus = async (
  id: string,
  adminId: string,
  status: 'Approved' | 'Rejected' | 'Completed',
) => {
  let withdrawal = await Withdrawal.findById(id);
  if (withdrawal) {
    withdrawal.status = status as any;
    withdrawal.reviewedBy = adminId as any;
    withdrawal.reviewedAt = new Date();
    await withdrawal.save();
    try {
      await Promise.all([
        CacheService.deleteCache('admin:payments:all'),
        CacheService.deleteCache('admin:dashboard:stats'),
      ]);
    } catch (err) {
      console.warn('⚠️ Cache invalidation error:', err);
    }
    return withdrawal;
  }

  const payment = await Payment.findByIdAndUpdate(id, { status }, { returnDocument: 'after' });
  if (!payment) {
    throw new AppError(404, 'Payment or withdrawal record not found!');
  }

  try {
    await Promise.all([
      CacheService.deleteCache('admin:payments:all'),
      CacheService.deleteCache('admin:dashboard:stats'),
    ]);
  } catch (err) {
    console.warn('⚠️ Cache invalidation error:', err);
  }

  return payment;
};

const deleteUser = async (id: string) => {
  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw new AppError(404, 'User not found!');
  }
  await Promise.all([
    Tutor.deleteMany({ userId: id }),
    Coaching.deleteMany({ userId: id }),
    Verification.deleteMany({ tutorId: id }),
  ]);

  try {
    await Promise.all([
      CacheService.invalidatePattern('admin:users*'),
      CacheService.invalidatePattern('tutors:search:*'),
      CacheService.deleteCache('admin:dashboard:stats'),
      CacheService.deleteCache('homepage:data'),
    ]);
  } catch (err) {
    console.warn('⚠️ Cache invalidation error on deleteUser:', err);
  }

  return user;
};

const generateUniqueUsername = async (name: string, role: string): Promise<string> => {
  const prefix = role === 'admin' ? 'adm' : (role === 'moderator' ? 'mod' : 'usr');
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10) || 'staff';

  let username = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 20) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    username = `${prefix}_${cleanName}_${randomDigits}`;
    const exists = await User.findOne({ username });
    if (!exists) {
      isUnique = true;
    }
    attempts++;
  }

  return username;
};

const createStaff = async (
  creatorId: string,
  payload: {
    name: string;
    email: string;
    phone?: string;
    role: 'admin' | 'moderator';
    password: string;
    permissions?: string[];
  },
) => {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError(400, 'User with this email already exists!');
  }

  const username = await generateUniqueUsername(payload.name, payload.role);

  const staff = await User.create({
    name: payload.name.trim(),
    username,
    email: normalizedEmail,
    phone: payload.phone || '',
    password: payload.password,
    role: payload.role,
    permissions: payload.permissions || (payload.role === 'admin' ? ['all'] : ['manage_jobs', 'manage_tutors', 'manage_blogs']),
    isEmailVerified: true,
    isApproved: true,
    status: 'active',
    createdBy: creatorId as any,
  });

  try {
    await CacheService.deleteCache('admin:staff:all');
  } catch (err) {
    console.warn('⚠️ Cache invalidation error on createStaff:', err);
  }

  return {
    _id: staff._id,
    name: staff.name,
    username: staff.username,
    email: staff.email,
    phone: staff.phone,
    role: staff.role,
    permissions: staff.permissions,
    status: staff.status,
    createdAt: staff.createdAt,
  };
};

const getAllStaff = async () => {
  const cacheKey = 'admin:staff:all';
  const cached = await CacheService.getCache<any[]>(cacheKey);
  if (cached) return cached;

  const staff = await User.find({
    role: { $in: ['super_admin', 'admin', 'moderator'] },
  })
    .populate('createdBy', 'name email avatar role')
    .sort({ createdAt: -1 })
    .lean();

  await CacheService.setCache(cacheKey, staff, 60);
  return staff;
};

const updateStaffStatus = async (id: string, status: 'active' | 'blocked') => {
  const target = await User.findById(id);
  if (!target) {
    throw new AppError(404, 'Staff account not found!');
  }

  if (target.role === 'super_admin') {
    throw new AppError(403, 'Super Admin status cannot be altered!');
  }

  target.status = status;
  await target.save();

  try {
    await CacheService.deleteCache('admin:staff:all');
  } catch (err) {
    console.warn('⚠️ Cache invalidation error on updateStaffStatus:', err);
  }

  return target;
};

const updateStaffPermissions = async (id: string, permissions: string[]) => {
  const staff = await User.findByIdAndUpdate(
    id,
    { permissions },
    { returnDocument: 'after' },
  );
  if (!staff) {
    throw new AppError(404, 'Staff account not found!');
  }

  try {
    await CacheService.deleteCache('admin:staff:all');
  } catch (err) {
    console.warn('⚠️ Cache invalidation error on updateStaffPermissions:', err);
  }

  return staff;
};

const deleteStaff = async (id: string) => {
  const target = await User.findById(id);
  if (!target) {
    throw new AppError(404, 'Staff account not found!');
  }
  if (target.role === 'super_admin') {
    throw new AppError(403, 'Super Admin cannot be deleted!');
  }

  await User.findByIdAndDelete(id);

  try {
    await CacheService.deleteCache('admin:staff:all');
  } catch (err) {
    console.warn('⚠️ Cache invalidation error on deleteStaff:', err);
  }

  return { message: 'Staff account removed successfully' };
};

const getAllApplications = async () => {
  const cacheKey = 'admin:applications:all';
  const cached = await CacheService.getCache<any[]>(cacheKey);
  if (cached) return cached;

  const applications = await Application.find()
    .populate({
      path: 'jobId',
      select: 'customId studentClass subjects location salary salaryRange salaryMax status postedBy tuitionType medium duration tutoringDays requirements createdAt phone whatsappNumber contactName description universityPreference studentGender tutorQualification',
      populate: {
        path: 'postedBy',
        model: 'User',
        select: 'name email phone avatar role location address',
      },
    })
    .populate('tutorId', 'name email phone avatar role location')
    .sort({ createdAt: -1 })
    .lean();

  await CacheService.setCache(cacheKey, applications, 60);
  return applications;
};

export const AdminService = {
  deleteUser,
  getDashboardStats,
  getAllApplications,
  getAllUsers,
  updateUserStatus,
  getPendingTutors,
  approveTutor,
  getPendingJobs,
  approveJob,
  getVerifications,
  updateVerificationStatus,
  getPayments,
  updatePaymentStatus,
  generateUniqueUsername,
  createStaff,
  getAllStaff,
  updateStaffStatus,
  updateStaffPermissions,
  deleteStaff,
};

