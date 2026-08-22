import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { EnrollmentController } from './enrollment.controller.js';

const router = Router();

// Student submits enrollment request (any logged-in user)
router.post(
  '/:coachingId/batches/:batchId/enroll',
  auth('student', 'guardian', 'tutor', 'admin'),
  EnrollmentController.enroll,
);

// Coaching: view all enrollment requests for my center
router.get(
  '/my-enrollments',
  auth('coaching'),
  EnrollmentController.getMyEnrollments,
);

// Coaching: approve or reject an enrollment
router.patch(
  '/:enrollmentId/status',
  auth('coaching'),
  EnrollmentController.updateStatus,
);

// Student: view my own enrollments
router.get(
  '/student/my-enrollments',
  auth('student', 'guardian', 'tutor'),
  EnrollmentController.getStudentEnrollments,
);

export const EnrollmentRoutes = router;
