import { test, assert } from './test-runner.js';
import { request } from './test-utils.js';
import prisma from '../db/client.js';
import { spawn } from 'child_process';

process.env.NODE_ENV = 'test';

async function runTests() {
  console.log('\n🧪 Phase 9 — Reliability & Idempotency Acceptance Tests');

  // Start the background worker process
  console.log('Starting background worker...');
  const workerProcess = spawn('npx', ['tsx', 'src/worker.ts'], {
    env: { ...process.env, NODE_ENV: 'test' },
    shell: true,
    stdio: 'inherit',
  });
  
  await new Promise((res) => setTimeout(res, 2000));

  try {
    // 1. Setup Admin, Doctor
    const { data: adminLogin } = await request('POST', '/auth/login', {
      email: 'admin@healthcare.local',
      password: 'Admin123!',
    });
    const adminToken = adminLogin.data.accessToken;

    const doctorEmail = `doctor-${Date.now()}@test.com`;
    const doctorPassword = 'DoctorPass123!';
    const { data: doctorData } = await request('POST', '/admin/doctors', {
      email: doctorEmail,
      password: doctorPassword,
      name: 'Dr. Gregory House',
      specialisation: 'Diagnostics',
      slotDurationMin: 30,
      workingHours: [{ weekday: 4, startTime: '09:00', endTime: '12:00' }] // Thursday
    }, adminToken);
    const doctorId = doctorData.data.doctorProfile.id;

    // 2. Setup Patients
    const patientEmailNormal = `patient-ok-${Date.now()}@test.com`;
    const { data: pNormalReg } = await request('POST', '/auth/register', {
      email: patientEmailNormal,
      password: 'PatientPass123!',
      name: 'Patient Nine Normal',
    });
    const normalToken = pNormalReg.data.accessToken;

    const patientEmailFail = `patient-fail-${Date.now()}@test.com`;
    const { data: pFailReg } = await request('POST', '/auth/register', {
      email: patientEmailFail,
      password: 'PatientPass123!',
      name: 'Patient Nine Fail',
    });
    const failToken = pFailReg.data.accessToken;

    // 3. Test Booking Idempotency
    await test('Booking slot twice returns the same hold (Idempotency)', async () => {
      const nextThu = new Date();
      nextThu.setDate(nextThu.getDate() + ((4 - nextThu.getDay() + 7) % 7 || 7));
      const dateStr = nextThu.toISOString().split('T')[0];

      // Get slots
      const { data: slotsData } = await request('GET', `/doctors/${doctorId}/slots?date=${dateStr}`, undefined, normalToken);
      const slotStart = slotsData.data[0].start;

      // Hold slot 1st time
      const { status: s1, data: d1 } = await request('POST', '/appointments/hold', { doctorId, slotStart }, normalToken);
      assert(s1 === 201, `Failed first hold: ${s1}`);
      const holdId1 = d1.data.id;

      // Hold slot 2nd time (idempotent request)
      const { status: s2, data: d2 } = await request('POST', '/appointments/hold', { doctorId, slotStart }, normalToken);
      assert(s2 === 200 || s2 === 201, `Failed second hold: ${s2}`);
      const holdId2 = d2.data.id;

      assert(holdId1 === holdId2, 'Booking idempotency failed: returned different hold IDs');
    });

    // 4. Test Notification Transient Failures and Retries
    await test('Transient email delivery failures retry and eventually land in FAILED status', async () => {
      const nextThu = new Date();
      nextThu.setDate(nextThu.getDate() + ((4 - nextThu.getDay() + 7) % 7 || 7));
      const dateStr = nextThu.toISOString().split('T')[0];

      // Get slots (using the second slot to avoid collision)
      const { data: slotsData } = await request('GET', `/doctors/${doctorId}/slots?date=${dateStr}`, undefined, failToken);
      const slotStart = slotsData.data[1].start;

      // Hold slot
      const { data: hold } = await request('POST', '/appointments/hold', { doctorId, slotStart }, failToken);
      const aptId = hold.data.id;

      // Confirm appointment -> triggers notification job
      await request('POST', `/appointments/${aptId}/confirm`, undefined, failToken);

      // Wait for 3 attempts (each delay is 50-150ms in test mode)
      console.log('Waiting for retries to complete...');
      await new Promise((res) => setTimeout(res, 2000));

      const log = await prisma.notificationLog.findFirst({
        where: { appointmentId: aptId, type: 'CONFIRMATION', channel: 'EMAIL' }
      });

      assert(log !== null, 'Notification log not found');
      assert(log!.attempts === 3, `Expected exactly 3 attempts, got ${log!.attempts}`);
      assert(log!.status === 'FAILED', `Expected status FAILED, got ${log!.status}`);
      assert(log!.lastError!.includes('Simulated transient email failure'), `Unexpected error message: ${log!.lastError}`);
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
