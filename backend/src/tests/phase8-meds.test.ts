import { test, assert } from './test-runner.js';
import { request } from './test-utils.js';
import prisma from '../db/client.js';
import { spawn } from 'child_process';
import { medicationReminderQueue } from '../jobs/medication-reminder-queue.js';

process.env.NODE_ENV = 'test';

async function runTests() {
  console.log('\n🧪 Phase 8 — Medication Reminders Acceptance Tests');

  // Start the background worker process
  console.log('Starting background worker...');
  const workerProcess = spawn('npx', ['tsx', 'src/worker.ts'], {
    env: { ...process.env, NODE_ENV: 'test' },
    shell: true,
    stdio: 'inherit',
  });
  
  await new Promise((res) => setTimeout(res, 2000));

  try {
    // 1. Setup: login admin, create doctor, login doctor, register patient, login patient
    const { data: adminLogin } = await request('POST', '/auth/login', {
      email: 'admin@healthcare.local',
      password: 'Admin123!',
    });
    const adminToken = adminLogin.data.accessToken;

    const patientEmail = `patient-${Date.now()}@test.com`;
    const { data: pReg } = await request('POST', '/auth/register', {
      email: patientEmail,
      password: 'PatientPass123!',
      name: 'Patient Eight',
    });
    const patientToken = pReg.data.accessToken;

    const doctorEmail = `doctor-${Date.now()}@test.com`;
    const doctorPassword = 'DoctorPass123!';
    const { data: doctorData } = await request('POST', '/admin/doctors', {
      email: doctorEmail,
      password: doctorPassword,
      name: 'Dr. Gregory House',
      specialisation: 'Nephrology',
      slotDurationMin: 30,
      workingHours: [{ weekday: 4, startTime: '09:00', endTime: '12:00' }] // Thursday
    }, adminToken);
    const doctorId = doctorData.data.doctorProfile.id;

    const { data: doctorLogin } = await request('POST', '/auth/login', {
      email: doctorEmail,
      password: doctorPassword,
    });
    const doctorToken = doctorLogin.data.accessToken;

    // 2. Patient holds and confirms slot
    const nextThu = new Date();
    nextThu.setDate(nextThu.getDate() + ((4 - nextThu.getDay() + 7) % 7 || 7));
    const dateStr = nextThu.toISOString().split('T')[0];

    const { data: slotsData } = await request('GET', `/doctors/${doctorId}/slots?date=${dateStr}`, undefined, patientToken);
    const slotStart = slotsData.data[0].start;

    const { data: hold } = await request('POST', '/appointments/hold', { doctorId, slotStart }, patientToken);
    const aptId = hold.data.id;

    await request('POST', `/appointments/${aptId}/confirm`, undefined, patientToken);

    // 3. Doctor submits post-visit notes and prescription
    await test('Doctor saves visit notes and prescription with reminders', async () => {
      const { status, data } = await request(
        'POST',
        '/visits',
        {
          appointmentId: aptId,
          doctorNotes: 'Patient has mild infection. Prescribed Amoxicillin.',
          prescription: [
            {
              drug: 'Amoxicillin',
              dosage: '500mg',
              frequency: '3x daily',
              duration: '2 days',
              instructions: 'Take after meals',
            },
          ],
        },
        doctorToken
      );

      assert(status === 200 || status === 201, `Failed to save visit note: ${status} - ${JSON.stringify(data)}`);
    });

    // 4. Verify MedicationJobs were created in database
    await test('Correct number of MedicationJob records created in DB', async () => {
      const visitNote = await prisma.visitNote.findUnique({
        where: { appointmentId: aptId },
        include: { medicationJobs: true },
      });

      assert(visitNote !== null, 'Visit note not found');
      const jobs = visitNote!.medicationJobs;
      assert(jobs.length === 6, `Expected 6 MedicationJob records, got ${jobs.length}`);

      for (const job of jobs) {
        assert(job.status === 'PENDING', `Expected status PENDING, got ${job.status}`);
        assert(job.drugName === 'Amoxicillin', `Expected drugName Amoxicillin, got ${job.drugName}`);
        assert(job.dosage === '500mg', `Expected dosage 500mg, got ${job.dosage}`);
      }
    });

    // 5. Verify jobs are enqueued in BullMQ
    await test('Jobs are enqueued in BullMQ queue', async () => {
      // Fetch delayed jobs from queue
      const queueJobs = await medicationReminderQueue.getJobs(['delayed']);
      
      // Filter jobs matching our visitNote
      const visitNote = await prisma.visitNote.findUnique({
        where: { appointmentId: aptId },
      });
      assert(visitNote !== null, 'VisitNote not found');

      const matchingJobs = [];
      for (const qJob of queueJobs) {
        if (qJob.data && qJob.data.medicationJobId) {
          const dbJob = await prisma.medicationJob.findFirst({
            where: { id: qJob.data.medicationJobId, visitNoteId: visitNote!.id },
          });
          if (dbJob) {
            matchingJobs.push(qJob);
          }
        }
      }

      assert(matchingJobs.length === 6, `Expected 6 BullMQ delayed jobs, found ${matchingJobs.length}`);
    });

  } finally {
    console.log('Stopping background worker...');
    workerProcess.kill();
    await medicationReminderQueue.close();
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
