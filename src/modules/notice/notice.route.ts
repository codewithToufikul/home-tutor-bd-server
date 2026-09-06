import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { NoticeController } from './notice.controller.js';

const router = Router();

// Public / User Routes
router.get('/', NoticeController.getNotices);
router.get('/:id', NoticeController.getNoticeById);

// Admin Management Routes
router.post('/', auth('super_admin', 'admin', 'moderator'), NoticeController.createNotice);
router.get('/admin/all', auth('super_admin', 'admin', 'moderator'), NoticeController.getAdminNotices);
router.patch('/:id', auth('super_admin', 'admin', 'moderator'), NoticeController.updateNotice);
router.delete('/:id', auth('super_admin', 'admin', 'moderator'), NoticeController.deleteNotice);

export const NoticeRoutes = router;
