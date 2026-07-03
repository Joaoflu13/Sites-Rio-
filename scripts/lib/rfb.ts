// Utilitários compartilhados dos scripts de ingestão da base CNPJ da RFB.
// Os arquivos são CSV latin1, separados por ";", campos entre aspas, SEM header.

import { createReadStream } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse";
import iconv from "iconv-lite";
import unzipper from "unzipper";

/**
 * Client Prisma para scripts: exige a conexão DIRETA (5432). A pooled
 * (6543/pgbouncer) quebra em cargas longas e transações dos scripts.
 */
export function scriptPrisma(): PrismaClient {
  const url = process.env.DIRECT_URL;
  if (!url) {
    console.error("Defina DIRECT_URL no .env (conexão direta, porta 5432).");
    process.exit(1);
  }
  if (url.includes("pgbouncer=true") || url.includes(":6543")) {
    console.error("DIRECT_URL aponta para o pooler (6543/pgbouncer). Use a conexão direta 5432.");
    process.exit(1);
  }
  return new PrismaClient({ datasourceUrl: url });
}

/** Parse simples de argumentos: --chave valor e flags --chave. */
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/**
 * Itera as linhas (arrays de campos) de um zip da RFB, em streaming.
 * `onRow` recebe (campos, númeroDaLinha começando em 1). Retornar `false`
 * interrompe a leitura do arquivo (usado por --limit).
 */
export async function streamRfbZip(
  zipPath: string,
  onRow: (fields: string[], line: number) => Promise<boolean | void> | boolean | void,
  startAfterLine = 0
): Promise<number> {
  const dir = await unzipper.Open.file(zipPath);
  let line = 0;
  for (const entry of dir.files) {
    if (entry.type !== "File") continue;
    const parser = entry
      .stream()
      .pipe(iconv.decodeStream("latin1"))
      .pipe(
        parse({
          delimiter: ";",
          quote: '"',
          relax_column_count: true,
          relax_quotes: true,
          bom: true,
        })
      );
    for await (const record of parser) {
      line++;
      if (line <= startAfterLine) continue; // retomada: pula o que já foi processado
      const keep = await onRow(record as string[], line);
      if (keep === false) {
        parser.destroy();
        return line;
      }
    }
  }
  return line;
}

/** Lista os zips de um prefixo (Estabelecimentos/Empresas), ordenados por nome. */
export async function listZips(dirPath: string, prefix: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(dirPath);
  return names
    .filter((n) => n.toLowerCase().startsWith(prefix.toLowerCase()) && n.toLowerCase().endsWith(".zip"))
    .sort()
    .map((n) => path.join(dirPath, n));
}

/** "20240115" -> Date (ou null). */
export function parseRfbDate(s: string | undefined): Date | null {
  if (!s || s.length !== 8 || s === "00000000") return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return isNaN(date.getTime()) ? null : date;
}

/** Junta DDD+telefone, só dígitos ("21"+"99999-9999" -> "21999999999"). */
export function phone(ddd: string | undefined, num: string | undefined): string {
  const d = (ddd ?? "").replace(/\D/g, "");
  const n = (num ?? "").replace(/\D/g, "");
  return n ? d + n : "";
}

/** Remove sufixos societários da razão social para exibição/busca. */
export function cleanRazao(razao: string): string {
  return razao
    .replace(/\s+(LTDA|EIRELI|EPP|MEI?|S\/?A|S\.A\.?|SOCIEDADE SIMPLES|SS)\.?\s*$/i, "")
    .replace(/\s*[-–]\s*(ME|EPP|MEI)\.?\s*$/i, "")
    .trim();
}

export { createReadStream };
