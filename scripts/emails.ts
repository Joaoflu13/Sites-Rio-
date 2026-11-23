// Raio-X dos e-mails da base para prospecção (mesmo cálculo de /admin/emails)
// + CSV dos prováveis contadores (parceiros) em ./data/.
// Uso: npm run emails

import { mkdirSync, writeFileSync } from "node:fs";
import { scriptPrisma } from "./lib/rfb";
import { ACCOUNTANT_CSV_HEADER, ACCOUNTANT_MIN_BUSINESSES, accountantRows, emailDiagnostics } from "../src/lib/emails";
import { toCsv } from "../src/lib/csv";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");

async function main() {
  const prisma = scriptPrisma();
  const d = await emailDiagnostics(prisma);

  console.log("\n=== E-mails da base ===");
  console.log(`Estabelecimentos:                 ${fmt(d.total)}`);
  console.log(`Com e-mail:                       ${fmt(d.withEmail)} (${pct(d.withEmail, d.total)})`);
  console.log(`E-mails distintos:                ${fmt(d.distinctEmails)}`);
  console.log(
    `Prováveis contadores (${ACCOUNTANT_MIN_BUSINESSES}+ CNPJs): ${fmt(d.accountantEmails)} e-mails → ` +
      `${fmt(d.businessesWithAccountantEmail)} estabelecimentos (${pct(d.businessesWithAccountantEmail, d.withEmail)} dos com e-mail)`
  );
  console.log(`Supressão / opt-out:              ${fmt(d.suppressed)} / ${fmt(d.optedOut)}`);
  console.log(`\nALCANÇÁVEIS (e-mail próprio, fora do CRM): ${fmt(d.reachable)}`);
  console.log(`  …e sem site próprio:            ${fmt(d.reachableSellable)}`);
  console.log(`  …com Gmail/Hotmail/etc.:        ${fmt(d.reachableFreeMail)} (${pct(d.reachableFreeMail, d.reachable)})`);

  if (d.topAccountants.length) {
    console.log("\nTop 10 prováveis contadores:");
    for (const a of d.topAccountants.slice(0, 10)) console.log(`  ${String(a.count).padStart(5)}  ${a.email}`);
    mkdirSync("data", { recursive: true });
    const file = `data/contadores-${new Date().toISOString().slice(0, 10)}.csv`;
    writeFileSync(file, toCsv(ACCOUNTANT_CSV_HEADER, await accountantRows(prisma)));
    console.log(`\nLista completa de contadores: ${file}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
