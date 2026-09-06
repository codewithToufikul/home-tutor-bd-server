import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/upload.middleware.js';
import { DownloadController } from './download.controller.js';

const router = Router();

// Authenticated user routes — files filtered by their role
router.get('/', auth(), DownloadController.getFiles);
router.patch('/:id/download', auth(), DownloadController.incrementDownload);

// Admin / Moderator management routes
router.get('/admin/all', auth('super_admin', 'admin', 'moderator'), DownloadController.getAdminFiles);
router.post('/', auth('super_admin', 'admin', 'moderator'), upload.single('file'), DownloadController.uploadFile);
router.patch('/:id/toggle', auth('super_admin', 'admin', 'moderator'), DownloadController.togglePublished);
router.delete('/:id', auth('super_admin', 'admin', 'moderator'), DownloadController.deleteFile);

export const DownloadRoutes = router;
