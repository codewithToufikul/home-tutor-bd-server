import { NotificationService } from '../notification/notification.service.js';
import { AppError } from '../../errors/AppError.js';
import { User } from '../user/user.model.js';
import type { ICoachingBatch, ICoachingProfile } from './coaching.interface.js';
import { Coaching } from './coaching.model.js';

const getProfile = async (userId: string) => {
  let profile = await Coaching.findOne({ userId }).populate('assignedTutorIds', 'name email phone avatar');
  if (!profile) {
    const user = await User.findById(userId);
    if (!user) throw new AppError(404, 'User not found!');
    profile = await Coaching.create({
      userId: user._id,
      instituteName: user.name || 'Coaching Institute',
      email: user.email || '',
      phone: user.phone || '',
      batches: [],
      assignedTutorIds: [],
    });
  }
  return profile;
};

const updateProfile = async (userId: string, payload: Partial<ICoachingProfile>) => {
  let profile = await Coaching.findOne({ userId });
  if (!profile) {
    profile = await getProfile(userId);
  }
  const updated = await Coaching.findOneAndUpdate(
    { userId },
    { $set: payload },
    { new: true, runValidators: true }
  );

  if (payload.instituteName) {
    await User.findByIdAndUpdate(userId, { name: payload.instituteName });
  }

  return updated;
};

const createBatch = async (userId: string, batchData: ICoachingBatch) => {
  let profile = await Coaching.findOne({ userId });
  if (!profile) {
    profile = await getProfile(userId);
  }
  profile.batches.push(batchData);
  await profile.save();
  return profile;
};

const deleteBatch = async (userId: string, batchId: string) => {
  const profile = await Coaching.findOne({ userId });
  if (!profile) throw new AppError(404, 'Coaching profile not found!');
  profile.batches = profile.batches.filter((b: any) => String(b._id || b.id) !== String(batchId));
  await profile.save();
  return profile;
};

const getStats = async (userId: string) => {
  const profile = await getProfile(userId);
  const activeBatches = profile.batches.filter((b) => b.status === 'Active').length;
  const totalStudents = profile.batches.reduce((sum, b) => sum + (b.enrolledCount || 0), 0);
  const assignedTutorsCount = Array.isArray(profile.assignedTutorIds) ? profile.assignedTutorIds.length : 0;

  return {
    totalBatches: profile.batches.length,
    activeBatches,
    activeStudents: totalStudents,
    assignedTutors: assignedTutorsCount,
    pendingRequests: 0,
  };
};

const getAllCoachingCenters = async () => {
  return await Coaching.find().populate('userId', 'name email phone avatar status isApproved');
};


const enrollInBatch = async (coachingId: string, batchId: string, studentUserId: string) => {
  const coaching = await Coaching.findById(coachingId);
  if (!coaching) throw new AppError(404, 'Coaching center not found!');

  const batch = coaching.batches.find((b: any) => String(b._id || b.id) === String(batchId));
  if (!batch) throw new AppError(404, 'Coaching batch not found!');

  const student = await User.findById(studentUserId);
  if (!student) throw new AppError(404, 'Student user not found!');

  batch.enrolledCount = (batch.enrolledCount || 0) + 1;
  await coaching.save();

  try {
    await NotificationService.createNotification({
      userId: String(coaching.userId),
      type: 'system',
      title: 'নতুন শিক্ষার্থী ভর্তি 🎓',
      message: `অভিনন্দন! ${student.name || 'একজন নতুন শিক্ষার্থী'} আপনার "${batch.batchName}" ব্যাচে ভর্তির আবেদন করেছেন। (ফোন: ${student.phone || 'N/A'})`,
      referenceId: String(coaching._id),
      referenceType: 'Coaching',
    });
  } catch (err) {
    console.warn('⚠️ Enrollment notification error:', err);
  }

  return { success: true, batch, student };
};

export const CoachingService = {
  enrollInBatch,
  getProfile,
  updateProfile,
  createBatch,
  deleteBatch,
  getStats,
  getAllCoachingCenters,
};
