// Envio de e-mail via Resend (https://resend.com) usando fetch — sem SDK.
// Se RESEND_API_KEY não estiver definido, faz fallback para console.log,
// então o app funciona em dev sem configurar e-mail.

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "Sites Rio <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

type Mail = { to: string; subject: string; html: string };

async function send({ to, subject, html }: Mail): Promise<void> {
  if (!API_KEY) {
    console.log(`[mail:fallback] para=${to} assunto="${subject}" (defina RESEND_API_KEY para enviar de verdade)`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[mail] falha", res.status, await res.text());
    }
  } catch (e) {
    console.error("[mail] erro de rede", e);
  }
}

function shell(title: string, body: string): string {
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
    <h2 style="color:#2563eb">${title}</h2>
    ${body}
    <p style="margin-top:24px"><a href="${APP_URL}" style="color:#2563eb">Abrir o Sites Rio</a></p>
    <p style="font-size:12px;color:#94a3b8">Sites Rio — leads de estabelecimentos sem site no Rio de Janeiro</p>
  </div>`;
}

export async function sendWelcome(to: string, name: string, bonusCredits: number) {
  await send({
    to,
    subject: "Bem-vindo ao Sites Rio 🎉",
    html: shell(
      "Conta criada!",
      `<p>Olá, <strong>${name}</strong>!</p>
       <p>Sua conta está pronta e você ganhou <strong>${bonusCredits} créditos grátis</strong>
       para desbloquear seus primeiros leads.</p>`
    ),
  });
}

export async function sendPasswordReset(to: string, name: string, url: string) {
  await send({
    to,
    subject: "Redefinição de senha — Sites Rio",
    html: shell(
      "Redefinir senha 🔑",
      `<p>Olá, <strong>${name}</strong>!</p>
       <p>Recebemos um pedido para redefinir sua senha. Clique no botão abaixo
       (o link expira em 1 hora):</p>
       <p style="margin:20px 0">
         <a href="${url}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Criar nova senha</a>
       </p>
       <p style="font-size:13px;color:#94a3b8">Se não foi você, ignore este e-mail.</p>`
    ),
  });
}

export async function sendCreditsAdded(to: string, name: string, amount: number, balance: number) {
  await send({
    to,
    subject: "Créditos adicionados — Sites Rio",
    html: shell(
      "Créditos na conta 💰",
      `<p>Olá, <strong>${name}</strong>!</p>
       <p>Adicionamos <strong>${amount} créditos</strong> à sua conta.
       Seu saldo atual é de <strong>${balance} créditos</strong>.</p>`
    ),
  });
}
