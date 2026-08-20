import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { ApplicationController } from './application.controller.js';

const router = Router();

router.get('/my', auth('tutor'), ApplicationController.getMyApplications);
router.get('/:id', auth(), ApplicationController.getApplicationById);

router.patch('/:id/accept', auth('guardian', 'student', 'admin'), ApplicationController.acceptApplication);
router.patch('/:id/reject', auth('guardian', 'student', 'admin'), ApplicationController.rejectApplication);

export const ApplicationRoutes = router;
