import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from './client.js';
import { env } from '../config/env.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // Seed admin user (idempotent)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: env.ADMIN_EMAIL },
  });

  if (existingAdmin) {
    console.log(`  ✅ Admin user already exists: ${env.ADMIN_EMAIL}`);
  } else {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    await prisma.user.create({
      data: {
        email: env.ADMIN_EMAIL,
        passwordHash,
        role: Role.ADMIN,
        name: 'System Admin',
      },
    });
    console.log(`  ✅ Admin user created: ${env.ADMIN_EMAIL}`);
  }

  console.log('🌱 Seeding complete.');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
