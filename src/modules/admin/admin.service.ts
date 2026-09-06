import { NotificationService } from '../notification/notification.service.js';
import { AppError } from '../../errors/AppError.js';
import { Application } from '../application/application.model.js';
import { Payment, Withdrawal } from '../payment/payment.model.js';
import { TuitionJob } from '../tuition/tuition.model.js';
import { Tutor } from '../tutor/tutor.model.js';
import { User } from '../user/user.model.js';
import { Verification } from '../verification/verification.model.js';
import { Coaching } from '../coaching/coaching.model.js';

const getDashboardStats = async () => {
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
    acceptedApps,
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
    Application.find({ status: { $regex: /^accepted$/i } }),
    TuitionJob.find().sort({ createdAt: -1 }).limit(5).populate('postedBy', 'name email phone avatar'),
    Application.find().sort({ createdAt: -1 }).limit(5).populate('tutorId', 'name email phone avatar').populate('jobId', 'studentClass subjects location salary'),
    User.find({ role: { $nin: ['super_admin', 'admin'] } }).sort({ createdAt: -1 }).limit(5).select('name email role avatar createdAt status'),
  ]);

  const acceptedJobIds = acceptedApps.map((a: any) => a.jobId?.toString()).filter(Boolean);

  const activeTuitions = await TuitionJob.countDocuments({
    $or: [
      { _id: { $in: acceptedJobIds } },
      { status: { $in: ['Matched', 'Running', 'Active', 'Confirmed', 'Hired', 'matched', 'hired', 'active'] } },
    ],
  } as any);

  const closedTuitions = await TuitionJob.countDocuments({
    status: { $in: ['Closed', 'closed', 'Cancelled', 'cancelled'] },
  } as any);

  const openTuitions = Math.max(0, totalJobs - activeTuitions - closedTuitions);

  // Real 6-month historical counts computed directly from MongoDB
  const now = new Date();
  const monthlyTrends = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthName = startOfMonth.toLocaleString('en-US', { month: 'short' });
    const year = startOfMonth.getFullYear();

    const [jobs, applications, matched] = await Promise.all([
      TuitionJob.countDocuments({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } }),
      Application.countDocuments({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } }),
      Application.countDocuments({
        status: { $regex: /^accepted$/i },
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),
    ]);

    monthlyTrends.push({
      month: monthName,
      year,
      label: `${monthName} ${year}`,
      jobs,
      applications,
      matched,
    });
  }

  // Real 4-week breakdown for the current month
  const weeklyTrends = [];
  for (let w = 1; w <= 4; w++) {
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), (w - 1) * 7 + 1);
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), Math.min(w * 7, 31), 23, 59, 59, 999);

    const [jobs, applications, matched] = await Promise.all([
      TuitionJob.countDocuments({ createdAt: { $gte: startOfWeek, $lte: endOfWeek } }),
      Application.countDocuments({ createdAt: { $gte: startOfWeek, $lte: endOfWeek } }),
      Application.countDocuments({
        status: { $regex: /^accepted$/i },
        createdAt: { $gte: startOfWeek, $lte: endOfWeek },
      }),
    ]);

    weeklyTrends.push({
      week: `Week ${w}`,
      label: `W${w} (${startOfWeek.getDate()}-${endOfWeek.getDate()} ${now.toLocaleString('en-US', { month: 'short' })})`,
      jobs,
      applications,
      matched,
    });
  }

  return {
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
};

const getAllUsers = async (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;

  const users = await User.find(filter).sort({ createdAt: -1 }).lean();

  // Attach tutor phone, verification and complete profile details
  const userIds = users.map((u) => u._id);
  const [tutorProfiles, verifications, coachingProfiles] = await Promise.all([
    Tutor.find({ userId: { $in: userIds } }).lean(),
    Verification.find({ tutorId: { $in: userIds } }).lean(),
    Coaching.find({ userId: { $in: userIds } }).lean(),
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
      cv: tutorDoc?.cv || '',
      nid: tutorDoc?.nid || '',
      rejectionReason: tutorDoc?.rejectionReason || verifDoc?.rejectionReason || '',
      submittedAt: tutorDoc?.submittedAt || verifDoc?.createdAt || coachingDoc?.createdAt || null,
      verifiedAt: tutorDoc?.verifiedAt || null,
    };
  });

  return enrichedUsers;
};

const updateUserStatus = async (id: string, status: 'active' | 'blocked' | 'pending') => {
  const user = await User.findByIdAndUpdate(id, { status }, { returnDocument: 'after' });
  if (!user) {
    throw new AppError(404, 'User not found!');
  }
  return user;
};

const getPendingTutors = async () => {
  const tutors = await Tutor.find({ isVerified: false }).populate('userId', 'name email phone avatar status');
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

  // Invalidate tutor search and detail caches
  try {
    const { CacheService } = await import('../../services/cache.service.js');
    await CacheService.invalidatePattern('tutors:search:*');
    if (tutor?._id) {
      await CacheService.deleteCache(`tutor:detail:${tutor._id}`);
    }
    await CacheService.deleteCache('homepage:data');
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
  const jobs = await TuitionJob.find({ approvalStatus: 'Pending' }).populate('postedBy', 'name email phone avatar');
  return jobs;
};

const approveJob = async (jobId: string, approvalStatus: 'Approved' | 'Rejected') => {
  const job = await TuitionJob.findByIdAndUpdate(jobId, { approvalStatus }, { returnDocument: 'after' });
  if (!job) {
    throw new AppError(404, 'Tuition job not found!');
  }
  return job;
};

const getVerifications = async () => {
  const verifications = await Verification.find()
    .populate('tutorId', 'name email phone avatar')
    .sort({ createdAt: -1 });
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

  return verification;
};

const getPayments = async () => {
  const payments = await Payment.find().populate('userId', 'name email phone').sort({ createdAt: -1 });
  const withdrawals = await Withdrawal.find().populate('userId', 'name email phone').sort({ createdAt: -1 });
  return {
    payments,
    withdrawals,
  };
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
    return withdrawal;
  }

  const payment = await Payment.findByIdAndUpdate(id, { status }, { returnDocument: 'after' });
  if (!payment) {
    throw new AppError(404, 'Payment or withdrawal record not found!');
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
  const staff = await User.find({
    role: { $in: ['super_admin', 'admin', 'moderator'] },
  })
    .populate('createdBy', 'name email avatar role')
    .sort({ createdAt: -1 });

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
  return { message: 'Staff account removed successfully' };
};

const getAllApplications = async () => {
  const applications = await Application.find()
    .populate({
      path: 'jobId',
      populate: {
        path: 'postedBy',
        model: 'User',
        select: 'name email phone avatar role location address',
      },
    })
    .populate('tutorId', 'name email phone avatar role location')
    .sort({ createdAt: -1 })
    .lean();

  // Guarantee that every job has its student/guardian user details attached
  const userIdsToFetch = new Set<string>();
  applications.forEach((app: any) => {
    if (app.jobId && typeof app.jobId === 'object') {
      const pb = app.jobId.postedBy;
      if (pb && (typeof pb === 'string' || typeof pb === 'number' || (pb._id && !pb.name))) {
        userIdsToFetch.add(String(pb._id || pb));
      }
    }
  });

  if (userIdsToFetch.size > 0) {
    const users = await User.find({ _id: { $in: Array.from(userIdsToFetch) } })
      .select('name email phone avatar role location address')
      .lean();
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));
    applications.forEach((app: any) => {
      if (app.jobId && typeof app.jobId === 'object') {
        const pb = app.jobId.postedBy;
        const uid = String(pb?._id || pb);
        if (userMap.has(uid)) {
          app.jobId.postedBy = userMap.get(uid);
        }
      }
    });
  }

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
