import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { ApplicationController } from './application.controller.js';

const router = Router();

router.get('/my', auth('tutor'), ApplicationController.getMyApplications);
router.get('/job/:jobId', auth('guardian', 'student', 'coaching', 'admin', 'super_admin', 'moderator'), ApplicationController.getJobApplications);
router.get('/:id/contract-deed', ApplicationController.getContractDeedHtml);
router.get('/:id/contract-data', auth(), ApplicationController.getContractDeedData);
router.get('/:id', auth(), ApplicationController.getApplicationById);

router.patch('/:id/demo-confirm', auth('guardian', 'student', 'coaching', 'admin', 'super_admin', 'moderator'), ApplicationController.demoConfirmApplication);
router.patch('/:id/demo-complete', auth('guardian', 'student', 'coaching', 'admin', 'super_admin', 'moderator'), ApplicationController.demoCompleteApplication);
router.patch('/:id/final-confirm', auth('guardian', 'student', 'coaching', 'admin', 'super_admin', 'moderator'), ApplicationController.finalConfirmApplication);
router.patch('/:id/accept', auth('guardian', 'student', 'coaching', 'admin', 'super_admin', 'moderator'), ApplicationController.acceptApplication);
router.patch('/:id/reject', auth('guardian', 'student', 'coaching', 'admin', 'super_admin', 'moderator'), ApplicationController.rejectApplication);
router.patch('/:id/withdraw', auth('tutor'), ApplicationController.withdrawApplication);

export const ApplicationRoutes = router;

