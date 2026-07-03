# Sites Rio

Ferramenta **interna** de prospecção: encontra estabelecimentos da cidade do Rio de Janeiro
**sem site próprio** (ou com presença web fraca) a partir dos Dados Abertos CNPJ da Receita
Federal, e organiza a venda de **criação de site + mensalidade** num CRM simples.

**Modelo de negócio:** o cliente é o dono do estabelecimento. O sistema é usado só pela
equipe de vendas (sem auto-cadastro; o admin cria as contas).

## Stack

Next.js 15 (App Router) · TypeScript · Prisma 6 · PostgreSQL (Supabase) · NextAuth v5
(credenciais, login por e-mail) · bcryptjs · vitest · Playwright (e2e). Mesmo padrão do
projeto playa-quadra: app usa a URL **pooled** (6543/pgbouncer), scripts/migrações usam a
**direta** (5432).

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha (ver seção Variáveis)
npx prisma generate
npm run db:push        # aplica o schema
npm run db:seed        # admin (SEED_ADMIN_*) + 36 categorias CNAE
npm run dev            # http://localhost:3000
```

## Variáveis (.env)

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Postgres pooled (Supabase 6543, `?pgbouncer=true`) — usado pelo app |
| `DIRECT_URL` | Postgres direto (5432) — `db:push`, seed e scripts de ingestão |
| `AUTH_SECRET`, `AUTH_TRUST_HOST` | Sessão NextAuth (`AUTH_TRUST_HOST=true` na Vercel) |
| `APP_URL` | URL pública (links de e-mail) |
| `SEED_ADMIN_EMAIL/PASSWORD` | Conta admin criada pelo seed |
| `FINDER_PROVIDER` | `serper` (recomendado), `google-cse` ou `fake` (testes) |
| `SERPER_API_KEY` ou `GOOGLE_CSE_KEY`+`GOOGLE_CSE_CX` | Chave da API de busca do enriquecimento |
| `RESEND_API_KEY`, `EMAIL_FROM` | E-mail (opcional; sem chave, loga no console) |

## Pipeline de dados (roda na SUA máquina, não na Vercel)

1. **Baixar o dump mensal** em
   `https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/<AAAA-MM>/`:
   `Estabelecimentos0..9.zip`, `Empresas0..9.zip` e `Cnaes.zip` → salve em `./data/<AAAA-MM>/`
   (~12 GB; a pasta `data/` é ignorada pelo git).
2. **Conferir os códigos CNAE** (uma vez por dump):
   `npm run ingest -- --dir ./data/2026-06 --check-cnaes`
3. **Smoke test**: `npm run ingest -- --dir ./data/2026-06 --ref 2026-06 --limit 5000`
4. **Ingestão completa** (2–4h, ~100–180 mil estabelecimentos do Rio):
   `npm run ingest -- --dir ./data/2026-06 --ref 2026-06`
   — se interromper, retome com `--resume <runId>` (o id aparece no início do run).
5. **Enriquecimento** (descobre quem tem/não tem site; começa pelos leads de maior valor):
   `npm run enrich -- --max 500` — retomável por construção; rode em lotes conforme o
   orçamento da API (Serper: 2.500 buscas grátis, depois ~US$1/1k).
6. **Acompanhar**: `npm run stats` (contagens + tamanho do banco; alerta acima de 250 mil
   linhas — desligue categorias com `CnaeCategory.enabled=false` e reimporte se precisar).
7. Mudou pesos/fórmula? `npm run rescore` recalcula sem gastar API.

## Deploy (Vercel + Supabase)

1. Crie um projeto no Supabase (free) e copie as duas connection strings (pooled e direta).
2. `npm run db:push && npm run db:seed` apontando para o Supabase (via `.env`).
3. Importe este repositório na Vercel e defina as variáveis de ambiente (tabela acima).
4. Rode a ingestão/enriquecimento da sua máquina apontando `DIRECT_URL` para o Supabase.

> Supabase free “pausa” após ~1 semana sem uso e tem limite de 500 MB — o guardrail do
> `stats.ts` e a lista de CNAEs mantêm o banco em ~120–160 MB.

## Testes

- `npm test` — unitários (classificação de presença web e score).
- `node scripts/e2e.mjs` — e2e Playwright contra `localhost:3100` (suba com
  `npm run build && npm run start -- -p 3100`; requer banco com o seed + fixtures de
  `npm run ingest -- --dir ./data/test --ref test-01` e `npm run enrich -- --provider fake --max 10`).

## LGPD

Só dados **públicos de pessoa jurídica** (registro CNPJ da RFB: razão social, endereço,
telefone/e-mail cadastrais) + URLs públicas encontradas em busca. Uso: prospecção B2B.
Pedidos de remoção: exclua o registro e anote o CNPJ para não reimportar.
