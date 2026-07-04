import prisma from '../../db/client.js';
import { AppError } from '../../utils/app-error.js';

export interface Slot {
  start: string; // ISO datetime
  end: string;   // ISO datetime
  available: boolean;
}

/**
 * Virtual Slot Generator
 *
 * Generates available appointment slots on-the-fly for a given doctor and date.
 * Slots are NOT pre-materialized — this function computes them from:
 *   1. Doctor's working hours for the requested weekday
 *   2. Doctor's slot duration
 *   3. Existing booked appointments (PENDING_HOLD or CONFIRMED)
 *   4. Leave days
 *
 * Returns an array of time slots with `available: true|false`.
 */
export async function generateSlots(doctorProfileId: string, dateStr: string): Promise<Slot[]> {
  const date = new Date(dateStr + 'T00:00:00');
  const weekday = date.getDay(); // 0=Sunday

  // Fetch doctor profile + working hours for this weekday
  const profile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: {
      workingHours: { where: { weekday } },
      leaves: {
        where: { date: new Date(dateStr) },
      },
    },
  });

  if (!profile) {
    throw AppError.notFound('Doctor not found');
  }

  // If doctor is on leave this day, return empty
  if (profile.leaves.length > 0) {
    return [];
  }

  // No working hours for this weekday = doctor doesn't work this day
  if (profile.workingHours.length === 0) {
    return [];
  }

  const wh = profile.workingHours[0];
  const slotDuration = profile.slotDurationMin;

  // Parse start/end times
  const [startHour, startMin] = wh.startTime.split(':').map(Number);
  const [endHour, endMin] = wh.endTime.split(':').map(Number);

  const dayStart = new Date(date);
  dayStart.setHours(startHour, startMin, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(endHour, endMin, 0, 0);

  // Generate all possible slots
  const slots: Slot[] = [];
  let current = new Date(dayStart);

  while (current.getTime() + slotDuration * 60000 <= dayEnd.getTime()) {
    const slotStart = new Date(current);
    const slotEnd = new Date(current.getTime() + slotDuration * 60000);

    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      available: true, // will be updated below
    });

    current = slotEnd;
  }

  if (slots.length === 0) return [];

  // Fetch existing active bookings for this doctor on this date
  const bookedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctorProfileId,
      slotStart: {
        gte: dayStart,
        lt: dayEnd,
      },
      status: {
        in: ['PENDING_HOLD', 'CONFIRMED'],
      },
    },
    select: {
      slotStart: true,
    },
  });

  // Mark booked slots as unavailable
  const bookedTimes = new Set(
    bookedAppointments.map((a) => a.slotStart.toISOString()),
  );

  for (const slot of slots) {
    if (bookedTimes.has(slot.start)) {
      slot.available = false;
    }
  }

  return slots;
}
