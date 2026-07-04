import { z } from 'zod';

export const prescriptionItemSchema = z.object({
  drug: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  instructions: z.string().optional(),
});

export const saveVisitNoteSchema = z.object({
  appointmentId: z.string().uuid(),
  doctorNotes: z.string().min(10),
  prescription: z.array(prescriptionItemSchema).optional(),
});

export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;
export type SaveVisitNoteInput = z.infer<typeof saveVisitNoteSchema>;
