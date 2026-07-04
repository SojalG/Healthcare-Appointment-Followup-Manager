import { Queue } from 'bullmq';
import { connection } from './queue.js';
import type { NotificationType, NotificationChannel } from '@prisma/client';

export const JOB_SEND_NOTIFICATION = 'sendNotification';

export const notificationQueue = new Queue('notifications', {
  connection,
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
});

export interface SendNotificationJobData {
  notificationLogId: string;
}

import prisma from '../db/client.js';

export async function enqueueNotification(
  type: NotificationType,
  channel: NotificationChannel,
  recipientId: string,
  appointmentId?: string,
) {
  const idempotencyKey = appointmentId ? `${appointmentId}-${type}-${channel}` : null;
  console.log(`[enqueueNotification] Request for ${type} via ${channel} with key ${idempotencyKey}`);

  try {
    if (idempotencyKey) {
      const existing = await prisma.notificationLog.findUnique({
        where: { idempotencyKey },
      });
      if (existing && (existing.status === 'SENT' || existing.status === 'PENDING')) {
        console.log(`[enqueueNotification] Duplicate request for key ${idempotencyKey}, skipping`);
        return existing;
      }
    }

    const log = await prisma.notificationLog.upsert({
      where: idempotencyKey ? { idempotencyKey } : { id: '' },
      update: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
      },
      create: {
        type,
        channel,
        recipientId,
        appointmentId,
        status: 'PENDING',
        idempotencyKey,
      },
    });

    console.log(`[enqueueNotification] Log created/updated with ID ${log.id}, enqueueing to BullMQ`);

    await notificationQueue.add(
      JOB_SEND_NOTIFICATION,
      { notificationLogId: log.id },
      {
        attempts: 3,
        backoff: {
          type: 'customExponential',
        },
      }
    );

    return log;
  } catch (err) {
    console.error('[enqueueNotification] Error:', err);
    throw err;
  }
}
