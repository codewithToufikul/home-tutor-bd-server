import { Notification } from '../notification/notification.model.js';
import { NotificationService } from '../notification/notification.service.js';
import { AppError } from '../../errors/AppError.js';
import { addEmailJob } from '../../jobs/email.queue.js';
import { generateOTP, verifyOTP } from '../../services/otp.service.js';
import { createToken, verifyToken } from '../../utils/jwt.js';
import { Coaching } from '../coaching/coaching.model.js';
import { Tutor } from '../tutor/tutor.model.js';
import { User } from '../user/user.model.js';
import bcryptjs from 'bcryptjs';
import { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from './auth.constants.js';
import type { IAuthResponse, ILoginUser, IRegisterUser, IVerifyOTP } from './auth.interface.js';

const registerUser = async (payload: IRegisterUser & { tradeLicense?: string }) => {
  const isUserExist = await User.findOne({ email: payload.email });
  if (isUserExist) {
    throw new AppError(400, 'User with this email already exists!');
  }

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    phone: payload.phone || '',
    password: payload.password,
    role: payload.role,
    tradeLicense: payload.tradeLicense || '',
    isEmailVerified: false,
    // Students and Guardians are auto-approved.
    // Tutors and Coaching Centers require document/admin verification (isApproved: false).
    isApproved: payload.role === 'student' || payload.role === 'guardian',
  });

  if (payload.role === 'tutor') {
    await Tutor.create({
      userId: user._id,
      location: { district: payload.location || 'Dhaka', area: 'All Areas' },
      isVerified: false,
      verificationStatus: 'Unsubmitted',
    });
  } else if (payload.role === 'coaching') {
    await Coaching.create({
      userId: user._id,
      instituteName: payload.name,
      tradeLicense: payload.tradeLicense || '',
      phone: payload.phone || '',
      email: payload.email || '',
      district: payload.location || 'Dhaka',
      isVerified: false,
    });
  }

  // Real-time Push Notification & Alerts to ALL Admin and Moderator accounts
  NotificationService.notifyStaffOnNewUserRegistration({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    location: payload.location,
  }).catch((err) => console.warn('⚠️ Staff registration notification error:', err));

  const targetEmail = user.email || '';
  const otp = generateOTP(targetEmail);

  if (targetEmail) {
    // 🚀 Dispatched to BullMQ Queue asynchronously!
    // API responds immediately to the user without waiting 5 seconds for the email server.
    addEmailJob('send-email-otp', {
      email: targetEmail,
      name: user.name,
      otp,
    });
  }

  return {
    email: targetEmail,
    otpSent: Boolean(targetEmail),
    otp, // Useful in dev mode
  };
};

const verifyEmailOTP = async (payload: IVerifyOTP) => {
  const isValid = await verifyOTP(payload.email, payload.otp);
  if (!isValid) {
    throw new AppError(400, 'Invalid or expired OTP!');
  }

  const existingUser = await User.findOne({ email: payload.email });
  if (!existingUser) {
    throw new AppError(404, 'User not found!');
  }

  // Only student and guardian are auto-approved upon email OTP verification.
  // Tutors and Coaching centers remain isApproved: false until admin approves documents.
  const isAutoApprovedRole = existingUser.role === 'student' || existingUser.role === 'guardian';
  const shouldApprove = isAutoApprovedRole ? true : existingUser.isApproved;

  const user = await User.findOneAndUpdate(
    { email: payload.email },
    { isEmailVerified: true, isApproved: shouldApprove },
    { new: true },
  );

  if (!user) {
    throw new AppError(404, 'User not found!');
  }

  // Create Staff Notification for verified user
  try {
    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } });
    if (user.role === 'coaching') {
      for (const staff of staffUsers) {
        await NotificationService.createNotification({
          userId: String(staff._id),
          type: 'user_registration',
          title: '🏢 কোচিং সেন্টার ইমেইল ভেরিফিকেশন সম্পন্ন (অ্যাপ্রুভাল প্রয়োজন)',
          message: `${user.name} (${user.email}) ইমেইল ভেরিফাই করেছেন এবং ড্যাশবোর্ড ব্যবহারের জন্য অ্যাডমিন অনুমোদনের অপেক্ষায় আছেন।`,
          referenceId: String(user._id),
          referenceType: 'User',
        });
      }
    } else if (user.role === 'tutor') {
      for (const staff of staffUsers) {
        await NotificationService.createNotification({
          userId: String(staff._id),
          type: 'user_registration',
          title: '✅ নতুন টিউটর ইমেইল ভেরিফিকেশন সম্পন্ন',
          message: `${user.name} (${user.email}) সফলভাবে ইমেইল ভেরিফাই করেছেন এবং অ্যাকাউন্ট সক্রিয় রয়েছে।`,
          referenceId: String(user._id),
          referenceType: 'User',
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Staff notification creation error:', err);
  }

  // Welcome email dispatched via BullMQ
  if (user.email) {
    addEmailJob('send-welcome-email', {
      email: user.email,
      name: user.name,
    });
  }

  const jwtPayload = {
    userId: String(user._id),
    email: user.email,
    role: user.role,
  };

  const accessSecret = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';

  const accessToken = createToken(jwtPayload, accessSecret, ACCESS_TOKEN_EXPIRES_IN);
  const refreshToken = createToken(jwtPayload, refreshSecret, REFRESH_TOKEN_EXPIRES_IN);

  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

  return {
    accessToken,
    refreshToken,
    user: {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || '',
      isEmailVerified: user.isEmailVerified,
      isApproved: user.isApproved,
    },
  };
};

const loginUser = async (payload: ILoginUser): Promise<IAuthResponse> => {
  const normalizedIdentifier = payload.email.trim().toLowerCase();
  const user = await User.isUserExistsByIdentifier(normalizedIdentifier);
  if (!user) {
    throw new AppError(400, 'Invalid email/username or password!');
  }

  if (user.status === 'blocked') {
    throw new AppError(403, 'Your account is blocked!');
  }

  const isPasswordMatched = await User.isPasswordMatched(payload.password, user.password!);
  if (!isPasswordMatched) {
    throw new AppError(400, 'Invalid credentials!');
  }

  if (!user.isEmailVerified) {
    const targetEmail = user.email || '';
    const otp = generateOTP(targetEmail);
    if (targetEmail) {
      addEmailJob('send-email-otp', {
        email: targetEmail,
        name: user.name,
        otp,
      });
    }
    throw new AppError(
      401,
      'Email not verified! A new verification OTP code has been sent to your email.',
    );
  }

  // Check Approval: Only Coaching Center accounts require Admin Approval before accessing dashboard
  if (user.role === 'coaching' && !user.isApproved) {
    throw new AppError(
      403,
      'আপনার কোচিং সেন্টার অ্যাকাউন্টটি অ্যাডমিন অনুমোদনের অপেক্ষায় রয়েছে। অ্যাডমিন অনুমোদন প্রদান করলে আপনি ড্যাশবোর্ডে প্রবেশ করতে পারবেন।',
    );
  }

  const jwtPayload = {
    userId: String(user._id),
    email: user.email,
    role: user.role,
  };

  const accessSecret = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';

  const accessToken = createToken(jwtPayload, accessSecret, ACCESS_TOKEN_EXPIRES_IN);
  const refreshToken = createToken(jwtPayload, refreshSecret, REFRESH_TOKEN_EXPIRES_IN);

  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

  return {
    accessToken,
    refreshToken,
    user: {
      _id: String(user._id),
      name: user.name,
      username: user.username || '',
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      avatar: user.avatar || '',
      isEmailVerified: user.isEmailVerified,
      isApproved: user.isApproved,
    },
  };
};

const refreshToken = async (token: string) => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
  const decoded = verifyToken(token, refreshSecret);

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new AppError(404, 'User not found!');
  }

  if (user.status === 'blocked') {
    throw new AppError(403, 'Your account is blocked!');
  }

  const jwtPayload = {
    userId: String(user._id),
    email: user.email,
    role: user.role,
  };

  const accessSecret = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
  const newAccessToken = createToken(jwtPayload, accessSecret, ACCESS_TOKEN_EXPIRES_IN);

  return {
    accessToken: newAccessToken,
  };
};

const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found!');
  }

  let profile = null;
  if (user.role === 'tutor') {
    profile = await Tutor.findOne({ userId: user._id });
  }

  return {
    user,
    profile,
  };
};

const forgotPassword = async (email: string) => {
  if (!email || typeof email !== 'string') {
    throw new AppError(400, 'অনুগ্রহ করে একটি সঠিক ইমেইল অ্যাড্রেস প্রদান করুন!');
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: cleanEmail });
  if (!user) {
    throw new AppError(404, 'এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি!');
  }

  const otp = generateOTP(cleanEmail);

  // Dispatch reset password email job to BullMQ queue (with fallback)
  addEmailJob('send-reset-password-email', {
    email: user.email || cleanEmail,
    name: user.name,
    otp,
  });

  return {
    message: 'আপনার ইমেইলে ৬ ডিজিটের ওটিপি (OTP) পাঠানো হয়েছে।',
    otp: process.env.NODE_ENV === 'development' ? otp : undefined,
  };
};

const resetPassword = async (email: string, otp: string, newPassword: string) => {
  if (!email || !otp || !newPassword) {
    throw new AppError(400, 'ইমেইল, ওটিপি কোড এবং নতুন পাসওয়ার্ড প্রদান করা আবশ্যক!');
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new AppError(400, 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOTP = otp.trim();

  const isValid = await verifyOTP(cleanEmail, cleanOTP);
  if (!isValid) {
    throw new AppError(400, 'ভুল অথবা মেয়াদোত্তীর্ণ ওটিপি (OTP)! পুনরায় কোড পাঠিয়ে চেষ্টা করুন।');
  }

  const user = await User.findOne({ email: cleanEmail });
  if (!user) {
    throw new AppError(404, 'ব্যবহারকারী পাওয়া যায়নি!');
  }

  user.password = newPassword;
  await user.save();

  return {
    message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।',
  };
};

const saveFcmToken = async (userId: string, fcmToken: string) => {
  if (!fcmToken) {
    throw new AppError(400, 'FCM Token is required');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { fcmTokens: fcmToken } },
    { new: true },
  );

  if (!user) {
    throw new AppError(404, 'User not found!');
  }

  return { success: true, message: 'FCM token registered successfully.' };
};

const updateMe = async (userId: string, payload: Record<string, unknown>) => {
  const allowedFields = [
    'name',
    'phone',
    'avatar',
    'location',
    'address',
    'division',
    'divisionId',
    'district',
    'districtId',
    'upazila',
    'upazilaId',
    'area',
    'gender',
    'studentClass',
    'institution',
    'medium',
    'emergencyContact',
    'guardianName',
    'guardianPhone',
    'guardianRelation',
    'preferredTuitionMode',
    'bio',
    'notificationPreferences',
  ];
  const updateData: Record<string, unknown> = {};

  for (const key of Object.keys(payload)) {
    if (allowedFields.includes(key) || key.startsWith('custom')) {
      updateData[key] = payload[key];
    }
  }

  // Handle Password Change if requested
  if (payload.newPassword && typeof payload.newPassword === 'string') {
    const userWithPass = await User.findById(userId).select('+password');
    if (!userWithPass) {
      throw new AppError(404, 'User not found');
    }
    if (!payload.currentPassword || typeof payload.currentPassword !== 'string') {
      throw new AppError(400, 'Current password is required to change password');
    }
    const isMatched = await User.isPasswordMatched(payload.currentPassword, userWithPass.password || '');
    if (!isMatched) {
      throw new AppError(400, 'Current password does not match!');
    }
    const hashedPassword = await bcryptjs.hash(payload.newPassword, 10);
    updateData.password = hashedPassword;
  }

  const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });
  if (!updatedUser) {
    throw new AppError(404, 'User profile not found');
  }

  return updatedUser;
};

export const AuthService = {
  registerUser,
  verifyEmailOTP,
  loginUser,
  refreshToken,
  getMe,
  updateMe,
  forgotPassword,
  resetPassword,
  saveFcmToken,
};
