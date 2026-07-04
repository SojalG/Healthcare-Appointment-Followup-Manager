/**
 * Phase 5 — Visit Notes & Prescriptions Acceptance Test
 *
 * Tests:
 * 1. Setup: Admin creates doctor, patient holds & confirms slot
 * 2. Doctor saves visit note + prescription
 * 3. Background job generates patient summary (mocked in test env)
 * 4. Verify patient can see visit note and generated summary
 * 5. Verify patient cannot see another patient's visit note
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
  console.log('\n🧪 Phase 5 — Visit Notes & Prescriptions Acceptance Tests\n');

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
    const doctorPass = 'DoctorPass123';
    const doctorEmail = `doctor-phase5-${ts}@test.com`;
    const { data: doctorData } = await request(
      'POST',
      '/admin/doctors',
      {
        email: doctorEmail,
        password: doctorPass,
        name: 'Dr. Visits',
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

    // Setup: Doctor login
    const { data: doctorLogin } = await request('POST', '/auth/login', {
      email: doctorEmail,
      password: doctorPass,
    });
    const doctorToken = doctorLogin.data.accessToken;

    // Setup: register two patients
    const { data: p1Reg } = await request('POST', '/auth/register', {
      email: `patient5-1-${ts}@test.com`,
      password: 'TestPass123',
      name: 'Patient Five One',
    });
    const patient1Token = p1Reg.data.accessToken;

    const { data: p2Reg } = await request('POST', '/auth/register', {
      email: `patient5-2-${ts}@test.com`,
      password: 'TestPass123',
      name: 'Patient Five Two',
    });
    const patient2Token = p2Reg.data.accessToken;

    const nextWednesday = getNextWeekday(3);
    const { data: slotsData } = await request(
      'GET',
      `/doctors/${doctorProfileId}/slots?date=${nextWednesday}`,
      undefined,
      patient1Token,
    );
    
    const slotStart = slotsData.data[0].start;

    // Patient 1 holds and confirms slot
    const { data: hold } = await request(
      'POST',
      '/appointments/hold',
      { doctorId: doctorProfileId, slotStart },
      patient1Token,
    );
    const aptId = hold.data.id;

    await request('POST', `/appointments/${aptId}/confirm`, undefined, patient1Token);

    // ---- TEST: Doctor saves visit note ----
    await test('Doctor saves visit note and prescription', async () => {
      const { status } = await request(
        'POST',
        '/visits',
        {
          appointmentId: aptId,
          doctorNotes: 'Patient presents with mild fever and headache. Prescribed rest and paracetamol.',
          prescription: [
            {
              drug: 'Paracetamol',
              dosage: '500mg',
              frequency: 'Every 8 hours',
              duration: '3 days',
              instructions: 'Take after meals',
            },
          ],
        },
        doctorToken,
      );
      assert(status === 201, `Submit failed: ${status}`);

      // Wait for BullMQ job to process (mocked, takes ~500ms)
      await new Promise((res) => setTimeout(res, 2000));
    });

    // ---- TEST: Patient sees generated summary ----
    await test('Patient can view visit note with LLM summary', async () => {
      const { status, data } = await request(
        'GET',
        `/visits/appointment/${aptId}`,
        undefined,
        patient1Token,
      );

      assert(status === 200, `Expected 200, got ${status}`);
      assert(data.data.llmStatus === 'SUCCESS', `LLM status is ${data.data.llmStatus}`);
      assert(
        data.data.llmPatientSummary === 'Mock patient summary: Drink water and rest.',
        'Summary mismatch',
      );
      assert(data.data.prescription.length === 1, 'Prescription missing');
      assert(data.data.appointment.status === 'COMPLETED', 'Appointment not marked COMPLETED');
    });

    // ---- TEST: Access control ----
    await test('Other patient cannot view visit note', async () => {
      const { status } = await request(
        'GET',
        `/visits/appointment/${aptId}`,
        undefined,
        patient2Token,
      );
      assert(status === 403, `Expected 403, got ${status}`);
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
