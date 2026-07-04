import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { Role } from '@prisma/client';
import * as doctorsController from './doctors.controller.js';

export const doctorsRouter = Router();
export const doctorsPublicRouter = Router();

// ============================================================
// Admin Routes — /admin/doctors (auth + admin role required)
// ============================================================

doctorsRouter.get('/', authenticate, authorize(Role.ADMIN), doctorsController.listDoctors);
doctorsRouter.post('/', authenticate, authorize(Role.ADMIN), doctorsController.createDoctor);
doctorsRouter.get('/:id', authenticate, authorize(Role.ADMIN), doctorsController.getDoctor);
doctorsRouter.put('/:id', authenticate, authorize(Role.ADMIN), doctorsController.updateDoctor);
doctorsRouter.delete('/:id', authenticate, authorize(Role.ADMIN), doctorsController.deleteDoctor);

// ============================================================
// Public Routes — /doctors (auth required, any role)
// ============================================================

doctorsPublicRouter.get('/', authenticate, doctorsController.searchDoctors);
doctorsPublicRouter.get('/:id/slots', authenticate, doctorsController.getSlots);
doctorsPublicRouter.post('/me/leaves', authenticate, authorize(Role.DOCTOR), doctorsController.declareLeave);
