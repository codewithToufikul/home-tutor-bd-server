import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { AdminController } from './admin.controller.js';

const router = Router();

// All admin routes require admin role
router.use(auth('admin'));

router.get('/dashboard', AdminController.getDashboardStats);

router.get('/users', AdminController.getAllUsers);
router.patch('/users/:id/status', AdminController.updateUserStatus);

router.get('/tutors/pending', AdminController.getPendingTutors);
router.patch('/tutors/:id/approve', AdminController.approveTutor);

router.get('/jobs/pending', AdminController.getPendingJobs);
router.patch('/jobs/:id/approve', AdminController.approveJob);

router.get('/verifications', AdminController.getVerifications);
router.patch('/verifications/:id', AdminController.updateVerificationStatus);

router.get('/payments', AdminController.getPayments);
router.patch('/payments/:id', AdminController.updatePaymentStatus);

export const AdminRoutes = router;
