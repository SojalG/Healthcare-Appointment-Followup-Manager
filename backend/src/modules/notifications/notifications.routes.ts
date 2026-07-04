import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { Role } from '@prisma/client';
import * as notificationsController from './notifications.controller.js';

export const adminNotificationsRouter = Router();

adminNotificationsRouter.use(authenticate, authorize(Role.ADMIN));

adminNotificationsRouter.get('/failed', notificationsController.getFailedNotifications);
adminNotificationsRouter.post('/:id/retry', notificationsController.retryNotification);
