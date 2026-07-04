import { Prisma } from '@prisma/client';
import prisma from '../../db/client.js';
import { AppError } from '../../utils/app-error.js';
import { env } from '../../config/env.js';
import { enqueueNotification } from '../../jobs/notification-queue.js';
import type { HoldSlotInput } from './appointments.validation.js';

/**
 * Hold a slot for a patient.
 *
 * Concurrency safety: the partial unique index `uniq_doctor_slot_active`
 * on (doctor_id, slot_start) WHERE status IN ('PENDING_HOLD','CONFIRMED')
 * ensures only one active booking per slot. If two patients try to hold
 * the same slot simultaneously, exactly one INSERT succeeds; the other
 * gets a unique constraint violation → 409.
 */
export async function holdSlot(patientId: string, input: HoldSlotInput) {
  const { doctorId, slotStart } = input;
  const slotStartDate = new Date(slotStart);

  // Validate the doctor exists
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    select: { slotDurationMin: true },
  });

  if (!doctor) {
    throw AppError.notFound('Doctor not found');
  }

  const slotEnd = new Date(slotStartDate.getTime() + doctor.slotDurationMin * 60000);
  const holdExpiresAt = new Date(Date.now() + env.SLOT_HOLD_MINUTES * 60000);

  // Booking Idempotency check: see if there's already an active hold/booking for this patient, doctor, and slotStart
  const existing = await prisma.appointment.findFirst({
    where: {
      patientId,
      doctorId,
      slotStart: slotStartDate,
      status: { in: ['PENDING_HOLD', 'CONFIRMED'] },
    },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      slotStart: true,
      slotEnd: true,
      status: true,
      holdExpiresAt: true,
      createdAt: true,
    },
  });

  if (existing) {
    console.log(`[holdSlot] Idempotent request. Returning existing active booking: ${existing.id}`);
    return existing;
  }

  try {
    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        slotStart: slotStartDate,
        slotEnd,
        status: 'PENDING_HOLD',
        holdExpiresAt,
      },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        slotStart: true,
        slotEnd: true,
        status: true,
        holdExpiresAt: true,
        createdAt: true,
      },
    });

    return appointment;
  } catch (err) {
    // Catch the unique constraint violation from the partial index
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw AppError.conflict(
        'Slot no longer available. Another patient has already booked this time.',
        'SLOT_TAKEN',
      );
    }
    throw err;
  }
}

/**
 * Confirm a held appointment.
 * Validates the hold hasn't expired and belongs to the patient.
 */
export async function confirmAppointment(appointmentId: string, patientId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found');
  }

  if (appointment.patientId !== patientId) {
    throw AppError.forbidden('You can only confirm your own appointments');
  }

  if (appointment.status !== 'PENDING_HOLD') {
    throw AppError.badRequest(
      `Cannot confirm appointment with status '${appointment.status}'`,
      'INVALID_STATUS',
    );
  }

  // Check hold expiry
  if (appointment.holdExpiresAt && appointment.holdExpiresAt < new Date()) {
    // Hold expired — delete it to free the slot
    await prisma.appointment.delete({ where: { id: appointmentId } });
    throw AppError.badRequest(
      'Hold has expired. Please select a new slot.',
      'HOLD_EXPIRED',
    );
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'CONFIRMED',
      holdExpiresAt: null, // No longer needed
    },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      slotStart: true,
      slotEnd: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // 3. Trigger email confirmation asynchronously
  console.log(`[confirmAppointment] Calling enqueueNotification for apt ${appointmentId}`);
  await enqueueNotification('CONFIRMATION', 'EMAIL', patientId, appointmentId);

  return updated;
}

/**
 * Cancel an appointment.
 */
export async function cancelAppointment(appointmentId: string, userId: string, userRole: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found');
  }

  // Patients can only cancel their own; admins can cancel any
  if (userRole !== 'ADMIN' && appointment.patientId !== userId) {
    throw AppError.forbidden('You can only cancel your own appointments');
  }

  if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
    throw AppError.badRequest(
      `Cannot cancel appointment with status '${appointment.status}'`,
      'INVALID_STATUS',
    );
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELLED' },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });

  // 3. Trigger email cancellation asynchronously
  await enqueueNotification('CANCELLATION', 'EMAIL', appointment.patientId, appointmentId);

  return updated;
}

/**
 * Get appointments for a patient (upcoming and past).
 */
export async function getPatientAppointments(patientId: string) {
  return prisma.appointment.findMany({
    where: { patientId },
    orderBy: { slotStart: 'desc' },
    select: {
      id: true,
      doctorId: true,
      slotStart: true,
      slotEnd: true,
      status: true,
      createdAt: true,
      doctor: {
        select: {
          specialisation: true,
          user: { select: { name: true } },
        },
      },
      symptomForm: {
        select: { llmUrgency: true, llmChiefComplaint: true, llmStatus: true },
      },
    },
  });
}

/**
 * Reschedule an appointment — cancel old, hold new slot.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  patientId: string,
  newSlotStart: string,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { symptomForm: true },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found');
  }

  if (appointment.patientId !== patientId) {
    throw AppError.forbidden('You can only reschedule your own appointments');
  }

  if (appointment.status !== 'CONFIRMED' && appointment.status !== 'PENDING_HOLD') {
    throw AppError.badRequest('Can only reschedule active appointments', 'INVALID_STATUS');
  }

  // Cancel old, hold new — in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Cancel old
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });

    const doctor = await tx.doctorProfile.findUnique({
      where: { id: appointment.doctorId },
      select: { slotDurationMin: true },
    });

    const slotStartDate = new Date(newSlotStart);
    const slotEnd = new Date(slotStartDate.getTime() + (doctor?.slotDurationMin ?? 30) * 60000);
    const holdExpiresAt = new Date(Date.now() + env.SLOT_HOLD_MINUTES * 60000);

    // Hold new slot
    const newAppointment = await tx.appointment.create({
      data: {
        patientId,
        doctorId: appointment.doctorId,
        slotStart: slotStartDate,
        slotEnd,
        status: 'PENDING_HOLD',
        holdExpiresAt,
      },
    });

    // Preserve symptom form if it exists
    if (appointment.symptomForm) {
      await tx.symptomForm.create({
        data: {
          appointmentId: newAppointment.id,
          rawSymptoms: appointment.symptomForm.rawSymptoms,
          llmUrgency: appointment.symptomForm.llmUrgency,
          llmChiefComplaint: appointment.symptomForm.llmChiefComplaint,
          llmQuestions: appointment.symptomForm.llmQuestions,
          llmRawResponse: appointment.symptomForm.llmRawResponse,
          llmStatus: appointment.symptomForm.llmStatus,
        },
      });
    }

    return newAppointment;
  });

  return result;
}

/**
 * Sweep expired holds. Called by background job.
 */
export async function sweepExpiredHolds() {
  const result = await prisma.appointment.deleteMany({
    where: {
      status: 'PENDING_HOLD',
      holdExpiresAt: { lt: new Date() },
    },
  });

  return result.count;
}

/**
 * Get appointments for a doctor (their queue).
 */
export async function getDoctorAppointments(doctorUserId: string) {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: doctorUserId },
    select: { id: true },
  });

  if (!profile) {
    throw AppError.notFound('Doctor profile not found');
  }

  return prisma.appointment.findMany({
    where: { doctorId: profile.id },
    orderBy: { slotStart: 'asc' },
    select: {
      id: true,
      patientId: true,
      slotStart: true,
      slotEnd: true,
      status: true,
      createdAt: true,
      patient: {
        select: {
          name: true,
          email: true,
        },
      },
      symptomForm: {
        select: {
          rawSymptoms: true,
          llmUrgency: true,
          llmChiefComplaint: true,
          llmQuestions: true,
          llmStatus: true,
        },
      },
      visitNote: {
        select: {
          id: true,
          doctorNotes: true,
          prescription: true,
          llmPatientSummary: true,
          llmStatus: true,
        },
      },
    },
  });
}
