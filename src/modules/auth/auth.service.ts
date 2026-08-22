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
    // Admin, Student, Guardian auto-approved. Tutor & Coaching require admin approval.
    isApproved: payload.role === 'admin' || payload.role === 'student' || payload.role === 'guardian',
  });

  if (payload.role === 'tutor') {
    await Tutor.create({
      userId: user._id,
    });
  }

  // Real-time notification to Admin for new Tutor / Coaching registrations
  if (payload.role === 'tutor' || payload.role === 'coaching') {
    try {
      const adminUsers = await User.find({ role: 'admin' });
      const roleLabel = payload.role === 'tutor' ? 'টিউটর' : 'কোচিং সেন্টার';
      for (const admin of adminUsers) {
        await NotificationService.createNotification({
          userId: String(admin._id),
          type: 'tutor_verification',
          title: `👨‍🏫 নতুন ${roleLabel} রেজিস্ট্রেশন`,
          message: `নতুন ${roleLabel} "${user.name || user.email}" অ্যাকাউন্ট খুলেছেন। অনুমোদনের জন্য আবেদন প্রক্রিয়াভুক্ত।`,
          referenceId: String(user._id),
          referenceType: payload.role === 'tutor' ? 'Tutor' : 'Coaching',
        });
      }
    } catch (err) {
      console.warn('⚠️ Admin registration notification error:', err);
    }
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

  const user = await User.findOneAndUpdate(
    { email: payload.email },
    { isEmailVerified: true },
    { new: true },
  );

  if (!user) {
    throw new AppError(404, 'User not found!');
  }

  // Create Admin Notification for pending user approval
  // Only tutor & coaching require admin approval — student & guardian are auto-approved
  if (!user.isApproved && (user.role === 'tutor' || user.role === 'coaching')) {
    try {
      const adminUsers = await User.find({ role: 'admin' });
      for (const admin of adminUsers) {
        await NotificationService.createNotification({
          userId: String(admin._id),
          type: 'user_registration',
          title: `নতুন ${user.role.toUpperCase()} অ্যাকাউন্ট প্যানেল রেজিষ্ট্রেশন`,
          message: `${user.name} (${user.email}) ইমেইল ভেরিফাই করেছেন এবং অ্যাকাউন্ট অ্যাপ্রুভালের জন্য অপেক্ষা করছেন।`,
          referenceId: String(user._id),
          referenceType: 'User',
        });
      }
    } catch (err) {
      console.warn('⚠️ Admin notification creation error:', err);
    }
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
  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await User.isUserExistsByEmail(normalizedEmail);
  if (!user) {
    throw new AppError(400, 'Invalid email or password!');
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

export const AuthService = {
  registerUser,
  verifyEmailOTP,
  loginUser,
  refreshToken,
  getMe,
  forgotPassword,
  resetPassword,
  saveFcmToken,
};
