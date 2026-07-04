import { execSync, spawn } from 'child_process';

const testFiles = [
  'src/tests/phase1-auth.test.ts',
  'src/tests/phase2-doctors.test.ts',
  'src/tests/phase3-booking.test.ts',
  'src/tests/phase4-symptoms.test.ts',
  'src/tests/phase5-visits.test.ts',
  'src/tests/phase6-notifications.test.ts',
  'src/tests/phase7-leaves.test.ts',
  'src/tests/phase8-meds.test.ts',
  'src/tests/phase9-reliability.test.ts',
];

console.log('🚀 Starting API server in test mode...');
const serverProcess = spawn('npx', ['tsx', 'src/index.ts'], {
  env: { ...process.env, NODE_ENV: 'test', PORT: '3000' },
  shell: true,
  stdio: 'inherit',
});

async function main() {
  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('🚀 Running all acceptance tests sequentially...\n');

  let failedCount = 0;

  for (const file of testFiles) {
    console.log(`----------------------------------------`);
    console.log(`Running: ${file}`);
    console.log(`----------------------------------------`);
    try {
      execSync(`npx tsx ${file}`, { stdio: 'inherit' });
      console.log(`\n✅ Passed: ${file}\n`);
    } catch (err) {
      console.error(`\n❌ Failed: ${file}\n`);
      failedCount++;
    }
  }

  console.log('🛑 Stopping API server...');
  serverProcess.kill();

  console.log(`----------------------------------------`);
  if (failedCount === 0) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } else {
    console.log(`❌ ${failedCount} test suite(s) failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  serverProcess.kill();
  process.exit(1);
});
