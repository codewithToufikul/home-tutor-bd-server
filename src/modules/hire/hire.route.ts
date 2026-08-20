import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { HireController } from './hire.controller.js';

const router = Router();

router.post('/', auth('guardian', 'student'), HireController.createHireRequest);
router.get('/', auth(), HireController.getHireRequests);
router.get('/:id', auth(), HireController.getHireRequestById);

router.patch('/:id/approve', auth('tutor', 'admin'), HireController.approveHireRequest);
router.patch('/:id/reject', auth('tutor', 'admin'), HireController.rejectHireRequest);

export const HireRoutes = router;
