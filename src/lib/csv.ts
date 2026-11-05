// CSV para Excel-BR: UTF-8 com BOM, separador ";" e neutralização de fórmula.

/** Célula entre aspas; prefixa ' quando começa com =+-@ (anti fórmula-injection, CWE-1236). */
export function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Documento CSV completo (com BOM) a partir de cabeçalho + linhas. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.join(";"), ...rows.map((r) => r.map(csvCell).join(";"))];
  return String.fromCharCode(0xfeff) + lines.join("\r\n") + "\r\n";
}

/** Response de download do CSV. */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
