import type { Request, Response, NextFunction } from 'express';
import prisma from '../../db/client.js';
import { notificationQueue, JOB_SEND_NOTIFICATION } from '../../jobs/notification-queue.js';
import { AppError } from '../../utils/app-error.js';

export async function getFailedNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await prisma.notificationLog.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      include: {
        appointment: {
          select: {
            patient: {
              select: {
                name: true,
                email: true,
              },
            },
            doctor: {
              select: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    res.json({ status: 'success', data: logs });
  } catch (err) {
    next(err);
  }
}

export async function retryNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const log = await prisma.notificationLog.findUnique({
      where: { id },
    });

    if (!log) {
      throw AppError.notFound('Notification log not found');
    }

    if (log.status !== 'FAILED') {
      throw AppError.badRequest('Can only retry failed notifications');
    }

    // Reset log status in DB
    const updatedLog = await prisma.notificationLog.update({
      where: { id },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
      },
    });

    // Re-add to BullMQ queue
    await notificationQueue.add(
      JOB_SEND_NOTIFICATION,
      { notificationLogId: id },
      {
        attempts: 3,
        backoff: {
          type: 'customExponential',
        },
      }
    );

    res.json({ status: 'success', data: updatedLog });
  } catch (err) {
    next(err);
  }
}
