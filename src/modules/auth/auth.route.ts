import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validateRequest.middleware.js';
import { AuthController } from './auth.controller.js';
import { AuthValidation } from './auth.validation.js';

const router = Router();

router.post(
  '/register',
  validateRequest(AuthValidation.registerValidationSchema),
  AuthController.register,
);

router.post(
  '/verify-email',
  validateRequest(AuthValidation.verifyOTPValidationSchema),
  AuthController.verifyOTP,
);
router.post('/verify-otp', AuthController.verifyOTP);

router.post(
  '/login',
  validateRequest(AuthValidation.loginValidationSchema),
  AuthController.login,
);

router.post('/refresh', AuthController.refreshToken);
router.post('/refresh-token', AuthController.refreshToken);

router.post('/logout', AuthController.logout);

router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

router.get('/me', auth(), AuthController.getMe);
router.post('/fcm-token', auth(), AuthController.saveFcmToken);

export const AuthRoutes = router;
