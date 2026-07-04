/**
 * Phase 1 — Auth & Roles Acceptance Test
 *
 * Tests:
 * 1. Register a patient → 201
 * 2. Login → 200 + tokens
 * 3. Access protected route with token → 200
 * 4. Access admin route as patient → 403
 * 5. Login as seeded admin → 200
 * 6. Access admin route as admin → 200
 * 7. Register duplicate email → 409
 * 8. Invalid token → 401
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
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
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
  console.log('\n🧪 Phase 1 — Auth & Roles Acceptance Tests\n');

  let patientToken = '';
  let adminToken = '';

  // Test 1: Register patient
  await test('Register a new patient', async () => {
    const { status, data } = await request('POST', '/auth/register', {
      email: `test-patient-${Date.now()}@test.com`,
      password: 'TestPass123',
      name: 'Test Patient',
    });
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    const d = data as { data: { accessToken: string } };
    patientToken = d.data.accessToken;
    assert(!!patientToken, 'No access token returned');
  });

  // Test 2: Login
  const loginEmail = `test-login-${Date.now()}@test.com`;
  await test('Login with registered patient', async () => {
    // Register first
    await request('POST', '/auth/register', {
      email: loginEmail,
      password: 'TestPass123',
      name: 'Login Test',
    });

    const { status, data } = await request('POST', '/auth/login', {
      email: loginEmail,
      password: 'TestPass123',
    });
    assert(status === 200, `Expected 200, got ${status}`);
    const d = data as { data: { accessToken: string; refreshToken: string } };
    assert(!!d.data.accessToken, 'No access token');
    assert(!!d.data.refreshToken, 'No refresh token');
  });

  // Test 3: Protected route with valid token
  await test('Access protected route (GET /auth/profile)', async () => {
    const { status, data } = await request('GET', '/auth/profile', undefined, patientToken);
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  });

  // Test 4: Admin route as patient → 403
  await test('Patient cannot access admin routes (403)', async () => {
    const { status } = await request('GET', '/admin/doctors', undefined, patientToken);
    assert(status === 403, `Expected 403, got ${status}`);
  });

  // Test 5: Login as admin
  await test('Login as seeded admin', async () => {
    const { status, data } = await request('POST', '/auth/login', {
      email: 'admin@healthcare.local',
      password: 'Admin123!',
    });
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    const d = data as { data: { accessToken: string; user: { role: string } } };
    adminToken = d.data.accessToken;
    assert(d.data.user.role === 'ADMIN', `Expected role ADMIN, got ${d.data.user.role}`);
  });

  // Test 6: Admin route as admin → 200
  await test('Admin can access admin routes (200)', async () => {
    const { status } = await request('GET', '/admin/doctors', undefined, adminToken);
    assert(status === 200, `Expected 200, got ${status}`);
  });

  // Test 7: Duplicate email → 409
  await test('Duplicate registration returns 409', async () => {
    const email = `dup-${Date.now()}@test.com`;
    await request('POST', '/auth/register', {
      email,
      password: 'TestPass123',
      name: 'First',
    });
    const { status } = await request('POST', '/auth/register', {
      email,
      password: 'TestPass123',
      name: 'Second',
    });
    assert(status === 409, `Expected 409, got ${status}`);
  });

  // Test 8: Invalid token → 401
  await test('Invalid token returns 401', async () => {
    const { status } = await request('GET', '/auth/profile', undefined, 'invalid-token');
    assert(status === 401, `Expected 401, got ${status}`);
  });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n📊 Results: ${passed}/${total} passed\n`);

  if (passed < total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
