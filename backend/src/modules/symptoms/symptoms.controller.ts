import type { Request, Response, NextFunction } from 'express';
import * as symptomsService from './symptoms.service.js';
import { submitSymptomsSchema } from './symptoms.validation.js';

export async function submitSymptoms(req: Request, res: Response, next: NextFunction) {
  try {
    const input = submitSymptomsSchema.parse(req.body);
    const form = await symptomsService.submitSymptoms(req.user!.userId, input);
    res.status(201).json({ status: 'success', data: form });
  } catch (err) {
    next(err);
  }
}

export async function getSymptoms(req: Request, res: Response, next: NextFunction) {
  try {
    const form = await symptomsService.getSymptomsByAppointment(
      req.params.appointmentId,
      req.user!.userId,
      req.user!.role,
    );
    res.json({ status: 'success', data: form });
  } catch (err) {
    next(err);
  }
}
