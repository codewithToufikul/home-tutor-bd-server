import { AppError } from '../../errors/AppError.js';
import { TuitionJob } from '../tuition/tuition.model.js';
import { Application } from './application.model.js';
import { NotificationService } from '../notification/notification.service.js';
import { User } from '../user/user.model.js';

const getMyApplications = async (tutorId: string) => {
  const applications = await Application.find({ tutorId })
    .populate({
      path: 'jobId',
      populate: { path: 'postedBy', select: 'name email phone avatar' },
    })
    .sort({ createdAt: -1 });

  return applications;
};

const getApplicationById = async (id: string) => {
  const application = await Application.findById(id)
    .populate('tutorId', 'name email phone avatar')
    .populate({
      path: 'jobId',
      populate: { path: 'postedBy', select: 'name email phone avatar' },
    });

  if (!application) {
    throw new AppError(404, 'Application not found!');
  }
  return application;
};

const acceptApplication = async (id: string, userId: string, userRole: string) => {
  const application = await Application.findById(id).populate('jobId');
  if (!application) {
    throw new AppError(404, 'Application not found!');
  }

  const job = application.jobId as unknown as { postedBy: string; _id: string };

  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to accept this application!');
  }

  application.status = 'Accepted';
  await application.save();

  await TuitionJob.findByIdAndUpdate(job._id, { status: 'Matched' });

  try {
    // Send notification to Tutor that application was approved/accepted!
    const jobMedium = (job as any)?.medium || 'টিউশন';
    await NotificationService.createNotification({
      userId: String(application.tutorId),
      type: 'job_approval',
      title: 'টিউশন আবেদন অনুমোদন করা হয়েছে 🎉',
      message: `অভিনন্দন! আপনার ${jobMedium} টিউশনের আবেদনটি সফলভাবে অনুমোদন (Approved/Accepted) করা হয়েছে।`,
      referenceId: String(job._id),
      referenceType: 'TuitionJob',
    });

    // Notify all staff (Super Admin, Admin, Moderator) about confirmed tuition match
    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } });
    for (const staff of staffUsers) {
      await NotificationService.createNotification({
        userId: String(staff._id),
        type: 'job_approval',
        title: '🎉 টিউশন ম্যাচ সফলভাবে সম্পন্ন',
        message: `একটি টিউশন জবে (${(job as any)?.studentClass || 'Tuition'}) সফলভাবে টিউটর ম্যাচ ও কনফার্ম হয়েছে।`,
        referenceId: String(job._id),
        referenceType: 'TuitionJob',
      });
    }
  } catch (err) {
    console.warn('⚠️ Application accepted notification error:', err);
  }

  return application;
};

const rejectApplication = async (id: string, userId: string, userRole: string) => {
  const application = await Application.findById(id).populate('jobId');
  if (!application) {
    throw new AppError(404, 'Application not found!');
  }

  const job = application.jobId as unknown as { postedBy: string };

  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to reject this application!');
  }

  application.status = 'Rejected';
  await application.save();

  return application;
};

const withdrawApplication = async (id: string, tutorUserId: string) => {
  const application = await Application.findOne({ _id: id, tutorId: tutorUserId });
  if (!application) {
    throw new AppError(404, 'Application not found or you are not authorized to withdraw it!');
  }

  if (application.status === 'Accepted') {
    throw new AppError(400, 'Cannot withdraw an application that has already been accepted.');
  }

  application.status = 'Withdrawn';
  await application.save();

  return application;
};

const getJobApplications = async (jobId: string, userId: string, userRole: string) => {
  const job = await TuitionJob.findById(jobId);
  if (!job) {
    throw new AppError(404, 'Tuition job not found!');
  }

  if (userRole !== 'admin' && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to view applications for this job.');
  }

  const applications = await Application.find({ jobId })
    .populate('tutorId', 'name email phone avatar')
    .sort({ matchScore: -1, createdAt: -1 });

  // Get tutor profiles for academic details
  const { Tutor } = await import('../tutor/tutor.model.js');
  const tutorUserIds = applications.map((a) => (a.tutorId as any)?._id).filter(Boolean);
  const tutorProfiles = await Tutor.find({ userId: { $in: tutorUserIds } }).lean();
  const profileMap = new Map<string, any>(tutorProfiles.map((p: any) => [String(p.userId), p]));

  // Privacy Protection: Mask sensitive contact/personal info until application is accepted
  const sanitizedApplications = applications.map((app) => {
    const rawApp = app.toObject ? app.toObject() : app;
    const tutorUser = (rawApp.tutorId as any) || {};
    const tutorProfile: any = profileMap.get(String(tutorUser._id)) || {};

    const isConfirmed = rawApp.status === 'Accepted';

    if (userRole !== 'admin' && !isConfirmed) {
      const tutorAnonId = String(tutorUser._id || 'TUTOR').slice(-4).toUpperCase();
      return {
        ...rawApp,
        tutorId: {
          _id: tutorUser._id,
          name: `Candidate Tutor #${tutorAnonId}`,
          avatar: '', // Masked
          phone: '🔒 টিউশন নিশ্চিত (Accept) করার পর যোগাযোগ নম্বর দেখতে পাবেন',
          email: '🔒 Hidden',
        },
        tutorProfile: {
          university: tutorProfile.university || '',
          department: tutorProfile.department || '',
          qualification: tutorProfile.qualification || '',
          experience: tutorProfile.experience || '',
          rating: tutorProfile.rating || 0,
          reviewCount: tutorProfile.reviewCount || 0,
          isVerified: tutorProfile.isVerified || false,
          gender: tutorProfile.gender || '',
        },
      };
    }

    return {
      ...rawApp,
      tutorProfile: {
        university: tutorProfile.university || '',
        department: tutorProfile.department || '',
        qualification: tutorProfile.qualification || '',
        experience: tutorProfile.experience || '',
        rating: tutorProfile.rating || 0,
        reviewCount: tutorProfile.reviewCount || 0,
        isVerified: tutorProfile.isVerified || false,
        gender: tutorProfile.gender || '',
      },
    };
  });

  return sanitizedApplications;
};

export const ApplicationService = {
  getMyApplications,
  getApplicationById,
  acceptApplication,
  rejectApplication,
  withdrawApplication,
  getJobApplications,
};
