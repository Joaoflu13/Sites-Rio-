// Como o assistente se apresenta. Separado de mailer.ts para páginas (ex.: a
// demo) não carregarem as bibliotecas de SMTP/IMAP só por causa do nome.

export function sdrOwnerName(): string {
  return process.env.SDR_OWNER_NAME || "João";
}

export function sdrFromName(): string {
  return process.env.SDR_FROM_NAME || `Assistente virtual do ${sdrOwnerName()} (Sites Rio)`;
}
