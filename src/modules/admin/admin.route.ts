import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { AdminController } from './admin.controller.js';

const router = Router();

// Dashboard — accessible to all staff roles
router.get('/dashboard', auth('super_admin', 'admin', 'moderator'), AdminController.getDashboardStats);

// User management — admin & super_admin only
router.get('/users', auth('super_admin', 'admin'), AdminController.getAllUsers);
router.patch('/users/:id/status', auth('super_admin', 'admin'), AdminController.updateUserStatus);
router.delete('/users/:id', auth('super_admin', 'admin'), AdminController.deleteUser);

// Tutor management — admin & moderator can view/approve
router.get('/tutors/pending', auth('super_admin', 'admin', 'moderator'), AdminController.getPendingTutors);
router.patch('/tutors/:id/approve', auth('super_admin', 'admin', 'moderator'), AdminController.approveTutor);

// Job management
router.get('/jobs/pending', auth('super_admin', 'admin', 'moderator'), AdminController.getPendingJobs);
router.get('/applications', auth('super_admin', 'admin', 'moderator'), AdminController.getAllApplications);
router.patch('/jobs/:id/approve', auth('super_admin', 'admin', 'moderator'), AdminController.approveJob);

// Verifications
router.get('/verifications', auth('super_admin', 'admin', 'moderator'), AdminController.getVerifications);
router.patch('/verifications/:id', auth('super_admin', 'admin', 'moderator'), AdminController.updateVerificationStatus);

// Payments — admin & super_admin only
router.get('/payments', auth('super_admin', 'admin'), AdminController.getPayments);
router.patch('/payments/:id', auth('super_admin', 'admin'), AdminController.updatePaymentStatus);

// Staff Management — super_admin ONLY
router.post('/staff', auth('super_admin'), AdminController.createStaff);
router.get('/staff', auth('super_admin'), AdminController.getAllStaff);
router.patch('/staff/:id/status', auth('super_admin'), AdminController.updateStaffStatus);
router.patch('/staff/:id/permissions', auth('super_admin'), AdminController.updateStaffPermissions);
router.delete('/staff/:id', auth('super_admin'), AdminController.deleteStaff);

export const AdminRoutes = router;
