import { Worker, Job } from 'bullmq';
import { JOB_SEND_NOTIFICATION } from '../notification-queue.js';
import { connection } from '../queue.js';
import type { SendNotificationJobData } from '../notification-queue.js';
import prisma from '../../db/client.js';
import { emailService } from '../../services/email.service.js';

export const notificationWorker = new Worker(
  'notifications',
  async (job: Job<SendNotificationJobData>) => {
    console.log(`[notificationWorker] Processing job ${job.id}`);
    if (job.name === JOB_SEND_NOTIFICATION) {
      const { notificationLogId } = job.data;
      console.log(`[notificationWorker] log ID: ${notificationLogId}`);

      const log = await prisma.notificationLog.findUnique({
        where: { id: notificationLogId },
        include: {
          appointment: { include: { doctor: { include: { user: true } } } },
        },
      });

      if (!log || log.status !== 'PENDING') return;

      const recipient = await prisma.user.findUnique({
        where: { id: log.recipientId },
      });

      if (!recipient) {
        await prisma.notificationLog.update({
          where: { id: notificationLogId },
          data: { status: 'FAILED', lastError: 'Recipient not found' },
        });
        return;
      }

      try {
        if (log.channel === 'EMAIL') {
          // Construct email based on type
          let subject = 'Healthcare Platform Notification';
          let text = 'You have a new notification.';

          if (log.type === 'CONFIRMATION') {
            subject = 'Appointment Confirmed';
            text = `Dear ${recipient.name},\n\nYour appointment with ${
              log.appointment?.doctor.user.name || 'your doctor'
            } is confirmed for ${log.appointment?.slotStart.toISOString()}.\n\nThank you.`;
          } else if (log.type === 'CANCELLATION') {
            subject = 'Appointment Cancelled';
            text = `Dear ${recipient.name},\n\nYour appointment has been cancelled.`;
          } else if (log.type === 'LEAVE_NOTICE') {
            subject = 'Doctor on Leave - Appointment Cancelled';
            text = `Dear ${recipient.name},\n\nWe regret to inform you that your appointment with ${
              log.appointment?.doctor.user.name || 'your doctor'
            } has been cancelled because the doctor is on leave. Please reschedule.`;
          }

          await emailService.sendEmail({
            to: recipient.email,
            subject,
            text,
          });
        } else if (log.channel === 'CALENDAR') {
          // Google Calendar integration goes here (Phase 6b)
          throw new Error('CALENDAR channel not yet implemented');
        }

        await prisma.notificationLog.update({
          where: { id: notificationLogId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            attempts: log.attempts + 1,
          },
        });
      } catch (err: any) {
        console.error(`Notification Job failed for log ${notificationLogId}:`, err.message);
        const isFinalAttempt = (job.attemptsMade + 1) >= (job.opts.attempts ?? 3);
        await prisma.notificationLog.update({
          where: { id: notificationLogId },
          data: {
            status: isFinalAttempt ? 'FAILED' : 'PENDING',
            lastError: err.message,
            attempts: job.attemptsMade + 1,
          },
        });
        throw err;
      }
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
    settings: {
      backoffStrategy: (attemptsMade: number, type?: string) => {
        if (type === 'customExponential') {
          const isTest = process.env.NODE_ENV === 'test';
          if (attemptsMade === 1) return isTest ? 50 : 60000;
          if (attemptsMade === 2) return isTest ? 100 : 300000;
          if (attemptsMade === 3) return isTest ? 150 : 1200000;
        }
        return -1;
      }
    }
  },
);

notificationWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error ${err.message}`);
});
