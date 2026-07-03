// E2E do Sites Rio contra http://localhost:3100 (banco local com 3 fixtures).
import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const ADMIN = { email: "admin@local.test", password: "admin12345" };
let failed = 0;

function check(name, cond) {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failed++;
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
});
const page = await browser.newPage();

// 1. rota protegida redireciona para login
await page.goto(`${BASE}/app/leads`);
await page.waitForURL("**/login**");
check("rota protegida redireciona para /login", page.url().includes("/login"));

// 2. login errado mostra erro
await page.fill("#email", ADMIN.email);
await page.fill("#password", "senha-errada");
await page.click("button[type=submit]");
await page.waitForURL("**/login?error=**");
await page.waitForSelector(".error", { timeout: 10000 });
check("login errado mostra erro", true);

// 3. login certo cai na fila
await page.fill("#email", ADMIN.email);
await page.fill("#password", ADMIN.password);
await page.click("button[type=submit]");
await page.waitForURL("**/app/leads**");
check("login ok cai na fila de prospecção", true);
const cards = await page.locator(".lead-card").count();
check(`fila mostra 3 leads (viu ${cards})`, cards === 3);

// 4. dados completos visíveis (interna: telefone aparece)
const body = await page.textContent("main");
check("telefone visível na fila", body.includes("(21) 2555-0001"));
check("score visível", await page.locator(".score-pill").first().textContent() !== "");

// 5. filtro por bairro
await page.selectOption("#bairro", { label: /Copacabana/.test(body) ? "Copacabana (1)" : "Copacabana (1)" });
await page.click(".filters button[type=submit]");
await page.waitForURL("**bairro=Copacabana**");
check("filtro por bairro devolve 1 card", (await page.locator(".lead-card").count()) === 1);

// 6. marcar contatado tira da fila
await page.click(".lead-card form button");
await page.waitForLoadState("networkidle");
await page.goto(`${BASE}/app/leads?bairro=Copacabana`);
check("apos 'contatado', sai da fila", (await page.locator(".lead-card").count()) === 0);

// 7. pipeline mostra o lead
await page.goto(`${BASE}/app/pipeline`);
const pipeBody = await page.textContent("main");
check("pipeline lista o restaurante", pipeBody.includes("RESTAURANTE SABOR CARIOCA"));

// 8. detalhe: evidências + CRM negociando com nota
await page.click("table.data a");
await page.waitForURL("**/app/leads/**");
const det = await page.textContent("main");
check("detalhe mostra CNPJ", det.includes("22222222000192"));
check("detalhe mostra evidências/verificação", det.includes("Presença web"));
await page.selectOption("#status", "NEGOCIANDO");
await page.fill("#notes", "dona pediu proposta");
await page.click("section.card form button[type=submit]");
await page.waitForLoadState("networkidle");
await page.goto(`${BASE}/app/pipeline?status=NEGOCIANDO`);
const negBody = await page.textContent("main");
check("pipeline NEGOCIANDO tem o lead com nota", negBody.includes("dona pediu proposta"));

// 9. admin: stats e criação de usuário
await page.goto(`${BASE}/admin`);
const adm = await page.textContent("main");
check("admin mostra tiles de stats", adm.includes("Estabelecimentos"));
await page.goto(`${BASE}/admin/usuarios`);
await page.fill("#name", "Vendedor Teste");
await page.fill("#email", "vendedor@local.test");
await page.fill("#password", "vendedor123");
await page.click("section.card form button[type=submit]");
await page.waitForURL("**ok=criado**");
check("admin cria membro", (await page.textContent("table.data")).includes("vendedor@local.test"));

// 10. membro loga e NÃO acessa admin
const page2 = await (await browser.newContext()).newPage();
await page2.goto(`${BASE}/login`);
await page2.fill("#email", "vendedor@local.test");
await page2.fill("#password", "vendedor123");
await page2.click("button[type=submit]");
await page2.waitForURL("**/app/leads**");
check("membro loga", true);
await page2.goto(`${BASE}/admin`);
await page2.waitForURL("**/app/leads**");
check("membro é expulso do /admin", !page2.url().includes("/admin"));

// 11. export CSV (admin, com sessão)
const csvResp = await page.request.get(`${BASE}/api/admin/export?bairro=Gavea`);
const csv = await csvResp.text();
check("export CSV responde 200", csvResp.status() === 200);
check("CSV tem o lead da Gávea com CNPJ", csv.includes("PADARIA ESTRELA DA GÁVEA") && csv.includes("11111111000191"));
check("CSV usa ';' e BOM", csv.charCodeAt(0) === 0xfeff && csv.includes(";"));

await browser.close();
console.log(failed === 0 ? "\nTODOS OS CHECKS PASSARAM" : `\n${failed} CHECK(S) FALHARAM`);
process.exit(failed === 0 ? 0 : 1);
