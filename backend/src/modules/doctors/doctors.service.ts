import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import prisma from '../../db/client.js';
import { AppError } from '../../utils/app-error.js';
import type { CreateDoctorInput, UpdateDoctorInput } from './doctors.validation.js';

const BCRYPT_ROUNDS = 12;

export async function createDoctor(input: CreateDoctorInput) {
  // Check if email taken
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict('Email already registered', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: Role.DOCTOR,
      name: input.name,
      phone: input.phone,
      doctorProfile: {
        create: {
          specialisation: input.specialisation,
          slotDurationMin: input.slotDurationMin,
          workingHours: {
            create: input.workingHours.map((wh) => ({
              weekday: wh.weekday,
              startTime: wh.startTime,
              endTime: wh.endTime,
            })),
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      doctorProfile: {
        select: {
          id: true,
          specialisation: true,
          slotDurationMin: true,
          workingHours: {
            select: { weekday: true, startTime: true, endTime: true },
            orderBy: { weekday: 'asc' },
          },
        },
      },
    },
  });

  return user;
}

export async function listDoctors() {
  return prisma.user.findMany({
    where: { role: Role.DOCTOR },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      createdAt: true,
      doctorProfile: {
        select: {
          id: true,
          specialisation: true,
          slotDurationMin: true,
          workingHours: {
            select: { weekday: true, startTime: true, endTime: true },
            orderBy: { weekday: 'asc' },
          },
          leaves: {
            select: { date: true, reason: true },
            orderBy: { date: 'asc' },
          },
        },
      },
    },
  });
}

export async function getDoctorById(doctorProfileId: string) {
  const profile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    select: {
      id: true,
      specialisation: true,
      slotDurationMin: true,
      workingHours: {
        select: { weekday: true, startTime: true, endTime: true },
        orderBy: { weekday: 'asc' },
      },
      user: {
        select: { id: true, email: true, name: true, phone: true, createdAt: true },
      },
    },
  });

  if (!profile) {
    throw AppError.notFound('Doctor not found');
  }

  return profile;
}

export async function updateDoctor(doctorProfileId: string, input: UpdateDoctorInput) {
  const profile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
  });

  if (!profile) {
    throw AppError.notFound('Doctor not found');
  }

  // Update user fields
  if (input.name || input.phone !== undefined) {
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone }),
      },
    });
  }

  // Update profile fields
  if (input.specialisation || input.slotDurationMin) {
    await prisma.doctorProfile.update({
      where: { id: doctorProfileId },
      data: {
        ...(input.specialisation && { specialisation: input.specialisation }),
        ...(input.slotDurationMin && { slotDurationMin: input.slotDurationMin }),
      },
    });
  }

  // Replace working hours if provided
  if (input.workingHours) {
    await prisma.workingHours.deleteMany({ where: { doctorId: doctorProfileId } });
    await prisma.workingHours.createMany({
      data: input.workingHours.map((wh) => ({
        doctorId: doctorProfileId,
        weekday: wh.weekday,
        startTime: wh.startTime,
        endTime: wh.endTime,
      })),
    });
  }

  return getDoctorById(doctorProfileId);
}

export async function deleteDoctor(doctorProfileId: string) {
  const profile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
  });

  if (!profile) {
    throw AppError.notFound('Doctor not found');
  }

  // Cascade delete: user → profile → working hours
  await prisma.user.delete({ where: { id: profile.userId } });
}

export async function searchDoctors(specialisation?: string) {
  return prisma.user.findMany({
    where: {
      role: Role.DOCTOR,
      ...(specialisation && {
        doctorProfile: {
          specialisation: {
            contains: specialisation,
            mode: 'insensitive' as const,
          },
        },
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      doctorProfile: {
        select: {
          id: true,
          specialisation: true,
          slotDurationMin: true,
        },
      },
    },
  });
}

import { enqueueNotification } from '../../jobs/notification-queue.js';

export async function declareLeave(userId: string, date: string, reason?: string) {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw AppError.notFound('Doctor profile not found');
  }

  const leaveDate = new Date(date);
  
  // 1. Create the Leave record and cancel appointments in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create leave
    const leave = await tx.leave.upsert({
      where: {
        doctorId_date: {
          doctorId: profile.id,
          date: leaveDate,
        },
      },
      update: { reason },
      create: {
        doctorId: profile.id,
        date: leaveDate,
        reason,
      },
    });

    // Find overlapping appointments
    const nextDay = new Date(leaveDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const affectedAppointments = await tx.appointment.findMany({
      where: {
        doctorId: profile.id,
        slotStart: {
          gte: leaveDate,
          lt: nextDay,
        },
        status: { in: ['PENDING_HOLD', 'CONFIRMED'] },
      },
      select: { id: true, patientId: true },
    });

    if (affectedAppointments.length > 0) {
      await tx.appointment.updateMany({
        where: {
          id: { in: affectedAppointments.map(a => a.id) },
        },
        data: { status: 'CANCELLED' },
      });
    }

    return { leave, affectedAppointments };
  });

  // 2. Enqueue LEAVE_NOTICE emails outside the transaction
  for (const apt of result.affectedAppointments) {
    await enqueueNotification('LEAVE_NOTICE', 'EMAIL', apt.patientId, apt.id);
  }

  return result.leave;
}
