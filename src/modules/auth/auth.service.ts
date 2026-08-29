import { Notification } from '../notification/notification.model.js';
import { NotificationService } from '../notification/notification.service.js';
import { AppError } from '../../errors/AppError.js';
import { addEmailJob } from '../../jobs/email.queue.js';
import { generateOTP, verifyOTP } from '../../services/otp.service.js';
import { createToken, verifyToken } from '../../utils/jwt.js';
import { Tutor } from '../tutor/tutor.model.js';
import { User } from '../user/user.model.js';
import { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from './auth.constants.js';
import type { IAuthResponse, ILoginUser, IRegisterUser, IVerifyOTP } from './auth.interface.js';

const registerUser = async (payload: IRegisterUser) => {
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
    isEmailVerified: false,
    // ONLY Coaching Center requires admin approval (isApproved: false).
    // Tutors, Students, Guardians are automatically approved (isApproved: true).
    isApproved: payload.role !== 'coaching',
  });

  if (payload.role === 'tutor') {
    await Tutor.create({
      userId: user._id,
      location: { district: payload.location || 'Dhaka', area: 'All Areas' },
      isVerified: true,
    });
  }

  // Real-time notification to all Staff (Super Admin, Admin, Moderator)
  try {
    const staffUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] } });
    if (payload.role === 'coaching') {
      for (const staff of staffUsers) {
        await NotificationService.createNotification({
          userId: String(staff._id),
          type: 'tutor_verification',
          title: '🏢 নতুন কোচিং সেন্টার রেজিস্ট্রেশন (অনুমোদনের জন্য অপেক্ষমাণ)',
          message: `নতুন কোচিং সেন্টার "${user.name || user.email}" অ্যাকাউন্ট খুলেছেন। ড্যাশবোর্ড ব্যবহারের জন্য অ্যাডমিন অনুমোদনের প্রয়োজন।`,
          referenceId: String(user._id),
          referenceType: 'Coaching',
        });
      }
    } else if (payload.role === 'tutor') {
      for (const staff of staffUsers) {
        await NotificationService.createNotification({
          userId: String(staff._id),
          type: 'tutor_verification',
          title: '👨‍🏫 নতুন টিউটর রেজিস্ট্রেশন সম্পন্ন',
          message: `নতুন টিউটর "${user.name || user.email}" সফলভাবে প্ল্যাটফর্মে রেজিস্ট্রেশন সম্পন্ন করেছেন।`,
          referenceId: String(user._id),
          referenceType: 'Tutor',
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Staff registration notification error:', err);
  }

  const otp = generateOTP(user.email);

  // 🚀 Dispatched to BullMQ Queue asynchronously!
  // API responds immediately to the user without waiting 5 seconds for the email server.
  addEmailJob('send-email-otp', {
    email: user.email,
    name: user.name,
    otp,
  });

  return {
    email: user.email,
    otpSent: true,
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

  // Keep isApproved: false for coaching centers until approved by admin.
  // Everyone else is auto-approved.
  const isCoaching = existingUser.role === 'coaching';
  const shouldApprove = !isCoaching ? true : existingUser.isApproved;

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
  addEmailJob('send-welcome-email', {
    email: user.email,
    name: user.name,
  });

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
    const otp = generateOTP(user.email);
    addEmailJob('send-email-otp', {
      email: user.email,
      name: user.name,
      otp,
    });
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
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError(404, 'User with this email does not exist!');
  }

  const otp = generateOTP(email);

  // Dispatch reset password email job to BullMQ queue
  addEmailJob('send-reset-password-email', {
    email: user.email,
    name: user.name,
    otp,
  });

  return {
    message: 'Password reset OTP sent to your email.',
    otp,
  };
};

const resetPassword = async (email: string, otp: string, newPassword: string) => {
  const isValid = await verifyOTP(email, otp);
  if (!isValid) {
    throw new AppError(400, 'Invalid or expired OTP!');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError(404, 'User not found!');
  }

  user.password = newPassword;
  await user.save();

  return {
    message: 'Password reset successfully. You can now login with your new password.',
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
  const allowedFields = ['name', 'phone', 'avatar', 'location', 'address', 'studentClass', 'institution'];
  const updateData: Record<string, unknown> = {};

  for (const key of Object.keys(payload)) {
    if (allowedFields.includes(key) || key.startsWith('custom')) {
      updateData[key] = payload[key];
    }
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
