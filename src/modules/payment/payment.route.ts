import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/upload.middleware.js';
import { PaymentController } from './payment.controller.js';

const router = Router();

// Tutor routes
router.post('/submit', auth('tutor', 'student', 'guardian', 'coaching', 'super_admin', 'admin'), upload.single('receipt'), PaymentController.submitPayment);
router.get('/my-payments', auth('tutor', 'student', 'guardian', 'coaching', 'super_admin', 'admin'), PaymentController.getMyPayments);
router.get('/tutor-active-tuitions', auth('tutor', 'super_admin', 'admin'), PaymentController.getTutorActiveTuitions);
router.get('/invoice/:id', auth(), PaymentController.getInvoice);

// Admin routes
router.get('/admin/all', auth('super_admin', 'admin', 'moderator'), PaymentController.getAllPaymentsAdmin);
router.patch('/admin/:id/approve', auth('super_admin', 'admin', 'moderator'), PaymentController.approvePayment);
router.patch('/admin/:id/reject', auth('super_admin', 'admin', 'moderator'), PaymentController.rejectPayment);

export const PaymentRoutes = router;
