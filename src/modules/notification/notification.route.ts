import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { NotificationController } from './notification.controller.js';

const router = Router();

router.use(auth());

router.get('/', NotificationController.getMyNotifications);
router.patch('/:id/read', NotificationController.markAsRead);
router.patch('/read-all', NotificationController.markAllAsRead);

export const NotificationRoutes = router;
