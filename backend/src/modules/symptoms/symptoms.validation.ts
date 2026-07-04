import { z } from 'zod';

export const submitSymptomsSchema = z.object({
  appointmentId: z.string().uuid(),
  rawSymptoms: z.string().min(10).max(1000),
});

export type SubmitSymptomsInput = z.infer<typeof submitSymptomsSchema>;
