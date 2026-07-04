import { Queue } from 'bullmq';
import { connection } from './queue.js';

export const JOB_SEND_MEDICATION_REMINDER = 'sendMedicationReminder';

export const medicationReminderQueue = new Queue('medication-reminders', { connection });

export interface MedicationReminderJobData {
  medicationJobId: string;
}

export async function enqueueMedicationReminder(medicationJobId: string, delayMs: number) {
  console.log(`[enqueueMedicationReminder] Enqueueing job ${medicationJobId} with delay ${delayMs}ms`);
  await medicationReminderQueue.add(
    JOB_SEND_MEDICATION_REMINDER,
    { medicationJobId },
    { delay: delayMs }
  );
}
