import prisma from '../../db/client.js';
import { enqueueMedicationReminder } from '../../jobs/medication-reminder-queue.js';

export function parseFrequency(freq: string): number {
  const normalized = freq.toLowerCase().trim();
  if (normalized.includes('3x') || normalized.includes('three') || normalized.includes('3 times')) {
    return 3;
  }
  if (normalized.includes('twice') || normalized.includes('2x') || normalized.includes('2 times') || normalized.includes('two times')) {
    return 2;
  }
  if (normalized.includes('daily') || normalized.includes('1x') || normalized.includes('once') || normalized.includes('one time')) {
    return 1;
  }
  return 1;
}

export function parseDurationDays(duration: string): number {
  const match = duration.match(/(\d+)\s*day/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  const normalized = duration.toLowerCase().trim();
  if (normalized.startsWith('one')) return 1;
  if (normalized.startsWith('two')) return 2;
  if (normalized.startsWith('three')) return 3;
  if (normalized.startsWith('four')) return 4;
  if (normalized.startsWith('five')) return 5;
  if (normalized.startsWith('six')) return 6;
  if (normalized.startsWith('seven')) return 7;
  return 1;
}

export function calculateReminders(frequency: number, durationDays: number, now: Date = new Date()): Date[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dates: Date[] = [];

  for (let day = 0; day < durationDays; day++) {
    const baseTime = tomorrow.getTime() + day * 24 * 60 * 60 * 1000;
    
    if (frequency === 1) {
      dates.push(new Date(baseTime + 8 * 60 * 60 * 1000));
    } else if (frequency === 2) {
      dates.push(new Date(baseTime + 8 * 60 * 60 * 1000));
      dates.push(new Date(baseTime + 20 * 60 * 60 * 1000));
    } else if (frequency === 3) {
      dates.push(new Date(baseTime + 8 * 60 * 60 * 1000));
      dates.push(new Date(baseTime + 14 * 60 * 60 * 1000));
      dates.push(new Date(baseTime + 20 * 60 * 60 * 1000));
    } else {
      dates.push(new Date(baseTime + 8 * 60 * 60 * 1000));
    }
  }

  return dates;
}

export async function scheduleMedicationReminders(visitNoteId: string) {
  const note = await prisma.visitNote.findUnique({
    where: { id: visitNoteId },
  });

  if (!note || !note.prescription) return;

  const prescription = note.prescription as any[];
  if (!Array.isArray(prescription)) return;

  const now = new Date();

  for (const item of prescription) {
    const freq = parseFrequency(item.frequency);
    const durationDays = parseDurationDays(item.duration);
    const scheduledDates = calculateReminders(freq, durationDays, now);

    for (const date of scheduledDates) {
      const delayMs = date.getTime() - now.getTime();

      // Create MedicationJob row
      const medJob = await prisma.medicationJob.create({
        data: {
          visitNoteId,
          drugName: item.drug,
          dosage: item.dosage,
          scheduledAt: date,
          status: 'PENDING',
        },
      });

      // Enqueue BullMQ delayed job
      await enqueueMedicationReminder(medJob.id, delayMs);
    }
  }
}
