import { z } from 'zod';

export const holdSlotSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  slotStart: z.string().datetime({ message: 'slotStart must be ISO 8601 datetime' }),
});

export const rescheduleSchema = z.object({
  newSlotStart: z.string().datetime({ message: 'newSlotStart must be ISO 8601 datetime' }),
});

export type HoldSlotInput = z.infer<typeof holdSlotSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
