/**
 * Phase 6 — Notifications Acceptance Test
 *
 * Tests:
 * 1. Setup: Admin creates doctor, patient holds slot
 * 2. Patient confirms slot -> should trigger CONFIRMATION email
 * 3. Wait for worker to process the job
 * 4. Verify NotificationLog is created and marked as SENT
 * 5. Patient cancels slot -> should trigger CANCELLATION email
 * 6. Wait for worker to process the job
 * 7. Verify NotificationLog is created and marked as SENT
 */

import { spawn } from 'child_process';
import prisma from '../db/client.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
process.env.NODE_ENV = 'test'; // Ensures we use mock email transport

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function test(name: string, fn: () => Promise<void>) {
  return fn()
    .then(() => {
      results.push({ name, passed: true });
      console.log(`  ✅ ${name}`);
    })
    .catch((err: Error) => {
      results.push({ name, passed: false, error: err.message });
      console.log(`  ❌ ${name}: ${err.message}`);
    });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function getNextWeekday(dayOfWeek: number): string {
  const d = new Date();
  d.setDate(d.getDate() + ((dayOfWeek + 7 - d.getDay()) % 7 || 7));
  return d.toISOString().split('T')[0];
}

async function run() {
  console.log('\n🧪 Phase 6 — Notifications Acceptance Tests\n');

  console.log('Starting background worker...');
  const workerProcess = spawn('npx', ['tsx', 'src/worker.ts'], {
    env: { ...process.env, NODE_ENV: 'test' },
    shell: true,
    stdio: 'inherit',
  });
  
  await new Promise((res) => setTimeout(res, 2000));

  try {
    const ts = Date.now();

    // Setup: admin login
    const { data: adminLogin } = await request('POST', '/auth/login', {
      email: 'admin@healthcare.local',
      password: 'Admin123!',
    });
    const adminToken = adminLogin.data.accessToken;

    // Setup: create doctor
    const { data: doctorData } = await request(
      'POST',
      '/admin/doctors',
      {
        email: `doctor-phase6-${ts}@test.com`,
        password: 'DoctorPass123',
        name: 'Dr. Notifier',
        specialisation: 'General Practice',
        slotDurationMin: 30,
        workingHours: [
          { weekday: 1, startTime: '09:00', endTime: '17:00' },
          { weekday: 2, startTime: '09:00', endTime: '17:00' },
          { weekday: 3, startTime: '09:00', endTime: '17:00' },
        ],
      },
      adminToken,
    );
    const doctorProfileId = doctorData.data.doctorProfile.id;

    // Setup: register patient
    const { data: pReg } = await request('POST', '/auth/register', {
      email: `patient6-${ts}@test.com`,
      password: 'TestPass123',
      name: 'Patient Six',
    });
    const patientToken = pReg.data.accessToken;

    const nextWednesday = getNextWeekday(3);
    const { data: slotsData } = await request(
      'GET',
      `/doctors/${doctorProfileId}/slots?date=${nextWednesday}`,
      undefined,
      patientToken,
    );
    
    const slotStart = slotsData.data[0].start;

    const { data: hold } = await request(
      'POST',
      '/appointments/hold',
      { doctorId: doctorProfileId, slotStart },
      patientToken,
    );
    console.log('Hold Response:', hold);
    const aptId = hold?.data?.id;
    if (!aptId) throw new Error('Failed to hold slot');

    // ---- TEST: Confirm -> triggers email ----
    await test('Confirming appointment triggers CONFIRMATION email', async () => {
      const { status } = await request('POST', `/appointments/${aptId}/confirm`, undefined, patientToken);
      assert(status === 200, `Confirm failed: ${status}`);

      // Wait for BullMQ worker
      await new Promise((res) => setTimeout(res, 4000));

      const logs = await prisma.notificationLog.findMany({
        where: { appointmentId: aptId, type: 'CONFIRMATION', channel: 'EMAIL' },
      });
      assert(logs.length === 1, `Expected 1 confirmation log, found ${logs.length}`);
      assert(logs[0].status === 'SENT', `Log status is ${logs[0].status}, expected SENT`);
    });

    // ---- TEST: Cancel -> triggers email ----
    await test('Cancelling appointment triggers CANCELLATION email', async () => {
      const { status } = await request('DELETE', `/appointments/${aptId}`, undefined, patientToken);
      assert(status === 200, `Cancel failed: ${status}`);

      // Wait for BullMQ worker
      await new Promise((res) => setTimeout(res, 4000));

      const logs = await prisma.notificationLog.findMany({
        where: { appointmentId: aptId, type: 'CANCELLATION', channel: 'EMAIL' },
      });
      assert(logs.length === 1, `Expected 1 cancellation log, found ${logs.length}`);
      assert(logs[0].status === 'SENT', `Log status is ${logs[0].status}, expected SENT`);
    });

  } finally {
    console.log('Stopping background worker...');
    workerProcess.kill();
    await prisma.$disconnect();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n📊 Results: ${passed}/${total} passed\n`);
  if (passed < total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
