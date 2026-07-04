/**
 * Phase 2 — Doctor & Slot Management Acceptance Test
 *
 * Tests:
 * 1. Admin creates a doctor with working hours (9am-5pm Mon-Fri, 30min slots)
 * 2. Query slots for a weekday → get 16 available slots
 * 3. Query slots for a non-working day → get 0 slots
 * 4. List all doctors → includes the created doctor
 * 5. Update doctor specialisation
 * 6. Search doctors by specialisation
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

async function run() {
  console.log('\n🧪 Phase 2 — Doctor & Slot Management Acceptance Tests\n');

  // Login as admin
  const { data: adminLogin } = await request('POST', '/auth/login', {
    email: 'admin@healthcare.local',
    password: 'Admin123!',
  });
  const adminToken = adminLogin.data.accessToken;

  // Also register a patient for search/slot queries
  const patientEmail = `patient-phase2-${Date.now()}@test.com`;
  const { data: patientReg } = await request('POST', '/auth/register', {
    email: patientEmail,
    password: 'TestPass123',
    name: 'Phase 2 Patient',
  });
  const patientToken = patientReg.data.accessToken;

  let doctorProfileId = '';

  // Find next Monday (a weekday)
  function getNextWeekday(dayOfWeek: number): string {
    const d = new Date();
    d.setDate(d.getDate() + ((dayOfWeek + 7 - d.getDay()) % 7 || 7));
    return d.toISOString().split('T')[0];
  }

  // Find next Sunday
  function getNextSunday(): string {
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    return d.toISOString().split('T')[0];
  }

  const nextMonday = getNextWeekday(1); // Monday = 1
  const nextSunday = getNextSunday();

  // Test 1: Admin creates a doctor
  await test('Admin creates a doctor (9am-5pm Mon-Fri, 30min slots)', async () => {
    const { status, data } = await request(
      'POST',
      '/admin/doctors',
      {
        email: `doctor-phase2-${Date.now()}@test.com`,
        password: 'DoctorPass123',
        name: 'Dr. Smith',
        specialisation: 'Cardiology',
        slotDurationMin: 30,
        workingHours: [
          { weekday: 1, startTime: '09:00', endTime: '17:00' }, // Monday
          { weekday: 2, startTime: '09:00', endTime: '17:00' }, // Tuesday
          { weekday: 3, startTime: '09:00', endTime: '17:00' }, // Wednesday
          { weekday: 4, startTime: '09:00', endTime: '17:00' }, // Thursday
          { weekday: 5, startTime: '09:00', endTime: '17:00' }, // Friday
        ],
      },
      adminToken,
    );
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    doctorProfileId = data.data.doctorProfile.id;
    assert(!!doctorProfileId, 'No doctor profile ID');
    assert(data.data.doctorProfile.specialisation === 'Cardiology', 'Specialisation mismatch');
  });

  // Test 2: Query slots for a working day → 16 slots (8h / 30min = 16)
  await test(`Query slots for Monday (${nextMonday}) → 16 available slots`, async () => {
    const { status, data } = await request(
      'GET',
      `/doctors/${doctorProfileId}/slots?date=${nextMonday}`,
      undefined,
      patientToken,
    );
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    const slots = data.data;
    assert(slots.length === 16, `Expected 16 slots, got ${slots.length}`);
    const available = slots.filter((s: any) => s.available);
    assert(available.length === 16, `Expected 16 available, got ${available.length}`);
  });

  // Test 3: Query slots for Sunday → 0 slots (not a working day)
  await test(`Query slots for Sunday (${nextSunday}) → 0 slots`, async () => {
    const { status, data } = await request(
      'GET',
      `/doctors/${doctorProfileId}/slots?date=${nextSunday}`,
      undefined,
      patientToken,
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.data.length === 0, `Expected 0 slots, got ${data.data.length}`);
  });

  // Test 4: List all doctors
  await test('List all doctors → includes created doctor', async () => {
    const { status, data } = await request('GET', '/admin/doctors', undefined, adminToken);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.data.length >= 1, 'Should have at least 1 doctor');
    const found = data.data.find(
      (d: any) => d.doctorProfile?.id === doctorProfileId,
    );
    assert(!!found, 'Created doctor not found in list');
  });

  // Test 5: Update doctor specialisation
  await test('Update doctor specialisation', async () => {
    const { status, data } = await request(
      'PUT',
      `/admin/doctors/${doctorProfileId}`,
      { specialisation: 'Interventional Cardiology' },
      adminToken,
    );
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(
      data.data.specialisation === 'Interventional Cardiology',
      `Expected 'Interventional Cardiology', got '${data.data.specialisation}'`,
    );
  });

  // Test 6: Search doctors by specialisation
  await test('Search doctors by specialisation (case-insensitive)', async () => {
    const { status, data } = await request(
      'GET',
      '/doctors?specialisation=cardiology',
      undefined,
      patientToken,
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.data.length >= 1, 'Should find at least 1 doctor');
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
