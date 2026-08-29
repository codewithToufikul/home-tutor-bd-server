import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { ITServiceController } from './itService.controller.js';

const router = Router();

// Public routes
router.get('/', ITServiceController.getAllServices);
router.get('/:id', ITServiceController.getServiceById);

// Staff management routes (super_admin, admin, moderator)
router.post(
  '/',
  auth('super_admin', 'admin', 'moderator'),
  ITServiceController.createService,
);

router.patch(
  '/:id',
  auth('super_admin', 'admin', 'moderator'),
  ITServiceController.updateService,
);

router.delete(
  '/:id',
  auth('super_admin', 'admin', 'moderator'),
  ITServiceController.deleteService,
);

export const ITServiceRoutes = router;
