import type { Request, Response, NextFunction } from 'express';
import * as visitsService from './visits.service.js';
import { saveVisitNoteSchema } from './visits.validation.js';

export async function saveVisitNote(req: Request, res: Response, next: NextFunction) {
  try {
    const input = saveVisitNoteSchema.parse(req.body);
    const note = await visitsService.saveVisitNote(req.user!.userId, input);
    res.status(201).json({ status: 'success', data: note });
  } catch (err) {
    next(err);
  }
}

export async function getVisitNote(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await visitsService.getVisitNote(
      req.params.appointmentId,
      req.user!.userId,
      req.user!.role,
    );
    res.json({ status: 'success', data: note });
  } catch (err) {
    next(err);
  }
}
