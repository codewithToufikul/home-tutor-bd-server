import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { COOKIE_OPTIONS, REFRESH_TOKEN_COOKIE_NAME } from './auth.constants.js';
import { AuthService } from './auth.service.js';

const register = async (req: Request, res: Response) => {
  const result = await AuthService.registerUser(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'User registered successfully. OTP sent to your email.',
    data: result,
  });
};

const verifyOTP = async (req: Request, res: Response) => {
  const result = await AuthService.verifyEmailOTP(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Email verified successfully.',
    data: result,
  });
};

const login = async (req: Request, res: Response) => {
  const result = await AuthService.loginUser(req.body);

  if (result.refreshToken) {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User logged in successfully.',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    },
  });
};

const refreshToken = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Refresh token missing!',
    });
    return;
  }

  const result = await AuthService.refreshToken(token);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Access token refreshed successfully.',
    data: result,
  });
};

const logout = async (_req: Request, res: Response) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, COOKIE_OPTIONS);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Logged out successfully.',
  });
};

const getMe = async (req: CustomRequest, res: Response) => {
  const result = await AuthService.getMe(req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User profile retrieved successfully.',
    data: result,
  });
};

const updateMe = async (req: CustomRequest, res: Response) => {
  const result = await AuthService.updateMe(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User profile updated successfully.',
    data: result,
  });
};

const forgotPassword = async (req: Request, res: Response) => {
  const result = await AuthService.forgotPassword(req.body.email);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Password reset OTP sent to your email.',
    data: result,
  });
};

const resetPassword = async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  const result = await AuthService.resetPassword(email, otp, newPassword);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Password reset successfully.',
    data: result,
  });
};

const saveFcmToken = async (req: CustomRequest, res: Response) => {
  const result = await AuthService.saveFcmToken(req.user!.userId, req.body.fcmToken);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'FCM Token registered successfully.',
    data: result,
  });
};

export const AuthController = {
  register,
  verifyOTP,
  login,
  refreshToken,
  logout,
  getMe,
  updateMe,
  forgotPassword,
  resetPassword,
  saveFcmToken,
};
