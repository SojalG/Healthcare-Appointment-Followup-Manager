import prisma from '../../db/client.js';
import { AppError } from '../../utils/app-error.js';
import { visitSummaryQueue, JOB_GENERATE_VISIT_SUMMARY } from '../../jobs/visit-queue.js';
import type { SaveVisitNoteInput } from './visits.validation.js';
import { scheduleMedicationReminders } from '../medication-reminders/reminder-scheduler.service.js';

export async function saveVisitNote(doctorId: string, input: SaveVisitNoteInput) {
  // Verify appointment belongs to this doctor
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: { doctor: true },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found');
  }

  if (appointment.doctor.userId !== doctorId) {
    throw AppError.forbidden('You can only add notes to your own appointments');
  }

  // Save the note
  const note = await prisma.visitNote.upsert({
    where: { appointmentId: input.appointmentId },
    update: {
      doctorNotes: input.doctorNotes,
      prescription: input.prescription ?? [],
      llmStatus: 'PENDING',
    },
    create: {
      appointmentId: input.appointmentId,
      doctorNotes: input.doctorNotes,
      prescription: input.prescription ?? [],
      llmStatus: 'PENDING',
    },
  });

  // Mark appointment as COMPLETED
  await prisma.appointment.update({
    where: { id: input.appointmentId },
    data: { status: 'COMPLETED' },
  });

  // Enqueue patient-friendly summary generation
  await visitSummaryQueue.add(JOB_GENERATE_VISIT_SUMMARY, {
    visitNoteId: note.id,
  });

  // Schedule medication reminders
  await scheduleMedicationReminders(note.id);

  return note;
}

export async function getVisitNote(appointmentId: string, userId: string, role: string) {
  const note = await prisma.visitNote.findUnique({
    where: { appointmentId },
    include: {
      appointment: {
        include: { doctor: true },
      },
    },
  });

  if (!note) {
    throw AppError.notFound('Visit note not found');
  }

  // Access control
  if (role === 'PATIENT' && note.appointment.patientId !== userId) {
    throw AppError.forbidden('Access denied');
  }
  if (role === 'DOCTOR' && note.appointment.doctor.userId !== userId) {
    throw AppError.forbidden('Access denied');
  }

  return note;
}
