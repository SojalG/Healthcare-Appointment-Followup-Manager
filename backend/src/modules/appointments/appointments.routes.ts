import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as appointmentsController from './appointments.controller.js';

export const appointmentsRouter = Router();

// All appointment routes require authentication
appointmentsRouter.use(authenticate);

// Hold a slot
appointmentsRouter.post('/hold', appointmentsController.holdSlot);

// Confirm a held appointment
appointmentsRouter.post('/:id/confirm', appointmentsController.confirmAppointment);

// Cancel an appointment
appointmentsRouter.delete('/:id', appointmentsController.cancelAppointment);

// Reschedule an appointment
appointmentsRouter.post('/:id/reschedule', appointmentsController.rescheduleAppointment);

// Get my appointments
appointmentsRouter.get('/mine', appointmentsController.getMyAppointments);
