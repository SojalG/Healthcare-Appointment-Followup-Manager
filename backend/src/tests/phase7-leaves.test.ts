import { test, assert } from './test-runner.js';
import { request } from './test-utils.js';
import prisma from '../db/client.js';
import { spawn } from 'child_process';
import { env } from '../config/env.js';

process.env.NODE_ENV = 'test';

async function runTests() {
  console.log('\n🧪 Phase 7 — Leave Management & Conflicts');

  // Start the background worker process
  console.log('Starting background worker...');
  const workerProcess = spawn('npx', ['tsx', 'src/worker.ts'], {
    env: { ...process.env, NODE_ENV: 'test' },
    shell: true,
    stdio: 'inherit',
  });
  
  await new Promise((res) => setTimeout(res, 2000));

  try {
    // 1. Setup Admin, Patient, Doctor
    const { data: adminLogin } = await request('POST', '/auth/login', {
      email: 'admin@healthcare.local',
      password: 'Admin123!',
    });
    const adminToken = adminLogin.data.accessToken;

    const patientEmail = `patient-${Date.now()}@test.com`;
    const { data: pReg } = await request('POST', '/auth/register', {
      email: patientEmail,
      password: 'PatientPass123!',
      name: 'Patient Seven',
    });
    const patientToken = pReg.data.accessToken;

    const doctorEmail = `doctor-${Date.now()}@test.com`;
    const doctorPassword = 'DoctorPass123!';
    const { data: doctorData } = await request('POST', '/admin/doctors', {
      email: doctorEmail,
      password: doctorPassword,
      name: 'Dr. House',
      specialisation: 'Diagnostics',
      slotDurationMin: 30,
      workingHours: [{ weekday: 3, startTime: '09:00', endTime: '12:00' }] // Wednesday
    }, adminToken);
    const doctorId = doctorData.data.doctorProfile.id;

    const { data: doctorLogin } = await request('POST', '/auth/login', {
      email: doctorEmail,
      password: doctorPassword,
    });
    const doctorToken = doctorLogin.data.accessToken;

    // 2. Patient books an appointment for next Wednesday
    const nextWed = new Date();
    nextWed.setDate(nextWed.getDate() + ((3 - nextWed.getDay() + 7) % 7 || 7));
    const dateStr = nextWed.toISOString().split('T')[0];

    const { data: slotsData } = await request('GET', `/doctors/${doctorId}/slots?date=${dateStr}`, undefined, patientToken);
    const slotStart = slotsData.data[0].start;

    // Hold slot
    const { data: hold } = await request('POST', '/appointments/hold', { doctorId, slotStart }, patientToken);
    const aptId = hold.data.id;

    // Confirm slot
    await request('POST', `/appointments/${aptId}/confirm`, undefined, patientToken);

    // 3. Doctor declares leave for that date
    await test('Doctor declares leave', async () => {
      const { status, data } = await request('POST', '/doctors/me/leaves', {
        date: dateStr,
        reason: 'Sick leave'
      }, doctorToken);

      assert(status === 201, `Failed to declare leave: ${status} - ${JSON.stringify(data)}`);
      assert(data.data.date.startsWith(dateStr), 'Leave date does not match');
    });

    // 4. Verify appointment is cancelled
    await test('Leave cancels overlapping appointments', async () => {
      const apt = await prisma.appointment.findUnique({ where: { id: aptId } });
      assert(apt?.status === 'CANCELLED', `Appointment status should be CANCELLED, got ${apt?.status}`);
    });

    // 5. Verify LEAVE_NOTICE email is sent
    await test('LEAVE_NOTICE email is triggered for cancelled appointments', async () => {
      await new Promise((res) => setTimeout(res, 4000));
      const logs = await prisma.notificationLog.findMany({
        where: { appointmentId: aptId, type: 'LEAVE_NOTICE', channel: 'EMAIL' }
      });
      assert(logs.length === 1, `Expected 1 LEAVE_NOTICE log, found ${logs.length}`);
      assert(logs[0].status === 'SENT', `Log status is ${logs[0].status}, expected SENT`);
    });

  } finally {
    console.log('Stopping background worker...');
    workerProcess.kill();
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
