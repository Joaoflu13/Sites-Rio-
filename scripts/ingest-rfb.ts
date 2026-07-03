// Ingestão da base de CNPJs da Receita Federal (Dados Abertos CNPJ).
//
// Roda LOCALMENTE (os dumps têm ~12GB zipados; nunca na Vercel), em streaming —
// nenhum arquivo é carregado inteiro em memória. Grava no Postgres via DIRECT_URL.
//
// Baixe os arquivos de https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/
// (pasta do mês) para ./data/<AAAA-MM>/: Estabelecimentos0..9.zip e Empresas0..9.zip.
//
// Uso:
//   npm run ingest -- --dir ./data/2026-06 --ref 2026-06                # fases A+B
//   npm run ingest -- --dir ./data/2026-06 --ref 2026-06 --phase A     # só Estabelecimentos
//   npm run ingest -- ... --limit 5000        # smoke test: para após N aceitos
//   npm run ingest -- ... --resume <runId>    # retoma um run interrompido
//   npm run ingest -- ... --dry-run           # só conta, não grava
//   npm run ingest -- --dir ./data/2026-06 --check-cnaes   # confere códigos vs Cnaes.zip
//
// Fase A (Estabelecimentos): filtra município 6001 (Rio), situação 02 (ativa) e
// CNAE habilitado; insere em lotes de 1000 com skipDuplicates (re-runs são idempotentes).
// Fase B (Empresas): preenche razaoSocial/porte/displayName dos CNPJs já importados.

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  cleanRazao,
  listZips,
  parseArgs,
  parseRfbDate,
  phone,
  scriptPrisma,
  streamRfbZip,
} from "./lib/rfb";
import { bairroDisplay } from "../src/lib/bairros";
import { CNAE_STARTER } from "../src/lib/cnae";

const MUNICIPIO_RIO = "6001"; // código TOM/SIAFI do município do Rio de Janeiro
const SITUACAO_ATIVA = "02";
const BATCH_A = 1000;
const BATCH_B = 500;

// Posições das colunas no layout público da RFB (sem header).
const EST = {
  cnpjBasico: 0,
  cnpjOrdem: 1,
  cnpjDv: 2,
  matrizFilial: 3, // 1=matriz 2=filial
  nomeFantasia: 4,
  situacao: 5,
  inicioAtividade: 10,
  cnaePrincipal: 11,
  tipoLogradouro: 13,
  logradouro: 14,
  numero: 15,
  complemento: 16,
  bairro: 17,
  cep: 18,
  uf: 19,
  municipio: 20,
  ddd1: 21,
  tel1: 22,
  ddd2: 23,
  tel2: 24,
  email: 27,
} as const;

const EMP = { cnpjBasico: 0, razaoSocial: 1, porte: 5 } as const;

type Checkpoint = { file: string; line: number };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = String(args.dir ?? "");
  if (!dir) {
    console.error("Uso: npm run ingest -- --dir ./data/<AAAA-MM> --ref <AAAA-MM> [--phase A|B|all]");
    process.exit(1);
  }

  const prisma = scriptPrisma();

  if (args["check-cnaes"]) {
    await checkCnaes(dir);
    await prisma.$disconnect();
    return;
  }

  const ref = String(args.ref ?? "");
  if (!ref) {
    console.error("Informe --ref <AAAA-MM> (mês do dump, gravado em Business.ingestRef).");
    process.exit(1);
  }
  const phase = String(args.phase ?? "all").toUpperCase();
  const limit = args.limit ? Number(args.limit) : Infinity;
  const dryRun = Boolean(args["dry-run"]);

  // Retomada: recarrega o checkpoint de um run anterior interrompido.
  let checkpoint: Checkpoint | null = null;
  let runId: string | null = null;
  if (args.resume) {
    const prev = await prisma.ingestionRun.findUnique({ where: { id: String(args.resume) } });
    if (!prev) {
      console.error(`Run ${args.resume} não encontrado.`);
      process.exit(1);
    }
    checkpoint = (prev.checkpoint as Checkpoint | null) ?? null;
    runId = prev.id;
    await prisma.ingestionRun.update({ where: { id: prev.id }, data: { status: "RUNNING", error: null } });
    console.log(`Retomando run ${prev.id} a partir de`, checkpoint ?? "(início)");
  }

  const enabled = new Set(
    (await prisma.cnaeCategory.findMany({ where: { enabled: true }, select: { code: true } })).map(
      (c) => c.code
    )
  );
  if (enabled.size === 0) {
    console.error("Nenhuma CnaeCategory habilitada — rode `npm run db:seed` antes.");
    process.exit(1);
  }

  try {
    if (phase === "A" || phase === "ALL") {
      await phaseA(prisma, { dir, ref, enabled, limit, dryRun, checkpoint, runId });
      checkpoint = null; // fase B recomeça do zero
      runId = null;
    }
    if (phase === "B" || phase === "ALL") {
      await phaseB(prisma, { dir, ref, dryRun, checkpoint, runId });
    }
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------- fase A

async function phaseA(
  prisma: PrismaClient,
  opts: {
    dir: string;
    ref: string;
    enabled: Set<string>;
    limit: number;
    dryRun: boolean;
    checkpoint: Checkpoint | null;
    runId: string | null;
  }
) {
  const zips = await listZips(opts.dir, "Estabelecimentos");
  if (zips.length === 0) {
    console.error(`Nenhum Estabelecimentos*.zip em ${opts.dir}`);
    process.exit(1);
  }
  console.log(`[fase A] ${zips.length} arquivo(s):`, zips.map((z) => z.split("/").pop()).join(", "));

  const run = opts.runId
    ? { id: opts.runId }
    : await prisma.ingestionRun.create({
        data: { kind: "RFB_IMPORT", sourceRef: `${opts.ref}:A` },
      });
  if (!opts.runId) console.log(`[fase A] run ${run.id} (use --resume ${run.id} se interromper)`);

  let accepted = 0;
  let processed = 0;
  let buffer: Prisma.BusinessCreateManyInput[] = [];

  const flush = async (file: string, line: number) => {
    if (buffer.length === 0) return;
    if (!opts.dryRun) {
      const res = await prisma.business.createMany({ data: buffer, skipDuplicates: true });
      accepted += res.count;
      await prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          checkpoint: { file, line },
          processedLines: { increment: BigInt(buffer.length) },
          affectedRows: { increment: res.count },
        },
      });
    } else {
      accepted += buffer.length;
    }
    buffer = [];
  };

  for (const zip of zips) {
    const name = zip.split("/").pop()!;
    // Retomada: pula arquivos já concluídos (ordenados por nome).
    if (opts.checkpoint && name < opts.checkpoint.file) {
      console.log(`[fase A] ${name}: já processado, pulando`);
      continue;
    }
    const startAfter = opts.checkpoint && name === opts.checkpoint.file ? opts.checkpoint.line : 0;
    console.log(`[fase A] lendo ${name}${startAfter ? ` (a partir da linha ${startAfter + 1})` : ""}…`);

    await streamRfbZip(
      zip,
      async (f, line) => {
        processed++;
        if (processed % 1_000_000 === 0) {
          console.log(`  … ${(processed / 1e6).toFixed(0)}M linhas lidas, ${accepted + buffer.length} aceitas`);
        }
        // Filtros na ordem mais barata primeiro.
        if (f[EST.municipio] !== MUNICIPIO_RIO) return;
        if (f[EST.situacao] !== SITUACAO_ATIVA) return;
        const cnae = (f[EST.cnaePrincipal] ?? "").replace(/\D/g, "");
        if (!opts.enabled.has(cnae)) return;

        const basico = f[EST.cnpjBasico] ?? "";
        const cnpj = basico + (f[EST.cnpjOrdem] ?? "") + (f[EST.cnpjDv] ?? "");
        if (cnpj.length !== 14) return;

        const fantasia = (f[EST.nomeFantasia] ?? "").trim();
        const street = [f[EST.tipoLogradouro], f[EST.logradouro], f[EST.numero], f[EST.complemento]]
          .map((s) => (s ?? "").trim())
          .filter(Boolean)
          .join(" ");

        buffer.push({
          cnpj,
          cnpjBasico: basico,
          nomeFantasia: fantasia,
          displayName: fantasia, // fase B preenche com a razão social limpa se vazio
          cnaeCode: cnae,
          isMatriz: f[EST.matrizFilial] === "1",
          openedAt: parseRfbDate(f[EST.inicioAtividade]),
          street,
          bairro: bairroDisplay(f[EST.bairro] ?? "") || "(sem bairro)",
          cep: (f[EST.cep] ?? "").replace(/\D/g, ""),
          phone1: phone(f[EST.ddd1], f[EST.tel1]),
          phone2: phone(f[EST.ddd2], f[EST.tel2]),
          email: (f[EST.email] ?? "").trim().toLowerCase(),
          ingestRef: opts.ref,
        });

        if (buffer.length >= BATCH_A) await flush(name, line);
        if (accepted + buffer.length >= opts.limit) return false; // --limit atingido
      },
      startAfter
    );
    await flush(name, Number.MAX_SAFE_INTEGER); // resto do arquivo
    if (accepted >= opts.limit) break;
  }

  if (!opts.dryRun) {
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "DONE", finishedAt: new Date() },
    });
  }
  console.log(
    `[fase A] fim: ${processed.toLocaleString("pt-BR")} linhas lidas, ${accepted.toLocaleString("pt-BR")} estabelecimentos ${opts.dryRun ? "aceitos (dry-run)" : "gravados"}`
  );
}

// ---------------------------------------------------------------- fase B

async function phaseB(
  prisma: PrismaClient,
  opts: { dir: string; ref: string; dryRun: boolean; checkpoint: Checkpoint | null; runId: string | null }
) {
  const zips = await listZips(opts.dir, "Empresas");
  if (zips.length === 0) {
    console.error(`Nenhum Empresas*.zip em ${opts.dir}`);
    process.exit(1);
  }

  // Set dos radicais já importados (fase A) — ~150k strings, cabe folgado em memória.
  const basicos = new Set(
    (
      await prisma.business.findMany({ distinct: ["cnpjBasico"], select: { cnpjBasico: true } })
    ).map((b) => b.cnpjBasico)
  );
  console.log(`[fase B] ${basicos.size.toLocaleString("pt-BR")} radicais de CNPJ a preencher`);
  if (basicos.size === 0) return;

  const run = opts.runId
    ? { id: opts.runId }
    : await prisma.ingestionRun.create({
        data: { kind: "RFB_IMPORT", sourceRef: `${opts.ref}:B` },
      });
  if (!opts.runId) console.log(`[fase B] run ${run.id} (use --resume ${run.id} se interromper)`);

  let updated = 0;
  let buffer: { basico: string; razao: string; razaoClean: string; porte: string }[] = [];

  const flush = async (file: string, line: number) => {
    if (buffer.length === 0) return;
    if (!opts.dryRun) {
      // Um UPDATE ... FROM (VALUES ...) por lote: ~300 statements no total,
      // em vez de um round-trip por linha.
      const values: string[] = [];
      const params: string[] = [];
      buffer.forEach((r, i) => {
        const p = i * 4;
        values.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4})`);
        params.push(r.basico, r.razao, r.razaoClean, r.porte);
      });
      await prisma.$executeRawUnsafe(
        `UPDATE "Business" b
            SET "razaoSocial" = v.razao,
                porte = NULLIF(v.porte, ''),
                "displayName" = CASE WHEN b."nomeFantasia" = '' THEN v."razaoClean" ELSE b."displayName" END,
                "updatedAt" = NOW()
           FROM (VALUES ${values.join(",")}) AS v(basico, razao, "razaoClean", porte)
          WHERE b."cnpjBasico" = v.basico`,
        ...params
      );
      await prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          checkpoint: { file, line },
          processedLines: { increment: BigInt(buffer.length) },
          affectedRows: { increment: buffer.length },
        },
      });
    }
    updated += buffer.length;
    buffer = [];
  };

  let processed = 0;
  for (const zip of zips) {
    const name = zip.split("/").pop()!;
    if (opts.checkpoint && name < opts.checkpoint.file) {
      console.log(`[fase B] ${name}: já processado, pulando`);
      continue;
    }
    const startAfter = opts.checkpoint && name === opts.checkpoint.file ? opts.checkpoint.line : 0;
    console.log(`[fase B] lendo ${name}…`);

    await streamRfbZip(
      zip,
      async (f, line) => {
        processed++;
        if (processed % 1_000_000 === 0) {
          console.log(`  … ${(processed / 1e6).toFixed(0)}M linhas lidas, ${updated + buffer.length} casadas`);
        }
        const basico = f[EMP.cnpjBasico] ?? "";
        if (!basicos.has(basico)) return;
        const razao = (f[EMP.razaoSocial] ?? "").trim();
        buffer.push({
          basico,
          razao,
          razaoClean: cleanRazao(razao),
          porte: (f[EMP.porte] ?? "").trim(),
        });
        if (buffer.length >= BATCH_B) await flush(name, line);
      },
      startAfter
    );
    await flush(name, Number.MAX_SAFE_INTEGER);
  }

  if (!opts.dryRun) {
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "DONE", finishedAt: new Date() },
    });
  }
  console.log(`[fase B] fim: ${updated.toLocaleString("pt-BR")} empresas casadas e atualizadas`);
}

// ---------------------------------------------------------- --check-cnaes

/** Confere os códigos de src/lib/cnae.ts contra o Cnaes.zip do dump. */
async function checkCnaes(dir: string) {
  const zips = await listZips(dir, "Cnaes");
  if (zips.length === 0) {
    console.error(`Cnaes*.zip não encontrado em ${dir} — baixe-o junto com os demais.`);
    process.exit(1);
  }
  const official = new Map<string, string>();
  await streamRfbZip(zips[0], (f) => {
    official.set((f[0] ?? "").replace(/\D/g, ""), f[1] ?? "");
  });
  console.log(`Cnaes.zip: ${official.size} códigos oficiais.`);
  let bad = 0;
  for (const c of CNAE_STARTER) {
    const label = official.get(c.code);
    if (!label) {
      console.error(`  ✗ ${c.code} (${c.label}) NÃO existe na tabela oficial`);
      bad++;
    } else {
      console.log(`  ✓ ${c.code} = ${label}`);
    }
  }
  console.log(bad === 0 ? "Todos os códigos conferem." : `${bad} código(s) inválido(s) — corrija src/lib/cnae.ts.`);
  if (bad > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
