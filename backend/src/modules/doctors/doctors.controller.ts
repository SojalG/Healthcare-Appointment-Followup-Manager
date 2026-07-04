import type { Request, Response, NextFunction } from 'express';
import * as doctorsService from './doctors.service.js';
import { generateSlots } from './slot-generator.service.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  slotsQuerySchema,
  createLeaveSchema,
} from './doctors.validation.js';

// ============================================================
// Admin — Doctor CRUD
// ============================================================

export async function createDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createDoctorSchema.parse(req.body);
    const doctor = await doctorsService.createDoctor(input);
    res.status(201).json({ status: 'success', data: doctor });
  } catch (err) {
    next(err);
  }
}

export async function listDoctors(_req: Request, res: Response, next: NextFunction) {
  try {
    const doctors = await doctorsService.listDoctors();
    res.json({ status: 'success', data: doctors });
  } catch (err) {
    next(err);
  }
}

export async function getDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const doctor = await doctorsService.getDoctorById(req.params.id);
    res.json({ status: 'success', data: doctor });
  } catch (err) {
    next(err);
  }
}

export async function updateDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateDoctorSchema.parse(req.body);
    const doctor = await doctorsService.updateDoctor(req.params.id, input);
    res.json({ status: 'success', data: doctor });
  } catch (err) {
    next(err);
  }
}

export async function deleteDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    await doctorsService.deleteDoctor(req.params.id);
    res.json({ status: 'success', message: 'Doctor deleted' });
  } catch (err) {
    next(err);
  }
}

export async function declareLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, reason } = createLeaveSchema.parse(req.body);
    const leave = await doctorsService.declareLeave(req.user!.userId, date, reason);
    res.status(201).json({ status: 'success', data: leave });
  } catch (err) {
    next(err);
  }
}
// ============================================================
// Public — Doctor Search
// ============================================================

export async function searchDoctors(req: Request, res: Response, next: NextFunction) {
  try {
    const specialisation = req.query.specialisation as string | undefined;
    const doctors = await doctorsService.searchDoctors(specialisation);
    res.json({ status: 'success', data: doctors });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// Public — Slot Query
// ============================================================

export async function getSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const { date } = slotsQuerySchema.parse(req.query);
    const slots = await generateSlots(req.params.id, date);
    res.json({ status: 'success', data: slots });
  } catch (err) {
    next(err);
  }
}
