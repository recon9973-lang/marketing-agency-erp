import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.count();
  await prisma.$disconnect();

  if (users > 0) {
    console.log(`Seed skipped: ${users} users already present.`);
    return;
  }

  await import("./seed");
}

run().catch((error) => {
  console.error("Failed to check seed state", error);
  process.exitCode = 1;
});
