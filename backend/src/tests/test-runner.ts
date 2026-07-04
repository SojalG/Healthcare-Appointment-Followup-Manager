export function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

export async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (err: any) {
    console.error(`  ❌ ${name}: ${err.message}`);
    throw err;
  }
}
