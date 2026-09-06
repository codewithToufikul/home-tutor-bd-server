import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { HireController } from './hire.controller.js';

const router = Router();

// Public / Guest / User Hire Request Submission
router.post('/', HireController.createHireRequest);

// List & Detail (Protected)
router.get('/', auth(), HireController.getHireRequests);
router.get('/:id', auth(), HireController.getHireRequestById);

// Status Update (Admin)
router.patch(
  '/:id/status',
  auth('admin', 'super_admin', 'moderator'),
  HireController.updateHireRequestStatus,
);

// Confirm Tuition & Assign to Tutor's Active Dashboard (Admin)
router.post(
  '/:id/confirm-tuition',
  auth('admin', 'super_admin', 'moderator'),
  HireController.confirmAndAssignTuition,
);

export const HireRoutes = router;

