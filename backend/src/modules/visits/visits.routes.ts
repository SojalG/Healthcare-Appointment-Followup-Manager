import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { Role } from '@prisma/client';
import * as visitsController from './visits.controller.js';

export const visitsRouter = Router();

visitsRouter.use(authenticate);

// Doctor only
visitsRouter.post('/', authorize(Role.DOCTOR), visitsController.saveVisitNote);

// Both
visitsRouter.get('/appointment/:appointmentId', visitsController.getVisitNote);
