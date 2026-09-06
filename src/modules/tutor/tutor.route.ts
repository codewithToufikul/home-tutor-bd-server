import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { TutorController } from './tutor.controller.js';

const router = Router();

router.get('/', TutorController.getAllTutors);

router.get('/me', auth('tutor'), TutorController.getMyProfile);
router.get('/me/applications', auth('tutor'), TutorController.getMyApplications);
router.get('/me/hire-requests', auth('tutor'), TutorController.getMyHireRequests);

router.post('/profile', auth('tutor'), TutorController.createMyProfile);
router.patch('/profile', auth('tutor'), TutorController.updateMyProfile);
router.post('/verification', auth('tutor'), TutorController.submitVerification);

router.get('/:id', TutorController.getTutorById);
router.post('/:id/reviews', auth('student', 'guardian'), TutorController.addReview);

export const TutorRoutes = router;
