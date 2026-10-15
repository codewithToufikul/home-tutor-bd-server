import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validateRequest.middleware.js';
import {
  registerRateLimiter,
  loginRateLimiter,
  otpRateLimiter,
} from '../../middlewares/rateLimit.middleware.js';
import { AuthController } from './auth.controller.js';
import { AuthValidation } from './auth.validation.js';

const router = Router();

router.post(
  '/register',
  registerRateLimiter,
  validateRequest(AuthValidation.registerValidationSchema),
  AuthController.register,
);

router.post(
  '/verify-email',
  otpRateLimiter,
  validateRequest(AuthValidation.verifyOTPValidationSchema),
  AuthController.verifyOTP,
);
router.post('/verify-otp', otpRateLimiter, AuthController.verifyOTP);

router.post(
  '/login',
  loginRateLimiter,
  validateRequest(AuthValidation.loginValidationSchema),
  AuthController.login,
);

router.post('/refresh', AuthController.refreshToken);
router.post('/refresh-token', AuthController.refreshToken);

router.post('/logout', AuthController.logout);

router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

router.get('/me', auth(), AuthController.getMe);
router.patch('/me', auth(), AuthController.updateMe);
router.patch('/profile', auth(), AuthController.updateMe);
router.post('/fcm-token', auth(), AuthController.saveFcmToken);

export const AuthRoutes = router;
