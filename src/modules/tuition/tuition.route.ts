import { Router } from 'express';
import { auth, optionalAuth } from '../../middlewares/auth.middleware.js';
import { TuitionController } from './tuition.controller.js';

const router = Router();

router.get('/', TuitionController.getAllJobs);

router.post('/', optionalAuth(), TuitionController.createJob);

router.get('/:id', TuitionController.getJobById);
router.get('/:id/shortlisted', auth('guardian', 'student', 'admin', 'moderator', 'super_admin'), TuitionController.getShortlistedTutors);
router.post('/:id/rematch', auth('guardian', 'student', 'admin', 'moderator', 'super_admin'), TuitionController.rematchJob);
router.patch('/:id', auth('guardian', 'student', 'admin', 'moderator', 'super_admin'), TuitionController.updateJob);
router.delete('/:id', auth('guardian', 'student', 'admin', 'moderator', 'super_admin'), TuitionController.deleteJob);

router.post('/:id/apply', auth('tutor'), TuitionController.applyToJob);

export const TuitionRoutes = router;

