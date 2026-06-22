// Seed de développement — données anonymisées génériques
// Ne jamais committer de vraies données clients (ASSAD BENOIT, etc.)
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

// Hashage simple pour le seed — en prod, bcrypt est utilisé dans auth.ts
function hashPassword(password: string): string {
  // NOTE: utiliser bcrypt en prod — ce hash minimal est pour le seed uniquement
  return createHash("sha256").update(password + "eoda_seed_salt").digest("hex");
}

async function main() {
  console.log("Seeding database...");

  // Tenant Cabinet EODA
  const tenant = await prisma.tenant.upsert({
    where: { id: "tenant-eoda-conseil" },
    update: {},
    create: {
      id: "tenant-eoda-conseil",
      name: "EODA Conseil",
    },
  });

  // Utilisateur Cabinet Admin (test)
  await prisma.user.upsert({
    where: { email: "cabinet@eoda-test.local" },
    update: {},
    create: {
      email: "cabinet@eoda-test.local",
      name: "Admin Cabinet (test)",
      passwordHash: hashPassword("Test1234!"),
      role: "CABINET_ADMIN",
      tenantId: tenant.id,
    },
  });

  // Utilisateur Client (test)
  await prisma.user.upsert({
    where: { email: "client@eoda-test.local" },
    update: {},
    create: {
      email: "client@eoda-test.local",
      name: "Utilisateur Client (test)",
      passwordHash: hashPassword("Test1234!"),
      role: "CLIENT_USER",
      tenantId: null,
    },
  });

  console.log("Seed completed.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
