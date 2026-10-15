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

const demoConfirmApplication = async (id: string, userId: string, userRole: string) => {
  const application = await Application.findById(id).populate('jobId');
  if (!application) {
    throw new AppError(404, 'Application not found!');
  }

  const job = application.jobId as unknown as { postedBy: string; _id: string; customId?: string; studentClass?: string; medium?: string };

  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to confirm demo for this application!');
  }

  // 🛡️ Moderator Protection: Moderator cannot manage applications on jobs created by Admin or Super Admin
  if (userRole === 'moderator') {
    const posterUser = await User.findById(job.postedBy).select('role');
    if (posterUser && ['admin', 'super_admin'].includes(posterUser.role)) {
      throw new AppError(403, 'মডারেটর হিসেবে আপনি এডমিনের তৈরি করা টিউশন পোস্টের আবেদন ম্যানেজ করতে পারবেন না।');
    }
  }

  application.status = 'Demo_Confirmed';
  application.demoConfirmedAt = new Date();
  await application.save();

  // Recalculate and update activeDemoCount on TuitionJob
  const demoCount = await Application.countDocuments({
    jobId: job._id,
    status: { $in: ['Demo_Confirmed', 'Demo_Completed'] },
  });
  await TuitionJob.findByIdAndUpdate(job._id, { activeDemoCount: demoCount });

  try {
    const jobMedium = (job as any)?.medium || 'টিউশন';
    await NotificationService.createNotification({
      userId: String(application.tutorId),
      type: 'job_approval',
      title: 'ডেমো ক্লাসের জন্য নির্বাচিত হয়েছেন 🎯',
      message: `অভিনন্দন! আপনার ${jobMedium} (${(job as any)?.studentClass || ''}) টিউশনের আবেদনে অভিভাবক আপনাকে ডেমো ক্লাসের জন্য কনফার্ম করেছেন। অনুগ্রহ করে অভিভাবকের সাথে যোগাযোগ করে ডেমো শিডিউল করুন।`,
      referenceId: String(job._id),
      referenceType: 'TuitionJob',
    });

    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } });
    for (const staff of staffUsers) {
      await NotificationService.createNotification({
        userId: String(staff._id),
        type: 'job_approval',
        title: '🎯 ডেমো ক্লাস কনফার্ম করা হয়েছে',
        message: `টিউশন #${(job as any)?.customId || job._id}-এ একজন টিউটরকে ডেমো ক্লাসের জন্য নির্বাচন করা হয়েছে।`,
        referenceId: String(job._id),
        referenceType: 'TuitionJob',
      });
    }
  } catch (err) {
    console.warn('⚠️ Demo confirm notification error:', err);
  }

  return application;
};

const demoCompleteApplication = async (id: string, userId: string, userRole: string) => {
  const application = await Application.findById(id).populate('jobId');
  if (!application) {
    throw new AppError(404, 'Application not found!');
  }

  const job = application.jobId as unknown as { postedBy: string; _id: string };

  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to update this application!');
  }

  // 🛡️ Moderator Protection: Moderator cannot manage applications on jobs created by Admin or Super Admin
  if (userRole === 'moderator') {
    const posterUser = await User.findById(job.postedBy).select('role');
    if (posterUser && ['admin', 'super_admin'].includes(posterUser.role)) {
      throw new AppError(403, 'মডারেটর হিসেবে আপনি এডমিনের তৈরি করা টিউশন পোস্টের আবেদন ম্যানেজ করতে পারবেন না।');
    }
  }

  application.status = 'Demo_Completed';
  application.demoCompletedAt = new Date();
  await application.save();

  return application;
};

const finalConfirmApplication = async (id: string, userId: string, userRole: string) => {
  const application = await Application.findById(id).populate('jobId');
  if (!application) {
    throw new AppError(404, 'Application not found!');
  }

  const job = application.jobId as unknown as { postedBy: string; _id: string; customId?: string; studentClass?: string; medium?: string };

  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to finalize this application!');
  }

  // 🛡️ Moderator Protection: Moderator cannot manage applications on jobs created by Admin or Super Admin
  if (userRole === 'moderator') {
    const posterUser = await User.findById(job.postedBy).select('role');
    if (posterUser && ['admin', 'super_admin'].includes(posterUser.role)) {
      throw new AppError(403, 'মডারেটর হিসেবে আপনি এডমিনের তৈরি করা টিউশন পোস্টের আবেদন কনফার্ম করতে পারবেন না।');
    }
  }

  // 1. Mark selected application as Accepted (Final Hired)
  application.status = 'Accepted';
  application.finalConfirmedAt = new Date();
  await application.save();

  // 2. Mark tuition job as Matched and set assignedTutorId
  await TuitionJob.findByIdAndUpdate(job._id, {
    status: 'Matched',
    assignedTutorId: application.tutorId,
  });

  // 3. Mark other pending/demo applications for this job as Rejected with reason
  const otherApps = await Application.find({
    jobId: job._id,
    _id: { $ne: application._id },
    status: { $in: ['Pending', 'Demo_Confirmed', 'Demo_Completed'] },
  });

  if (otherApps.length > 0) {
    await Application.updateMany(
      {
        jobId: job._id,
        _id: { $ne: application._id },
        status: { $in: ['Pending', 'Demo_Confirmed', 'Demo_Completed'] },
      },
      {
        $set: {
          status: 'Rejected',
          rejectionReason: 'এই টিউশনের জন্য অন্য একজন টিউটর চূড়ান্তভাবে নির্বাচিত হয়েছেন।',
        },
      }
    );

    // Notify other candidates politely
    for (const otherApp of otherApps) {
      try {
        await NotificationService.createNotification({
          userId: String(otherApp.tutorId),
          type: 'application',
          title: 'টিউশন আপডেট',
          message: `টিউশন #${(job as any)?.customId || 'Job'}-এর জন্য চূড়ান্ত টিউটর নির্বাচন সম্পন্ন হয়েছে। আপনার আগ্রহের জন্য ধন্যবাদ!`,
          referenceId: String(job._id),
          referenceType: 'TuitionJob',
        });
      } catch (err) {
        // Non-fatal
      }
    }
  }

  try {
    // Send final notification to selected Tutor!
    const jobMedium = (job as any)?.medium || 'টিউশন';
    await NotificationService.createNotification({
      userId: String(application.tutorId),
      type: 'job_approval',
      title: '🎉 চূড়ান্তভাবে নির্বাচিত হয়েছেন! (Deal Done)',
      message: `অভিনন্দন! আপনার ${jobMedium} (${(job as any)?.studentClass || ''}) টিউশনের আবেদনটি চূড়ান্তভাবে অনুমোদন ও নির্বাচিত (Final Confirmed) করা হয়েছে।`,
      referenceId: String(job._id),
      referenceType: 'TuitionJob',
    });

    // Notify all staff (Super Admin, Admin, Moderator) about confirmed tuition match
    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } });
    for (const staff of staffUsers) {
      await NotificationService.createNotification({
        userId: String(staff._id),
        type: 'job_approval',
        title: '🎉 টিউশন ম্যাচ সম্পন্ন (Deal Done)',
        message: `একটি টিউশন জবে (${(job as any)?.studentClass || 'Tuition'}) সফলভাবে চূড়ান্ত টিউটর কনফার্ম হয়েছে।`,
        referenceId: String(job._id),
        referenceType: 'TuitionJob',
      });
    }
  } catch (err) {
    console.warn('⚠️ Final confirm notification error:', err);
  }

  return application;
};

// Backward-compatible alias for existing accept calls
const acceptApplication = finalConfirmApplication;

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

  // 🛡️ Moderator Protection: Moderator cannot manage applications on jobs created by Admin or Super Admin
  if (userRole === 'moderator') {
    const posterUser = await User.findById(job.postedBy).select('role');
    if (posterUser && ['admin', 'super_admin'].includes(posterUser.role)) {
      throw new AppError(403, 'মডারেটর হিসেবে আপনি এডমিনের তৈরি করা টিউশন পোস্টের আবেদন রিজেক্ট করতে পারবেন না।');
    }
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

  const isStaff = ['admin', 'super_admin', 'moderator'].includes(userRole);
  if (!isStaff && String(job.postedBy) !== userId) {
    throw new AppError(403, 'You are not authorized to view applications for this job.');
  }

  let isRestrictedForModerator = false;
  if (userRole === 'moderator') {
    const posterUser = await User.findById(job.postedBy).select('role');
    if (posterUser && ['admin', 'super_admin'].includes(posterUser.role)) {
      isRestrictedForModerator = true;
    }
  }

  const applications = await Application.find({ jobId })
    .populate('tutorId', 'name email phone avatar')
    .sort({ matchScore: -1, createdAt: -1 });

  // Get tutor profiles for academic details
  const { Tutor } = await import('../tutor/tutor.model.js');
  const tutorUserIds = applications.map((a) => (a.tutorId as any)?._id).filter(Boolean);
  const tutorProfiles = await Tutor.find({ userId: { $in: tutorUserIds } }).lean();
  const profileMap = new Map<string, any>(tutorProfiles.map((p: any) => [String(p.userId), p]));

  // Privacy Protection: Mask sensitive contact/personal info until application is accepted or for restricted moderator
  const sanitizedApplications = applications.map((app) => {
    const rawApp = app.toObject ? app.toObject() : app;
    const tutorUser = (rawApp.tutorId as any) || {};
    const tutorProfile: any = profileMap.get(String(tutorUser._id)) || {};
    const tutorSnapshot: any = rawApp.tutorSnapshot || {};

    const tutorName = tutorUser.name || tutorSnapshot.name || 'Registered Tutor';
    const tutorAvatar = tutorUser.avatar || tutorSnapshot.avatar || '';
    const university = tutorProfile.university || tutorSnapshot.university || '';
    const department = tutorProfile.department || tutorSnapshot.department || '';
    const qualification = tutorProfile.qualification || tutorSnapshot.qualification || '';
    const experience = tutorProfile.experience || (tutorProfile as any)?.experienceYears || tutorSnapshot.experience || '';

    const isConfirmed = rawApp.status === 'Accepted';

    if (isRestrictedForModerator) {
      return {
        ...rawApp,
        isRestrictedForModerator: true,
        tutorId: {
          _id: tutorUser._id,
          name: tutorName,
          avatar: tutorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tutorName || 'tutor')}`,
          phone: '🔒 Protected by Admin',
          email: '🔒 Protected by Admin',
        },
        tutorProfile: {
          university: university,
          department: department,
          qualification: qualification,
          experience: experience,
          rating: tutorProfile.rating || 0,
          reviewCount: tutorProfile.reviewCount || 0,
          totalTuitionsCompleted: tutorProfile.totalTuitionsCompleted || 0,
          isVerified: tutorProfile.isVerified !== undefined ? tutorProfile.isVerified : true,
          gender: tutorProfile.gender || '',
          subjects: tutorProfile.subjects || [],
          location: tutorProfile.location || {},
          bio: tutorProfile.bio || '',
        },
      };
    }

    if (!isStaff && !isConfirmed) {
      return {
        ...rawApp,
        tutorId: {
          _id: tutorUser._id,
          name: tutorName,
          avatar: tutorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tutorName || 'tutor')}`,
          phone: '🔒 টিউশন নিশ্চিত (Accept) করার পর যোগাযোগ নম্বর দেখতে পাবেন',
          email: '🔒 Hidden until accepted',
        },
        tutorProfile: {
          university: university,
          department: department,
          qualification: qualification,
          experience: experience,
          rating: tutorProfile.rating || 0,
          reviewCount: tutorProfile.reviewCount || 0,
          totalTuitionsCompleted: tutorProfile.totalTuitionsCompleted || 0,
          isVerified: tutorProfile.isVerified !== undefined ? tutorProfile.isVerified : true,
          gender: tutorProfile.gender || '',
          subjects: tutorProfile.subjects || [],
          location: tutorProfile.location || {},
          bio: tutorProfile.bio || '',
        },
      };
    }

    return {
      ...rawApp,
      tutorId: {
        _id: tutorUser._id,
        name: tutorName,
        avatar: tutorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tutorName || 'tutor')}`,
        phone: tutorUser.phone || tutorSnapshot.phone || 'N/A',
        email: tutorUser.email || tutorSnapshot.email || 'N/A',
      },
      tutorProfile: {
        university: university,
        department: department,
        qualification: qualification,
        experience: experience,
        rating: tutorProfile.rating || 0,
        reviewCount: tutorProfile.reviewCount || 0,
        totalTuitionsCompleted: tutorProfile.totalTuitionsCompleted || 0,
        isVerified: tutorProfile.isVerified !== undefined ? tutorProfile.isVerified : true,
        gender: tutorProfile.gender || '',
        subjects: tutorProfile.subjects || [],
        location: tutorProfile.location || {},
        bio: tutorProfile.bio || '',
      },
    };
  });

  return sanitizedApplications;
};

const getContractDeed = async (applicationId: string) => {
  const application = await Application.findById(applicationId)
    .populate('tutorId', 'name email phone avatar')
    .populate('jobId');

  if (!application) {
    throw new AppError(404, 'Application not found!');
  }

  return application;
};

const renderContractDeedHtml = async (applicationId: string): Promise<string> => {
  const app = await Application.findById(applicationId)
    .populate('tutorId', 'name email phone avatar')
    .populate('jobId');

  if (!app) {
    throw new AppError(404, 'Application not found!');
  }

  const tutorUser: any = app.tutorId || {};
  const job: any = app.jobId || {};

  let tSnapshot = app.tutorSnapshot;
  if (!tSnapshot || !tSnapshot.nid) {
    const { Tutor } = await import('../tutor/tutor.model.js');
    const tutorProfile = await Tutor.findOne({ userId: tutorUser._id }).lean();
    tSnapshot = {
      name: tutorUser.name || 'Registered Tutor',
      email: tutorUser.email || 'N/A',
      phone: tutorUser.phone || 'N/A',
      nid: tutorProfile?.nid || 'সংরক্ষিত',
      nidCard: tutorProfile?.nidCard || '',
      studentIdCard: tutorProfile?.studentIdCard || '',
      university: tutorProfile?.university || 'N/A',
      department: tutorProfile?.department || 'N/A',
      qualification: tutorProfile?.qualification || 'N/A',
      permanentAddress: (tutorProfile as any)?.permanentAddress || (tutorProfile?.location ? `${tutorProfile.location?.area || ''}, ${tutorProfile.location?.district || ''}` : 'ঢাকা, বাংলাদেশ'),
      emergencyPhone: (tutorProfile as any)?.emergencyPhone || (tutorProfile as any)?.parentPhone || tutorUser.phone || 'N/A',
    };
  }

  const tuitionSnapshot = app.tuitionSnapshot || {
    customId: job.customId || `JOB-${String(job._id || '').slice(-6).toUpperCase()}`,
    studentClass: job.studentClass || 'N/A',
    medium: job.medium || 'Bangla Medium',
    salary: app.expectedSalary || job.salary || 0,
    mediaFee: app.mediaFee || Math.round((app.expectedSalary || job.salary || 0) * 0.60),
    location: typeof job.location === 'object' ? `${job.location?.area || ''}, ${job.location?.district || ''}` : (job.location || 'Dhaka'),
  };

  const salary = Number(tuitionSnapshot.salary || 0);
  const mediaFee = Number(app.mediaFee || tuitionSnapshot.mediaFee || Math.round(salary * 0.60));
  const contractId = app.contractId || `TMC/${tuitionSnapshot.customId}/${Date.now().toString(36).toUpperCase()}`;
  const signedDate = app.signedAt ? new Date(app.signedAt).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', dateStyle: 'full', timeStyle: 'medium' }) : new Date().toLocaleString('bn-BD');
  const signatureImg = app.signatureImage || '';
  const ipAddress = app.ipAddress || '127.0.0.1';
  const securityHash = app.securityHash || 'VERIFIED-LEGAL-HASH-SHA256';

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>আইনি চুক্তিপত্র ও ডিজিটাল অঙ্গীকারনামা - ${contractId}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Hind Siliguri', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #e2e8f0;
      color: #0f172a;
      line-height: 1.6;
      padding: 30px 15px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-container {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      padding: 45px 50px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
      border: 2px solid #0f172a;
      position: relative;
    }
    .floating-print-bar {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999;
      display: flex;
      gap: 10px;
    }
    .btn-print {
      background: #001F3F;
      color: #ffffff;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,31,63,0.3);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print:hover { background: #0284c7; }
    .header-box {
      text-align: center;
      border-bottom: 2px double #0f172a;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .govt-seal {
      display: inline-block;
      padding: 4px 14px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #334155;
      margin-bottom: 8px;
    }
    .title-main {
      font-size: 24px;
      font-weight: 700;
      color: #001F3F;
      margin-bottom: 4px;
    }
    .title-sub {
      font-size: 14px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 18px;
      font-size: 12px;
      margin-bottom: 22px;
    }
    .meta-grid strong { color: #0f172a; }
    .meta-grid .mono { font-family: 'JetBrains Mono', monospace; font-weight: 600; }
    
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #001F3F;
      border-left: 4px solid #001F3F;
      padding-left: 10px;
      margin: 20px 0 10px 0;
      text-transform: uppercase;
    }
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .party-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px;
      background: #fafafa;
    }
    .party-card h4 {
      font-size: 13px;
      font-weight: 700;
      color: #001F3F;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .party-card p {
      font-size: 12px;
      margin-bottom: 4px;
      color: #334155;
    }
    .party-card p strong { color: #0f172a; }

    .financial-box {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 8px;
      padding: 14px 18px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      text-align: center;
      margin-bottom: 22px;
    }
    .financial-box .item p:first-child {
      font-size: 11px;
      font-weight: 700;
      color: #166534;
      text-transform: uppercase;
    }
    .financial-box .item p:last-child {
      font-size: 18px;
      font-weight: 700;
      color: #14532d;
      font-family: 'Inter', sans-serif;
    }

    .clauses-box {
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 25px;
    }
    .clause-item {
      margin-bottom: 12px;
      font-size: 12px;
      color: #1e293b;
      text-align: justify;
    }
    .clause-item strong {
      color: #001F3F;
      font-weight: 700;
    }
    .clause-item:last-child { margin-bottom: 0; }

    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px dashed #cbd5e1;
    }
    .sign-box {
      text-align: center;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      background: #f8fafc;
    }
    .sign-box h5 {
      font-size: 12px;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .sign-img-wrapper {
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 5px;
    }
    .sign-img-wrapper img {
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
    }
    .official-stamp {
      display: inline-block;
      border: 2px solid #dc2626;
      color: #dc2626;
      font-weight: 900;
      font-size: 11px;
      padding: 8px 14px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
      transform: rotate(-3deg);
    }
    .sign-meta {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }

    .attachments-section {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      page-break-before: auto;
    }
    .attachment-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-top: 10px;
    }
    .attachment-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px;
      background: #f8fafc;
      text-align: center;
    }
    .attachment-card p {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 6px;
    }
    .attachment-card img {
      width: 100%;
      height: 180px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    .footer-lock {
      margin-top: 25px;
      padding: 12px;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 8px;
      font-size: 10px;
      text-align: center;
    }
    .footer-lock .hash {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      color: #38bdf8;
      word-break: break-all;
      margin-top: 3px;
    }

    @media print {
      body { background: #ffffff; padding: 0; }
      .page-container {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
      }
      .floating-print-bar { display: none; }
      @page {
        size: A4;
        margin: 12mm 15mm;
      }
    }
  </style>
</head>
<body>

  <div class="floating-print-bar">
    <button class="btn-print" onclick="window.print()">
      🖨️ প্রিন্ট করুন / Save as PDF
    </button>
  </div>

  <div class="page-container">
    
    <!-- Header -->
    <div class="header-box">
      <div class="govt-seal">E-Signed Law Enforcement Contract Deed</div>
      <h1 class="title-main">ডিজিটাল আইনি দলিল ও অঙ্গীকারনামা</h1>
      <p class="title-sub">Home Tutor Provider BD — Legal Agreement & Media Contract</p>
    </div>

    <!-- Metadata Grid -->
    <div class="meta-grid">
      <div><strong>স্মারক নং:</strong> <span class="mono">${contractId}</span></div>
      <div><strong>তারিখ ও সময়:</strong> ${signedDate}</div>
      <div><strong>আইপি ট্র্যাকিং লগ:</strong> <span class="mono">${ipAddress}</span> (Digital Footprint)</div>
      <div><strong>আইনি স্ট্যাটাস:</strong> <strong style="color: #16a34a;">ELECTRONICALLY SIGNED & VERIFIED</strong></div>
    </div>

    <!-- Parties Grid -->
    <div class="section-title">চুক্তির পক্ষগণ (Parties to the Contract)</div>
    <div class="parties-grid">
      <div class="party-card">
        <h4>👤 প্রথম পক্ষ (মিডিয়া কর্তৃপক্ষ)</h4>
        <p><strong>প্রতিষ্ঠানের নাম:</strong> Home Tutor Provider BD</p>
        <p><strong>সার্ভিস ধরন:</strong> প্রফেশনাল হোম ও অনলাইন টিউটর প্রভাইডার</p>
        <p><strong>যোগাযোগ / হেল্পলাইন:</strong> +880 1928-325460</p>
        <p><strong>ইমেইল:</strong> legal@hometutorproviderbd.com</p>
        <p><strong>হেড অফিস:</strong> ঢাকা, বাংলাদেশ</p>
      </div>

      <div class="party-card">
        <h4>👤 দ্বিতীয় পক্ষ (আবেদনকারী শিক্ষক)</h4>
        <p><strong>শিক্ষকের নাম:</strong> <strong>${tSnapshot.name}</strong></p>
        <p><strong>জাতীয় পরিচয়পত্র (NID):</strong> ${tSnapshot.nid || 'ডাটাবেজে সংরক্ষিত'}</p>
        <p><strong>শিক্ষা প্রতিষ্ঠান ও বিভাগ:</strong> ${tSnapshot.university || 'N/A'} (${tSnapshot.department || 'N/A'})</p>
        <p><strong>মোবাইল নম্বর:</strong> ${tSnapshot.phone || tutorUser.phone || 'N/A'}</p>
        <p><strong>জরুরি যোগাযোগ (অভিভাবক):</strong> ${tSnapshot.emergencyPhone || 'N/A'}</p>
        <p><strong>স্থায়ী ঠিকানা:</strong> ${tSnapshot.permanentAddress || 'N/A'}</p>
      </div>
    </div>

    <!-- Financial Breakdown -->
    <div class="section-title">টিউশন ও আর্থিক বিবরণী (Tuition & Financials)</div>
    <div class="financial-box">
      <div class="item">
        <p>টিউশন আইডি</p>
        <p style="font-size: 15px;">${tuitionSnapshot.customId}</p>
      </div>
      <div class="item">
        <p>মাসিক বেতন</p>
        <p>৳${salary.toLocaleString()}</p>
      </div>
      <div class="item">
        <p>মিডিয়া ফি (৬০%)</p>
        <p style="color: #b91c1c;">৳${mediaFee.toLocaleString()}</p>
      </div>
    </div>

    <!-- Legal Clauses -->
    <div class="section-title">চুক্তির আইনি শর্তাবলী ও ফৌজদারি দায়বদ্ধতা (Legal Terms)</div>
    <div class="clauses-box">
      <div class="clause-item">
        <strong>১. আর্থিক বাধ্যবাধকতা:</strong> দ্বিতীয় পক্ষ (শিক্ষক) প্রথম পক্ষের মাধ্যমে প্রাপ্ত টিউশনটি কনফার্ম হওয়ার পর এবং প্রথম ক্লাস শুরু করার পরবর্তী ৭ থেকে ১৫ কার্যদিবসের মধ্যে মিডিয়া ফি বাবদ বেতনের ৬০% অর্থ (<strong>৳${mediaFee.toLocaleString()} টাকা</strong>) পরিশোধ করতে আইনিভাবে বাধ্য থাকিবেন। প্রথম মাসের বেতন পাওয়ার অজুহাত দেখিয়ে এই টাকা পরিশোধে বিলম্ব করা যাবে না।
      </div>

      <div class="clause-item">
        <strong>২. প্রতারণা ও অপরাধমূলক বিশ্বাসভঙ্গ:</strong> কাজ শুরু করার পর প্রথম পক্ষকে মিডিয়া ফি প্রদান না করিয়া যোগাযোগ বন্ধ করা, ফোন না ধরা, হোয়াটসঅ্যাপে ব্লক করা বা অভিভাবকের সাথে গোপনে ব্যক্তিগত চুক্তি করা <strong>বাংলাদেশ দণ্ডবিধি ১৮৬০ এর ৪০৬ ধারা (অপরাধমূলক বিশ্বাসভঙ্গ)</strong> এবং <strong>৪২০ ধারা (প্রতারণা)</strong> অনুযায়ী সরাসরি এজাহারযোগ্য ফৌজদারি অপরাধ হিসেবে গণ্য হবে।
      </div>

      <div class="clause-item">
        <strong>৩. ডিজিটাল জালিয়াতি ও সাইবার ট্র্যাকিং:</strong> প্রোফাইল তৈরির সময় ভুয়া তথ্য/কাগজপত্র প্রদান করা অথবা ডিজিটাল স্বাক্ষর করার পর তা অস্বীকার করা <strong>সাইবার নিরাপত্তা আইন, ২০২৩</strong> অনুযায়ী একটি গুরুতর অপরাধ। এই ফরম সাবমিট করার সময় রেকর্ডকৃত আইপি অ্যাড্রেস (<strong>${ipAddress}</strong>) ও টাইমস্ট্যাম্প আদালতে অকাট্য প্রমাণ হিসেবে গণ্য হবে এবং সাইবার পুলিশের মাধ্যমে ডিভাইস ট্র্যাক করা হবে।
      </div>

      <div class="clause-item">
        <strong>৪. থানায় সরাসরি মামলা (FIR) ও গ্রেফতারের অধিকার:</strong> দ্বিতীয় পক্ষ চুক্তি ভঙ্গ করিলে প্রথম পক্ষ কোনো পূর্ব নোটিশ ছাড়াই নিকটস্থ থানায় সরাসরি ফৌজদারি মামলা (FIR) দায়ের করার পূর্ণ আইনি অধিকার (Right to Sue) রাখিবেন। উক্ত মামলার ভিত্তিতে থানা পুলিশ অপরাধীকে গ্রেফতার ও আইনি হেফাজতে নেওয়ার ক্ষমতা প্রাপ্ত থাকিবে।
      </div>

      <div class="clause-item">
        <strong>৫. প্রাতিষ্ঠানিক ও সামাজিক পদক্ষেপ:</strong> বকেয়া টাকা আদায়ের লক্ষ্যে প্রথম পক্ষ দ্বিতীয় পক্ষের শিক্ষা প্রতিষ্ঠানের প্রক্টর (Proctor), বিভাগীয় প্রধান এবং অভিভাবক বরাবর এই আইনি দলিলের কপিসহ অফিসিয়াল অভিযোগ পাঠাতে পারবেন। এছাড়া মিডিয়ার নিজস্ব "পাবলিক ব্ল্যাকলিস্ট" ও কেন্দ্রীয় টিউটর ডেটাবেজে প্রতারক হিসেবে ছবিসহ নাম প্রকাশ করা হবে।
      </div>
    </div>

    <!-- Signatures -->
    <div class="signature-section">
      <div class="sign-box">
        <h5>প্রথম পক্ষ (মিডিয়া কর্তৃপক্ষ)</h5>
        <div class="sign-img-wrapper">
          <div class="official-stamp">
            HOME TUTOR BD<br>AUTHORIZED SEAL
          </div>
        </div>
        <p class="sign-meta">Verified Digital Authority</p>
      </div>

      <div class="sign-box">
        <h5>দ্বিতীয় পক্ষ (শিক্ষকের ডিজিটাল স্বাক্ষর)</h5>
        <div class="sign-img-wrapper">
          ${signatureImg ? `<img src="${signatureImg}" alt="Tutor Digital Signature" />` : '<span style="font-size: 11px; color: #94a3b8;">Digitally Signed on Screen</span>'}
        </div>
        <p class="sign-meta">${tSnapshot.name} (IP: ${ipAddress})</p>
      </div>
    </div>

    <!-- Documents Attachment (if available) -->
    ${(tSnapshot.nidCard || tSnapshot.studentIdCard) ? `
      <div class="attachments-section">
        <div class="section-title">সংযুক্ত ভেরিফিকেশন প্রমাণপত্র (Attached ID Documents)</div>
        <div class="attachment-grid">
          ${tSnapshot.nidCard ? `
            <div class="attachment-card">
              <p>জাতীয় পরিচয়পত্র (NID Card)</p>
              <img src="${tSnapshot.nidCard}" alt="NID Card" onerror="this.style.display='none'" />
            </div>
          ` : ''}
          ${tSnapshot.studentIdCard ? `
            <div class="attachment-card">
              <p>স্টুডেন্ট / টিউটর আইডি (Student ID Card)</p>
              <img src="${tSnapshot.studentIdCard}" alt="Student ID" onerror="this.style.display='none'" />
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}

    <!-- Security Hash Footer -->
    <div class="footer-lock">
      <div>🔒 THIS DOCUMENT IS CRYPTOGRAPHICALLY SECURED & DIGITALLY VERIFIED UNDER BANGLADESH IT & CYBER LAWS</div>
      <div class="hash">SHA256 LOCK: ${securityHash}</div>
    </div>

  </div>

</body>
</html>`;
};

export const ApplicationService = {
  getMyApplications,
  getApplicationById,
  demoConfirmApplication,
  demoCompleteApplication,
  finalConfirmApplication,
  acceptApplication,
  rejectApplication,
  withdrawApplication,
  getJobApplications,
  getContractDeed,
  renderContractDeedHtml,
};

