import { AppError } from '../../errors/AppError.js';
import { Application } from '../application/application.model.js';
import { Payment, Withdrawal } from '../payment/payment.model.js';
import { TuitionJob } from '../tuition/tuition.model.js';
import { Tutor } from '../tutor/tutor.model.js';
import { User } from '../user/user.model.js';
import { Verification } from '../verification/verification.model.js';

const getDashboardStats = async () => {
  const totalUsers = await User.countDocuments();
  const totalTutors = await Tutor.countDocuments();
  const totalJobs = await TuitionJob.countDocuments();
  const totalApplications = await Application.countDocuments();

  const pendingVerifications = await Verification.countDocuments({ status: 'Pending' });
  const pendingJobs = await TuitionJob.countDocuments({ approvalStatus: 'Pending' });
  const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'Pending' });

  return {
    totalUsers,
    totalTutors,
    totalJobs,
    totalApplications,
    pendingVerifications,
    pendingJobs,
    pendingWithdrawals,
  };
};

const getAllUsers = async (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;

  const users = await User.find(filter).sort({ createdAt: -1 });
  return users;
};

const updateUserStatus = async (id: string, status: 'active' | 'blocked' | 'pending') => {
  const user = await User.findByIdAndUpdate(id, { status }, { new: true });
  if (!user) {
    throw new AppError(404, 'User not found!');
  }
  return user;
};

const getPendingTutors = async () => {
  const tutors = await Tutor.find({ isVerified: false }).populate('userId', 'name email phone avatar status');
  return tutors;
};

const approveTutor = async (tutorId: string, isApproved: boolean) => {
  const tutor = await Tutor.findByIdAndUpdate(tutorId, { isVerified: isApproved }, { new: true });
  if (!tutor) {
    throw new AppError(404, 'Tutor profile not found!');
  }

  await User.findByIdAndUpdate(tutor.userId, { isApproved });
  return tutor;
};

const getPendingJobs = async () => {
  const jobs = await TuitionJob.find({ approvalStatus: 'Pending' }).populate('postedBy', 'name email phone avatar');
  return jobs;
};

const approveJob = async (jobId: string, approvalStatus: 'Approved' | 'Rejected') => {
  const job = await TuitionJob.findByIdAndUpdate(jobId, { approvalStatus }, { new: true });
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

  const payment = await Payment.findByIdAndUpdate(id, { status }, { new: true });
  if (!payment) {
    throw new AppError(404, 'Payment or withdrawal record not found!');
  }
  return payment;
};

export const AdminService = {
  getDashboardStats,
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
};
