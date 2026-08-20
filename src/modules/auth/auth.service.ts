import { AppError } from '../../errors/AppError.js';
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
    isApproved: payload.role === 'admin',
  });

  if (payload.role === 'tutor') {
    await Tutor.create({
      userId: user._id,
    });
  }

  const otp = generateOTP(user.email);

  return {
    email: user.email,
    otpSent: true,
    otp, // In production, send via email service
  };
};

const verifyEmailOTP = async (payload: IVerifyOTP) => {
  const isValid = verifyOTP(payload.email, payload.otp);
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

  return {
    email: user.email,
    isEmailVerified: true,
  };
};

const loginUser = async (payload: ILoginUser): Promise<IAuthResponse> => {
  const user = await User.isUserExistsByEmail(payload.email);
  if (!user) {
    throw new AppError(404, 'User not found!');
  }

  if (user.status === 'blocked') {
    throw new AppError(403, 'Your account is blocked!');
  }

  const isPasswordMatched = await User.isPasswordMatched(payload.password, user.password!);
  if (!isPasswordMatched) {
    throw new AppError(400, 'Invalid credentials!');
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
  return {
    message: 'Password reset OTP sent to your email.',
    otp, // In production, send via email service
  };
};

const resetPassword = async (email: string, otp: string, newPassword: string) => {
  const isValid = verifyOTP(email, otp);
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

export const AuthService = {
  registerUser,
  verifyEmailOTP,
  loginUser,
  refreshToken,
  getMe,
  forgotPassword,
  resetPassword,
};
