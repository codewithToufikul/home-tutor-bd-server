import { Payment } from './payment.model.js';
import { TuitionJob } from '../tuition/tuition.model.js';
import { Application } from '../application/application.model.js';
import { User } from '../user/user.model.js';
import { NotificationService } from '../notification/notification.service.js';
import { uploadToR2 } from '../../config/r2.js';
import { AppError } from '../../errors/AppError.js';
import type { IPayment } from './payment.interface.js';

// 1. Submit Payment Request by Tutor
const submitPayment = async (
  userId: string,
  payload: {
    tuitionJobId?: string;
    applicationId?: string;
    paymentType?: 'tuition_fee' | 'verification_fee' | 'wallet_recharge';
    amount: number;
    paymentMethod: 'bkash' | 'nagad' | 'rocket' | 'bank';
    senderNumber: string;
    transactionId: string;
    notes?: string;
  },
  fileBuffer?: Buffer
) => {
  const cleanTrxId = payload.transactionId.trim().toUpperCase();

  // Check unique TrxID
  const existingTrx = await Payment.findOne({ transactionId: cleanTrxId });
  if (existingTrx) {
    throw new AppError(400, 'এই Transaction ID (TrxID) টি পূর্বে ব্যবহার করা হয়েছে! দয়া করে সঠিক TrxID দিন।');
  }

  let payableAmount = Number(payload.amount);
  let tuitionJob = null;

  if (payload.tuitionJobId) {
    tuitionJob = await TuitionJob.findById(payload.tuitionJobId);
    if (tuitionJob && tuitionJob.salary) {
      // Platform Fee is 60% of 1st month salary
      payableAmount = Math.round(Number(tuitionJob.salary) * 0.6);
    }
  }

  // Upload receipt screenshot to Cloudflare R2 if provided
  let receiptUrl: string | undefined = undefined;
  let receiptPublicId: string | undefined = undefined;

  if (fileBuffer) {
    try {
      const uploadResult = await uploadToR2(fileBuffer, 'home-tutor-bd/receipts', 'receipt.jpg', 'image/jpeg');
      receiptUrl = uploadResult.url;
      receiptPublicId = uploadResult.key;
    } catch (err) {
      console.warn('Receipt upload failed, continuing without receipt image:', err);
    }
  }

  const paymentData: Record<string, any> = {
    userId,
    paymentType: payload.paymentType || 'tuition_fee',
    amount: Number(payload.amount),
    payableAmount: payableAmount || Number(payload.amount),
    paymentMethod: payload.paymentMethod,
    senderNumber: payload.senderNumber.trim(),
    transactionId: cleanTrxId,
    notes: payload.notes || '',
    status: 'pending',
  };

  if (payload.tuitionJobId) paymentData.tuitionJobId = payload.tuitionJobId;
  if (payload.applicationId) paymentData.applicationId = payload.applicationId;
  if (receiptUrl) paymentData.receiptUrl = receiptUrl;
  if (receiptPublicId) paymentData.receiptPublicId = receiptPublicId;

  const payment = await Payment.create(paymentData);

  // Notify Admins about new payment submission
  const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } }).select('_id').lean();
  const tutorUser = await User.findById(userId).select('name phone').lean();

  const notifPromises = admins.map((admin) =>
    NotificationService.createNotification({
      userId: String(admin._id),
      type: 'system',
      title: '💳 নতুন পেমেন্ট সাবমিশন',
      message: `${tutorUser?.name || 'টিউটর'} ৳${payload.amount} টাকার পেমেন্ট জমা দিয়েছেন (TrxID: ${cleanTrxId})। ভেরিফাই করুন।`,
      referenceId: String(payment._id),
      referenceType: 'payment',
    }).catch(() => null)
  );
  await Promise.allSettled(notifPromises);

  return payment;
};

// 2. Get Tutor's Active Tuitions for Payment
const getTutorActiveTuitions = async (userId: string) => {
  // Find applications where status is accepted (case-insensitive)
  const applications = await Application.find({
    tutorId: userId,
    status: { $in: ['Accepted', 'accepted', 'Hired', 'hired', 'Approved', 'approved'] },
  } as any)
    .populate('jobId')
    .sort({ updatedAt: -1 })
    .lean();

  // Find all approved / pending payments for this tutor
  const payments = await Payment.find({ userId }).lean();

  const results = applications.map((app: any) => {
    const job = app.jobId || {};
    const salary = Number(job.salary || app.expectedSalary || 0);
    const mediaFee = Number(app.mediaFee || Math.round(salary * 0.6));
    const platformFee = mediaFee > 0 ? mediaFee : Math.round(salary * 0.6);

    const relatedPayments = payments.filter(
      (p) => String(p.tuitionJobId) === String(job._id || '') && p.status === 'approved'
    );
    const pendingPayments = payments.filter(
      (p) => String(p.tuitionJobId) === String(job._id || '') && p.status === 'pending'
    );

    const totalPaid = relatedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const hasPending = pendingPayments.length > 0;
    const isPaid = totalPaid >= platformFee && platformFee > 0;
    const dueAmount = Math.max(0, platformFee - totalPaid);

    const subjectsStr = Array.isArray(job.subjects) ? job.subjects.join(', ') : (job.subjects || job.medium || 'General Tuition');
    const locStr = typeof job.location === 'object' ? `${job.location?.area || ''}, ${job.location?.district || ''}` : (job.location || 'Dhaka');
    const customJobId = job.customId || job.jobId || `JOB-${String(job._id).slice(-5).toUpperCase()}`;

    return {
      applicationId: app._id,
      jobId: job._id,
      jobIdCustom: customJobId,
      title: job.medium ? `Tutor Needed For ${job.medium}` : (subjectsStr ? `Tutor for ${subjectsStr}` : 'Active Tuition'),
      studentClass: job.studentClass || job.class || 'Class N/A',
      subject: subjectsStr,
      location: locStr,
      salary,
      platformFee,
      totalPaid,
      dueAmount,
      isPaid,
      hasPending,
      lastPaymentDate: relatedPayments[0]?.createdAt || null,
    };
  });

  return results;
};

// 3. Get My Payment History (Tutor)
const getMyPayments = async (userId: string) => {
  return Payment.find({ userId })
    .populate('tuitionJobId', 'customId title studentClass medium subjects salary location')
    .populate('approvedBy', 'name role')
    .sort({ createdAt: -1 })
    .lean();
};

// 4. Admin: Get All Payments
const getAllPaymentsAdmin = async (query: {
  status?: string;
  method?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const filter: Record<string, any> = {};

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  if (query.method && query.method !== 'all') {
    filter.paymentMethod = query.method.toLowerCase();
  }
  if (query.search) {
    const q = query.search.trim();
    filter.$or = [
      { transactionId: { $regex: q, $options: 'i' } },
      { senderNumber: { $regex: q, $options: 'i' } },
      { invoiceNumber: { $regex: q, $options: 'i' } },
    ];
  }

  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Number(query.limit || 50));
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('userId', 'name email phone avatar')
      .populate('tuitionJobId', 'customId title studentClass medium subjects salary location')
      .populate('approvedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return {
    payments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// 5. Admin: Approve Payment
const approvePayment = async (paymentId: string, adminId: string) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new AppError(404, 'Payment not found!');

  if (payment.status === 'approved') {
    throw new AppError(400, 'Payment is already approved!');
  }

  payment.status = 'approved';
  payment.approvedBy = adminId;
  payment.approvedAt = new Date();
  await payment.save();

  // Send Push & In-app notification to Tutor
  const tutorId = String(payment.userId);
  await NotificationService.createNotification({
    userId: tutorId,
    type: 'payment',
    title: '🎉 পেমেন্ট অনুমোদিত হয়েছে!',
    message: `আপনার ৳${payment.amount} টাকার পেমেন্ট (TrxID: ${payment.transactionId}) সফলভাবে অনুমোদিত হয়েছে। মানি রিসিট ডাউনলোড করতে পারেন।`,
    referenceId: String(payment._id),
    referenceType: 'payment',
  }).catch(() => null);

  return payment;
};

// 6. Admin: Reject Payment
const rejectPayment = async (paymentId: string, adminId: string, rejectionReason: string) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new AppError(404, 'Payment not found!');

  payment.status = 'rejected';
  payment.approvedBy = adminId;
  payment.approvedAt = new Date();
  payment.rejectionReason = rejectionReason || 'Transaction ID or payment proof could not be verified.';
  await payment.save();

  // Send Notification to Tutor with Reason
  const tutorId = String(payment.userId);
  await NotificationService.createNotification({
    userId: tutorId,
    type: 'payment',
    title: '⚠️ পেমেন্ট বাতিল করা হয়েছে',
    message: `আপনার ৳${payment.amount} টাকার পেমেন্ট (TrxID: ${payment.transactionId}) বাতিল করা হয়েছে। কারণ: ${payment.rejectionReason}। দয়া করে সঠিক তথ্য দিয়ে পুনরায় জমা দিন।`,
    referenceId: String(payment._id),
    referenceType: 'payment',
  }).catch(() => null);

  return payment;
};

// 7. Get Invoice Data
const getInvoice = async (paymentId: string) => {
  const payment = await Payment.findById(paymentId)
    .populate('userId', 'name email phone avatar address university')
    .populate('tuitionJobId')
    .populate('approvedBy', 'name role')
    .lean();

  if (!payment) throw new AppError(404, 'Invoice / Payment not found!');
  return payment;
};

export const PaymentService = {
  submitPayment,
  getTutorActiveTuitions,
  getMyPayments,
  getAllPaymentsAdmin,
  approvePayment,
  rejectPayment,
  getInvoice,
};
