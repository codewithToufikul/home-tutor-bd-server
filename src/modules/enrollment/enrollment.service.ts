import { AppError } from '../../errors/AppError.js';
import { sendRealtimeNotification } from '../../services/socket.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { User } from '../user/user.model.js';
import { Coaching } from '../coaching/coaching.model.js';
import { Enrollment } from './enrollment.model.js';

/* ─── Student enroll in a batch ─── */
const enroll = async (coachingId: string, batchId: string, studentUserId: string, extraData?: { phone?: string; institution?: string; studentClass?: string; note?: string }) => {
  const coaching = await Coaching.findById(coachingId);
  if (!coaching) throw new AppError(404, 'Coaching center not found!');

  const batch = (coaching.batches as any[]).find(
    (b) => String(b._id || b.id) === String(batchId),
  );
  if (!batch) throw new AppError(404, 'Batch not found!');

  const student = await User.findById(studentUserId);
  if (!student) throw new AppError(404, 'Student not found!');

  // Prevent duplicate enrollment
  const existing = await Enrollment.findOne({ coachingId, batchId, studentUserId });
  if (existing) {
    throw new AppError(409, 'You have already applied for this batch.');
  }

  const enrollment = await Enrollment.create({
    coachingId,
    batchId,
    batchName:    batch.batchName,
    studentUserId,
    studentName:  student.name  || '',
    studentEmail: student.email || '',
    studentPhone: extraData?.phone || (student as any).phone || '',
    institution:  extraData?.institution || '',
    studentClass: extraData?.studentClass || batch.className || '',
    note:         extraData?.note || '',
    status: 'pending',
  });

  /* ── Real-time Socket.IO notification to coaching dashboard ── */
  const notifPayload = {
    _id:     enrollment._id,
    type:    'enrollment_request',
    title:   '🎓 নতুন ভর্তির আবেদন',
    message: `${student.name || 'একজন শিক্ষার্থী'} "${batch.batchName}" ব্যাচে ভর্তির আবেদন করেছেন।`,
    referenceId:   String(enrollment._id),
    referenceType: 'Enrollment',
    isRead: false,
    createdAt: new Date(),
    enrollment: {
      _id:         String(enrollment._id),
      batchId,
      batchName:   batch.batchName,
      studentName: student.name,
      studentEmail:student.email,
      studentPhone:(student as any).phone || '',
      status:      'pending',
    },
  };

  // Emit real-time notification to the coaching user's socket room
  sendRealtimeNotification(String(coaching.userId), notifPayload);

  // Also persist the notification in DB
  await NotificationService.createNotification({
    userId:        String(coaching.userId),
    type:          'system',
    title:         '🎓 নতুন ভর্তির আবেদন',
    message:       `${student.name || 'একজন শিক্ষার্থী'} আপনার "${batch.batchName}" ব্যাচে ভর্তির আবেদন করেছেন।`,
    referenceId:   String(enrollment._id),
    referenceType: 'Enrollment',
  });

  return enrollment;
};

/* ─── Coaching: get all enrollments for my coaching ─── */
const getMyEnrollments = async (coachingUserId: string) => {
  const coaching = await Coaching.findOne({ userId: coachingUserId });
  if (!coaching) throw new AppError(404, 'Coaching profile not found!');

  return await Enrollment.find({ coachingId: coaching._id })
    .sort({ createdAt: -1 })
    .populate('studentUserId', 'name email avatar');
};

/* ─── Coaching: update enrollment status (approve / reject) ─── */
const updateEnrollmentStatus = async (
  coachingUserId: string,
  enrollmentId: string,
  status: 'approved' | 'rejected',
  note?: string,
) => {
  const coaching = await Coaching.findOne({ userId: coachingUserId });
  if (!coaching) throw new AppError(404, 'Coaching profile not found!');

  const enrollment = await Enrollment.findOne({ _id: enrollmentId, coachingId: coaching._id });
  if (!enrollment) throw new AppError(404, 'Enrollment not found!');

  enrollment.status = status;
  if (note) enrollment.note = note;
  await enrollment.save();

  // If approved → increment enrolledCount on the batch
  if (status === 'approved') {
    const batch = (coaching.batches as any[]).find(
      (b) => String(b._id || b.id) === String(enrollment.batchId),
    );
    if (batch) {
      batch.enrolledCount = (batch.enrolledCount || 0) + 1;
      await coaching.save();
    }
  }

  // Notify student about the result
  const titleMap = { approved: '✅ ভর্তি অনুমোদিত', rejected: '❌ ভর্তি বাতিল' };
  const msgMap = {
    approved: `অভিনন্দন! আপনার "${enrollment.batchName}" ব্যাচে ভর্তির আবেদন অনুমোদিত হয়েছে।`,
    rejected: `দুঃখিত, আপনার "${enrollment.batchName}" ব্যাচে ভর্তির আবেদন গৃহীত হয়নি।`,
  };

  try {
    const notifData = {
      _id:     `status-${Date.now()}`,
      type:    'enrollment_result',
      title:   titleMap[status],
      message: msgMap[status],
      isRead:  false,
      createdAt: new Date(),
    };

    // Real-time socket to student
    sendRealtimeNotification(String(enrollment.studentUserId), notifData);

    // Persist notification for student
    await NotificationService.createNotification({
      userId:        String(enrollment.studentUserId),
      type:          'system',
      title:         titleMap[status],
      message:       msgMap[status],
      referenceId:   String(enrollment._id),
      referenceType: 'Enrollment',
    });
  } catch (err) {
    console.warn('⚠️ Student notification error:', err);
  }

  return enrollment;
};

/* ─── Student: get my enrollments ─── */
const getStudentEnrollments = async (studentUserId: string) => {
  return await Enrollment.find({ studentUserId })
    .sort({ createdAt: -1 })
    .populate('coachingId', 'instituteName district location');
};

export const EnrollmentService = {
  enroll,
  getMyEnrollments,
  updateEnrollmentStatus,
  getStudentEnrollments,
};
