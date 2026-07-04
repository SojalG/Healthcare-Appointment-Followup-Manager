import { Worker, Job } from 'bullmq';
import { connection } from '../queue.js';
import { JOB_SEND_MEDICATION_REMINDER } from '../medication-reminder-queue.js';
import type { MedicationReminderJobData } from '../medication-reminder-queue.js';
import prisma from '../../db/client.js';
import { emailService } from '../../services/email.service.js';

export const medicationReminderWorker = new Worker(
  'medication-reminders',
  async (job: Job<MedicationReminderJobData>) => {
    console.log(`[medicationReminderWorker] Processing job ${job.id}`);
    if (job.name === JOB_SEND_MEDICATION_REMINDER) {
      const { medicationJobId } = job.data;
      console.log(`[medicationReminderWorker] Job ID: ${medicationJobId}`);

      const medJob = await prisma.medicationJob.findUnique({
        where: { id: medicationJobId },
        include: {
          visitNote: {
            include: {
              appointment: {
                include: {
                  patient: true,
                },
              },
            },
          },
        },
      });

      if (!medJob || medJob.status !== 'PENDING') return;

      const patient = medJob.visitNote.appointment.patient;
      if (!patient) {
        await prisma.medicationJob.update({
          where: { id: medicationJobId },
          data: { status: 'FAILED' },
        });
        return;
      }

      try {
        const subject = `Medication Reminder: ${medJob.drugName}`;
        const text = `Dear ${patient.name},\n\nThis is a friendly reminder to take your medication:\n\nDrug: ${medJob.drugName}\nDosage: ${medJob.dosage}\n\nThank you.`;

        await emailService.sendEmail({
          to: patient.email,
          subject,
          text,
        });

        await prisma.medicationJob.update({
          where: { id: medicationJobId },
          data: { status: 'SENT' },
        });
      } catch (err: any) {
        console.error(`Medication Job failed for ID ${medicationJobId}:`, err.message);
        await prisma.medicationJob.update({
          where: { id: medicationJobId },
          data: { status: 'FAILED' },
        });
        throw err;
      }
    }
  },
  { connection }
);

medicationReminderWorker.on('failed', (job, err) => {
  console.error(`Medication Job ${job?.id} failed with error ${err.message}`);
});
