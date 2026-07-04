import { z } from 'zod';

const workingHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6), // 0=Sunday, 6=Saturday
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
});

export const createDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  specialisation: z.string().min(1).max(100),
  slotDurationMin: z.number().int().min(5).max(120).default(30),
  workingHours: z.array(workingHoursSchema).min(1, 'At least one working day required'),
});

export const updateDoctorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  specialisation: z.string().min(1).max(100).optional(),
  slotDurationMin: z.number().int().min(5).max(120).optional(),
  workingHours: z.array(workingHoursSchema).optional(),
});

export const slotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
});

export const createLeaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  reason: z.string().optional(),
});

export const createLeaveRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
