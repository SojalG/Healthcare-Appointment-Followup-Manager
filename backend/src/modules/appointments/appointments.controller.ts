import type { Request, Response, NextFunction } from 'express';
import * as appointmentsService from './appointments.service.js';
import { holdSlotSchema, rescheduleSchema } from './appointments.validation.js';

export async function holdSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const input = holdSlotSchema.parse(req.body);
    const appointment = await appointmentsService.holdSlot(req.user!.userId, input);
    res.status(201).json({ status: 'success', data: appointment });
  } catch (err) {
    next(err);
  }
}

export async function confirmAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const appointment = await appointmentsService.confirmAppointment(
      req.params.id,
      req.user!.userId,
    );
    res.json({ status: 'success', data: appointment });
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await appointmentsService.cancelAppointment(
      req.params.id,
      req.user!.userId,
      req.user!.role,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getMyAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role === 'DOCTOR') {
      const appointments = await appointmentsService.getDoctorAppointments(req.user!.userId);
      res.json({ status: 'success', data: appointments });
    } else {
      const appointments = await appointmentsService.getPatientAppointments(req.user!.userId);
      res.json({ status: 'success', data: appointments });
    }
  } catch (err) {
    next(err);
  }
}

export async function rescheduleAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const { newSlotStart } = rescheduleSchema.parse(req.body);
    const appointment = await appointmentsService.rescheduleAppointment(
      req.params.id,
      req.user!.userId,
      newSlotStart,
    );
    res.json({ status: 'success', data: appointment });
  } catch (err) {
    next(err);
  }
}
