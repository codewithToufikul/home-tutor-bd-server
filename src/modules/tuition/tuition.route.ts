import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { TuitionController } from './tuition.controller.js';

const router = Router();

router.get('/', TuitionController.getAllJobs);

router.post('/', auth('guardian', 'student', 'admin'), TuitionController.createJob);

router.get('/:id', TuitionController.getJobById);
router.patch('/:id', auth('guardian', 'student', 'admin'), TuitionController.updateJob);
router.delete('/:id', auth('guardian', 'student', 'admin'), TuitionController.deleteJob);

router.post('/:id/apply', auth('tutor'), TuitionController.applyToJob);

export const TuitionRoutes = router;
