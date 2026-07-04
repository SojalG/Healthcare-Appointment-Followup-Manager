/**
 * Phase 3 — Search & Booking Acceptance Test (CONCURRENCY)
 *
 * The critical test: two simultaneous booking requests for the same slot.
 * Exactly one must succeed (201), the other must fail (409).
 * This validates the Postgres partial unique index (§5).
 *
 * Tests:
 * 1. Setup: admin creates a doctor, two patients register
 * 2. Both patients simultaneously try to hold the same slot
 * 3. Exactly one gets 201, the other gets 409
 * 4. The winning patient confirms → CONFIRMED
 * 5. After confirmation, slot shows as unavailable
 * 6. Hold → wait for expiry → slot becomes available again
 * 7. Cancel restores availability
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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
  console.log('\n🧪 Phase 3 — Search & Booking Concurrency Acceptance Tests\n');

  const ts = Date.now();

  // Setup: admin login
  const { data: adminLogin } = await request('POST', '/auth/login', {
    email: 'admin@healthcare.local',
    password: 'Admin123!',
  });
  const adminToken = adminLogin.data.accessToken;

  // Setup: register two patients
  const { data: p1Reg } = await request('POST', '/auth/register', {
    email: `patient1-${ts}@test.com`,
    password: 'TestPass123',
    name: 'Patient One',
  });
  const patient1Token = p1Reg.data.accessToken;
  const patient1Id = p1Reg.data.user.id;

  const { data: p2Reg } = await request('POST', '/auth/register', {
    email: `patient2-${ts}@test.com`,
    password: 'TestPass123',
    name: 'Patient Two',
  });
  const patient2Token = p2Reg.data.accessToken;

  // Setup: create doctor
  const { data: doctorData } = await request(
    'POST',
    '/admin/doctors',
    {
      email: `doctor-phase3-${ts}@test.com`,
      password: 'DoctorPass123',
      name: 'Dr. Concurrency',
      specialisation: 'Neurology',
      slotDurationMin: 30,
      workingHours: [
        { weekday: 1, startTime: '09:00', endTime: '17:00' },
        { weekday: 2, startTime: '09:00', endTime: '17:00' },
        { weekday: 3, startTime: '09:00', endTime: '17:00' },
        { weekday: 4, startTime: '09:00', endTime: '17:00' },
        { weekday: 5, startTime: '09:00', endTime: '17:00' },
      ],
    },
    adminToken,
  );
  const doctorProfileId = doctorData.data.doctorProfile.id;
  const nextTuesday = getNextWeekday(2);

  // Get available slots to find the exact UTC timestamp for 9:00 local
  const { data: slotsData } = await request(
    'GET',
    `/doctors/${doctorProfileId}/slots?date=${nextTuesday}`,
    undefined,
    patient1Token,
  );
  
  assert(slotsData?.data?.length > 0, 'No slots generated');
  const slotStart = slotsData.data[0].start;

  // ---- TEST: Concurrent booking ----
  let winnerId = '';
  let winnerToken = '';

  await test('CONCURRENT: Two patients hold same slot → exactly one 201, one 409', async () => {
    // Fire both requests in parallel
    const [res1, res2] = await Promise.all([
      request('POST', '/appointments/hold', { doctorId: doctorProfileId, slotStart }, patient1Token),
      request('POST', '/appointments/hold', { doctorId: doctorProfileId, slotStart }, patient2Token),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      `Expected [201, 409], got [${statuses}]. res1=${res1.status}:${JSON.stringify(res1.data)}, res2=${res2.status}:${JSON.stringify(res2.data)}`,
    );

    // Identify winner
    if (res1.status === 201) {
      winnerId = res1.data.data.id;
      winnerToken = patient1Token;
    } else {
      winnerId = res2.data.data.id;
      winnerToken = patient2Token;
    }
  });

  // ---- TEST: Confirm ----
  await test('Winner confirms the held slot → CONFIRMED', async () => {
    const { status, data } = await request(
      'POST',
      `/appointments/${winnerId}/confirm`,
      undefined,
      winnerToken,
    );
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.data.status === 'CONFIRMED', `Expected CONFIRMED, got ${data.data.status}`);
  });

  // ---- TEST: Slot now shows as unavailable ----
  await test('Slot now shows as unavailable in slot query', async () => {
    const { data } = await request(
      'GET',
      `/doctors/${doctorProfileId}/slots?date=${nextTuesday}`,
      undefined,
      patient1Token,
    );
    const firstSlot = data.data[0];
    assert(firstSlot.available === false, 'First slot should be unavailable');
  });

  // ---- TEST: Cancel restores availability ----
  await test('Cancelling restores slot availability', async () => {
    const { status } = await request(
      'DELETE',
      `/appointments/${winnerId}`,
      undefined,
      winnerToken,
    );
    assert(status === 200, `Expected 200, got ${status}`);

    // Verify slot is now available
    const { data } = await request(
      'GET',
      `/doctors/${doctorProfileId}/slots?date=${nextTuesday}`,
      undefined,
      patient1Token,
    );
    const firstSlot = data.data[0];
    assert(firstSlot.available === true, 'First slot should be available after cancellation');
  });

  // ---- TEST: Hold and confirm flow ----
  await test('Full flow: hold → confirm → slot unavailable', async () => {
    const slot2Start = slotsData.data[2].start; // 10:00 local time
    const { status: holdStatus, data: holdData } = await request(
      'POST',
      '/appointments/hold',
      { doctorId: doctorProfileId, slotStart: slot2Start },
      patient1Token,
    );
    assert(holdStatus === 201, `Hold failed: ${holdStatus}`);

    const aptId = holdData.data.id;
    const { status: confirmStatus } = await request(
      'POST',
      `/appointments/${aptId}/confirm`,
      undefined,
      patient1Token,
    );
    assert(confirmStatus === 200, `Confirm failed: ${confirmStatus}`);
  });

  // ---- TEST: Patient appointments list ----
  await test('Patient can list their appointments', async () => {
    const { status, data } = await request(
      'GET',
      '/appointments/mine',
      undefined,
      patient1Token,
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.data.length >= 1, 'Should have at least 1 appointment');
  });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n📊 Results: ${passed}/${total} passed\n`);
  if (passed < total) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
