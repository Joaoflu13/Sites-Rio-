// Seed: cria/atualiza o admin (via SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD) e as
// categorias CNAE iniciais. Idempotente — pode rodar mais de uma vez.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CNAE_STARTER } from "../src/lib/cnae";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no .env antes de rodar o seed.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { email, name: "Admin", passwordHash, role: "ADMIN" },
  });
  console.log(`[seed] admin ok: ${email}`);

  for (const c of CNAE_STARTER) {
    await prisma.cnaeCategory.upsert({
      where: { code: c.code },
      update: { label: c.label, group: c.group, valueWeight: c.valueWeight },
      create: { code: c.code, label: c.label, group: c.group, valueWeight: c.valueWeight },
    });
  }
  console.log(`[seed] ${CNAE_STARTER.length} categorias CNAE ok`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
