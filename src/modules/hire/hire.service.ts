import mongoose from 'mongoose';
import { AppError } from '../../errors/AppError.js';
import type { IHireRequest } from './hire.interface.js';
import { HireRequest } from './hire.model.js';
import { generateTuitionCustomId } from '../tuition/tuition.service.js';

const createHireRequest = async (guardianId: string | null, payload: any) => {
  if (!payload.tutorId) {
    throw new AppError(400, 'Tutor ID is required');
  }

  const { Tutor } = await import('../tutor/tutor.model.js');
  const { User } = await import('../user/user.model.js');

  let resolvedTutorUserId: any = null;
  let resolvedTutorProfileId: any = null;

  if (mongoose.isValidObjectId(payload.tutorId)) {
    // Check if payload.tutorId is a Tutor document _id
    const tutorDoc = await Tutor.findById(payload.tutorId);
    if (tutorDoc) {
      resolvedTutorUserId = tutorDoc.userId;
      resolvedTutorProfileId = tutorDoc._id;
    } else {
      // Check if payload.tutorId is a User document _id
      const userDoc = await User.findById(payload.tutorId);
      if (userDoc) {
        resolvedTutorUserId = userDoc._id;
        const tDoc = await Tutor.findOne({ userId: userDoc._id });
        if (tDoc) resolvedTutorProfileId = tDoc._id;
      }
    }
  }

  if (!resolvedTutorUserId) {
    throw new AppError(404, 'Selected tutor not found in database');
  }

  // Parse location
  let parsedLocation = { district: 'Dhaka', area: '', detailedAddress: '' };
  if (payload.location && typeof payload.location === 'object') {
    parsedLocation = {
      district: payload.location.district || 'Dhaka',
      area: payload.location.area || '',
      detailedAddress: payload.location.detailedAddress || '',
    };
  } else if (typeof payload.location === 'string' && payload.location.trim()) {
    parsedLocation.area = payload.location.trim();
  }

  const createData: any = {
    guardianName: (payload.guardianName || payload.name || 'Guardian/Student').trim(),
    guardianPhone: (payload.guardianPhone || payload.phone || '').trim(),
    guardianEmail: (payload.guardianEmail || payload.email || '').trim(),
    studentClass: (payload.studentClass || payload.class || '').trim(),
    subjects: Array.isArray(payload.subjects)
      ? payload.subjects
      : (typeof payload.subjectsNeeded === 'string'
        ? payload.subjectsNeeded.split(',').map((s: string) => s.trim()).filter(Boolean)
        : (payload.subjects || [])),
    salaryOffer: payload.salaryOffer || payload.salary || 'Negotiable',
    requirements: (payload.requirements || payload.notes || payload.message || '').trim(),
    location: parsedLocation,
    tutorId: resolvedTutorUserId,
    tutorProfileId: resolvedTutorProfileId,
    status: 'Pending',
  };
  if (guardianId && mongoose.isValidObjectId(guardianId)) {
    createData.guardianId = new mongoose.Types.ObjectId(guardianId);
  }

  const newHireRequest: any = await HireRequest.create(createData);

  // Notify Admins about new direct tutor request
  try {
    const { NotificationService } = await import('../notification/notification.service.js');
    const admins = await User.find({ role: { $in: ['admin', 'super_admin', 'moderator'] } }).select('_id');
    for (const admin of admins) {
      await NotificationService.createNotification({
        userId: String(admin._id),
        type: 'system',
        title: '📩 নতুন ডাইরেক্ট টিউটর রিকোয়েস্ট',
        message: `${newHireRequest.guardianName} (${newHireRequest.guardianPhone}) শিক্ষক এর জন্য হায়ার রিকোয়েস্ট পাঠিয়েছেন।`,
        referenceId: String(newHireRequest._id),
        referenceType: 'hire_request',
      }).catch(() => null);
    }
  } catch (err) {
    console.warn('⚠️ Could not send admin notification for hire request:', err);
  }

  return newHireRequest;
};

const getHireRequests = async (userId?: string, userRole?: string) => {
  const filter: Record<string, unknown> = {};

  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole || '');

  if (!isStaff && userId) {
    if (userRole === 'tutor') {
      filter['tutorId'] = userId;
    } else if (userRole === 'guardian' || userRole === 'student') {
      filter['$or'] = [{ guardianId: userId }];
    }
  }

  const requests = await HireRequest.find(filter)
    .populate('guardianId', 'name email phone avatar role status')
    .populate('tutorId', 'name email phone avatar role status')
    .populate('tutorProfileId', 'university department location salary experience rating reviewCount isVerified isPremium')
    .populate('jobId')
    .sort({ createdAt: -1 })
    .lean();

  return requests;
};

const getHireRequestById = async (id: string) => {
  const request = await HireRequest.findById(id)
    .populate('guardianId', 'name email phone avatar role')
    .populate('tutorId', 'name email phone avatar role')
    .populate('tutorProfileId', 'university department location salary experience rating reviewCount isVerified')
    .populate('jobId')
    .lean();

  if (!request) {
    throw new AppError(404, 'Hire request not found!');
  }
  return request;
};

const updateHireRequestStatus = async (
  id: string,
  payload: { status: string; adminNotes?: string },
  userRole: string,
) => {
  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff) {
    throw new AppError(403, 'Only admins and staff can update hire request status');
  }

  const request = await HireRequest.findById(id);
  if (!request) {
    throw new AppError(404, 'Hire request not found!');
  }

  if (payload.status) {
    request.status = payload.status as any;
  }
  if (typeof payload.adminNotes === 'string') {
    request.adminNotes = payload.adminNotes;
  }

  await request.save();
  return request;
};

const confirmAndAssignTuition = async (
  id: string,
  payload: {
    salary?: number;
    platformFee?: number;
    daysPerWeek?: string;
    studentClass?: string;
    subjects?: string[] | string;
    location?: { district?: string; area?: string; detailedAddress?: string };
    tuitionType?: string;
    startDate?: string;
    notes?: string;
  },
  adminUserId: string,
  userRole: string,
) => {
  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff) {
    throw new AppError(403, 'Only administrators can confirm and assign tuitions');
  }

  const request = await HireRequest.findById(id);
  if (!request) {
    throw new AppError(404, 'Hire request not found!');
  }

  const { TuitionJob } = await import('../tuition/tuition.model.js');
  const { Application } = await import('../application/application.model.js');
  const { Tutor } = await import('../tutor/tutor.model.js');
  const { User } = await import('../user/user.model.js');
  const { NotificationService } = await import('../notification/notification.service.js');

  const locDistrict = payload.location?.district || request.location?.district || 'Dhaka';
  const locArea = payload.location?.area || request.location?.area || 'All Areas';
  const locDetails = payload.location?.detailedAddress || request.location?.detailedAddress || '';

  const customId = await generateTuitionCustomId(locDistrict);

  const rawSubjects = payload.subjects || request.subjects || [];
  const subs = Array.isArray(rawSubjects)
    ? rawSubjects
    : String(rawSubjects).split(',').map((s) => s.trim()).filter(Boolean);

  const finalSalary = Number(payload.salary || request.salaryOffer || 0);
  const calculatedPlatformFee = payload.platformFee !== undefined
    ? Number(payload.platformFee)
    : Math.round(finalSalary * 0.6);

  // 1. Create Confirmed Tuition Job (Status Matched/Approved)
  const jobPayload: any = {
    customId,
    postedBy: request.guardianId || new mongoose.Types.ObjectId(adminUserId),
    studentClass: payload.studentClass || request.studentClass || 'Class N/A',
    subjects: subs.length > 0 ? subs : ['General'],
    medium: 'Bangla Medium',
    location: {
      district: locDistrict,
      area: locArea,
      detailedAddress: locDetails,
    },
    salary: finalSalary,
    genderPreference: 'Any',
    status: 'Matched',
    approvalStatus: 'Approved',
    selectedTutor: request.tutorId,
    description: `Direct Hire Confirmed Tuition. Guardian: ${request.guardianName} (${request.guardianPhone}). Subjects: ${subs.join(', ')}. ${payload.notes || request.requirements || ''}`,
  };

  const newJob: any = await TuitionJob.create(jobPayload);

  // 2. Create Confirmed Application directly in Tutor's Active Tuitions
  const newApp: any = await Application.create({
    jobId: newJob._id,
    tutorId: request.tutorId,
    expectedSalary: finalSalary,
    status: 'Accepted',
    mediaFee: calculatedPlatformFee,
    appliedAt: new Date(),
  });

  // 3. Update HireRequest Record
  request.status = 'Confirmed';
  request.jobId = newJob._id;
  request.confirmedTuition = {
    jobId: newJob._id,
    applicationId: newApp._id,
    salary: finalSalary,
    platformFee: calculatedPlatformFee,
    daysPerWeek: newJob.daysPerWeek,
    studentClass: newJob.studentClass,
    subjects: subs,
    location: newJob.location,
    confirmedAt: new Date(),
    confirmedBy: new mongoose.Types.ObjectId(adminUserId),
  };
  await request.save();

  // 4. Increment Tutor's totalTuitionsCompleted count
  try {
    await Tutor.findOneAndUpdate(
      { userId: request.tutorId },
      { $inc: { totalTuitionsCompleted: 1 } },
    );
  } catch (err) {
    console.warn('⚠️ Could not increment totalTuitionsCompleted:', err);
  }

  // 5. Send In-App Notifications
  try {
    // Notify Tutor
    await NotificationService.createNotification({
      userId: String(request.tutorId),
      type: 'system',
      title: '🎉 নতুন টিউশন কনফার্ম ও অ্যাক্টিভ হয়েছে!',
      message: `অভিনন্দন! আপনার জন্য একটি নতুন টিউশন (#${customId}) কনফার্ম করা হয়েছে। বিস্তারিত আপনার ড্যাশবোর্ডের অ্যাক্টিভ টিউশন সেকশনে দেখুন।`,
      referenceId: String(newJob._id),
      referenceType: 'application',
    }).catch(() => null);

    // Notify Guardian if registered
    if (request.guardianId) {
      await NotificationService.createNotification({
        userId: String(request.guardianId),
        type: 'system',
        title: '✅ আপনার টিউটর রিকোয়েস্ট কনফার্ম হয়েছে!',
        message: `আপনার অনুরোধকৃত শিক্ষক আপনার টিউশনে কনফার্ম করা হয়েছে (#${customId})।`,
        referenceId: String(newJob._id),
        referenceType: 'application',
      }).catch(() => null);
    }
  } catch (err) {
    console.warn('⚠️ Notification error on tuition confirm:', err);
  }

  return {
    hireRequest: request,
    job: newJob,
    application: newApp,
  };
};

export const HireService = {
  createHireRequest,
  getHireRequests,
  getHireRequestById,
  updateHireRequestStatus,
  confirmAndAssignTuition,
};

