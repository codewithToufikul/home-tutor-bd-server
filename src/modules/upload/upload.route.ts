import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/upload.middleware.js';
import { UploadController } from './upload.controller.js';

const router = Router();

router.use(auth());

router.post('/single', upload.single('file'), UploadController.uploadSingle);
router.post('/multiple', upload.array('files', 5), UploadController.uploadMultiple);

export const UploadRoutes = router;
