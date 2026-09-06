import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { TermController } from './terms.controller.js';

const router = Router();

// Public
router.get('/', TermController.getPublicTerms);

// Admin / Moderator
router.get('/admin/all', auth('super_admin', 'admin', 'moderator'), TermController.getAllTermsAdmin);
router.post('/', auth('super_admin', 'admin', 'moderator'), TermController.createTerm);
router.put('/bulk', auth('super_admin', 'admin', 'moderator'), TermController.bulkUpdateTerms);
router.post('/reset', auth('super_admin', 'admin'), TermController.resetToDefaults);
router.patch('/:id', auth('super_admin', 'admin', 'moderator'), TermController.updateTerm);
router.delete('/:id', auth('super_admin', 'admin', 'moderator'), TermController.deleteTerm);

export const TermRoutes = router;
