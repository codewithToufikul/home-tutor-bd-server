import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { CoachingController } from './coaching.controller.js';

const router = Router();

router.get('/profile', auth('coaching'), CoachingController.getProfile);
router.patch('/profile', auth('coaching'), CoachingController.updateProfile);

router.get('/stats', auth('coaching'), CoachingController.getStats);

router.post('/batches', auth('coaching'), CoachingController.createBatch);
router.delete('/batches/:id', auth('coaching'), CoachingController.deleteBatch);

router.get('/all', CoachingController.getAllCoachingCenters); // Public - no auth required
router.post('/:coachingId/batches/:batchId/enroll', auth('student', 'guardian', 'tutor'), CoachingController.enrollInBatch);

export const CoachingRoutes = router;
