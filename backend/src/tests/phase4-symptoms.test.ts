/**
 * Phase 4 — Pre-Visit Symptom Form + LLM Acceptance Test
 *
 * Tests:
 * 1. Setup: Admin creates doctor, patient holds a slot
 * 2. Patient submits symptom form (raw text)
 * 3. Background job processes it (mocked in test env) and updates DB
 * 4. Verify LLM classification output (urgency, chief complaint, etc.)
 * 5. Verify failure handling when LLM times out
 */

import { spawn } from 'child_process';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
process.env.NODE_ENV = 'test'; // Ensures worker mocks the LLM

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
  console.log('\n🧪 Phase 4 — Symptom Form & LLM Acceptance Tests\n');

  // Start background worker
  console.log('Starting background worker...');
  const workerProcess = spawn('npx', ['tsx', 'src/worker.ts'], {
    env: { ...process.env, NODE_ENV: 'test' },
    shell: true,
  });
  
  // Give worker a moment to connect to Redis
  await new Promise((res) => setTimeout(res, 2000));

  try {
    const ts = Date.now();

    // Setup: admin login
    const { data: adminLogin } = await request('POST', '/auth/login', {
      email: 'admin@healthcare.local',
      password: 'Admin123!',
    });
    const adminToken = adminLogin.data.accessToken;

    // Setup: register patient
    const { data: pReg } = await request('POST', '/auth/register', {
      email: `patient4-${ts}@test.com`,
      password: 'TestPass123',
      name: 'Patient Four',
    });
    const patientToken = pReg.data.accessToken;

    // Setup: create doctor
    const { data: doctorData } = await request(
      'POST',
      '/admin/doctors',
      {
        email: `doctor-phase4-${ts}@test.com`,
        password: 'DoctorPass123',
        name: 'Dr. Triage',
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
    const nextWednesday = getNextWeekday(3);
    
    // Get available slots to find the exact local timestamp
    const { data: slotsData } = await request(
      'GET',
      `/doctors/${doctorProfileId}/slots?date=${nextWednesday}`,
      undefined,
      patientToken,
    );
    
    const slot1Start = slotsData.data[0].start;
    const slot2Start = slotsData.data[1].start;

    // Hold two slots
    const { data: hold1 } = await request(
      'POST',
      '/appointments/hold',
      { doctorId: doctorProfileId, slotStart: slot1Start },
      patientToken,
    );
    const apt1Id = hold1.data.id;

    const { data: hold2 } = await request(
      'POST',
      '/appointments/hold',
      { doctorId: doctorProfileId, slotStart: slot2Start },
      patientToken,
    );
    const apt2Id = hold2.data.id;

    // ---- TEST: Submit Symptoms & Wait for Success ----
    await test('Submit symptoms & LLM processes successfully', async () => {
      const { status } = await request(
        'POST',
        '/symptoms',
        {
          appointmentId: apt1Id,
          rawSymptoms: 'I have had a severe headache and fever for 3 days.',
        },
        patientToken,
      );
      assert(status === 201, `Submit failed: ${status}`);

      // Wait for BullMQ job to process (mocked, takes ~500ms)
      await new Promise((res) => setTimeout(res, 2000));

      // Fetch result
      const { data } = await request(
        'GET',
        `/symptoms/appointment/${apt1Id}`,
        undefined,
        patientToken,
      );

      assert(data.data.llmStatus === 'SUCCESS', `Status is ${data.data.llmStatus}. Error: ${data.data.llmRawResponse}`);
      assert(data.data.llmUrgency === 'ROUTINE', 'Mock urgency mismatch');
    });

    // ---- TEST: Submit Symptoms & Simulate Timeout ----
    await test('LLM Timeout fails gracefully without blocking', async () => {
      const { status } = await request(
        'POST',
        '/symptoms',
        {
          appointmentId: apt2Id,
          rawSymptoms: 'SIMULATE_TIMEOUT: This will trigger the worker error catch.',
        },
        patientToken,
      );
      assert(status === 201, `Submit failed: ${status}`);

      // Wait for job failure
      await new Promise((res) => setTimeout(res, 1000));

      // Fetch result
      const { data } = await request(
        'GET',
        `/symptoms/appointment/${apt2Id}`,
        undefined,
        patientToken,
      );

      assert(data.data.llmStatus === 'FAILED', `Status is ${data.data.llmStatus}`);
      assert(data.data.llmRawResponse.includes('LLM Timeout Simulated'), 'Error message missing');
    });

  } finally {
    console.log('Stopping background worker...');
    workerProcess.kill();
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
