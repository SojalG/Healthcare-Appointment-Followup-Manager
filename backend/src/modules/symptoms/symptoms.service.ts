import prisma from '../../db/client.js';
import { AppError } from '../../utils/app-error.js';
import { llmQueue, JOB_ANALYZE_SYMPTOMS } from '../../jobs/queue.js';
import type { SubmitSymptomsInput } from './symptoms.validation.js';

export async function submitSymptoms(patientId: string, input: SubmitSymptomsInput) {
  // 1. Verify appointment belongs to patient and is in a valid state
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found');
  }

  if (appointment.patientId !== patientId) {
    throw AppError.forbidden('You can only submit symptoms for your own appointments');
  }

  // 2. Create or update symptom form
  const form = await prisma.symptomForm.upsert({
    where: { appointmentId: input.appointmentId },
    update: {
      rawSymptoms: input.rawSymptoms,
      llmStatus: 'PENDING',
    },
    create: {
      appointmentId: input.appointmentId,
      rawSymptoms: input.rawSymptoms,
      llmStatus: 'PENDING',
    },
  });

  // 3. Enqueue LLM analysis job
  await llmQueue.add(JOB_ANALYZE_SYMPTOMS, {
    symptomFormId: form.id,
  });

  return form;
}

export async function getSymptomsByAppointment(appointmentId: string, userId: string, role: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { symptomForm: true },
  });

  if (!appointment) {
    throw AppError.notFound('Appointment not found');
  }

  // Doctors can see, patients can see their own
  if (role === 'PATIENT' && appointment.patientId !== userId) {
    throw AppError.forbidden('Access denied');
  }
  // If doctor, ensure they are the doctor for this appointment
  if (role === 'DOCTOR') {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId },
    });
    if (!doctorProfile || appointment.doctorId !== doctorProfile.id) {
      throw AppError.forbidden('Access denied');
    }
  }

  return appointment.symptomForm;
}
