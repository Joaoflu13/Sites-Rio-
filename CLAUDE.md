# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

**Sites Rio** — ferramenta interna de prospecção do dono (Joaoflu13): encontra estabelecimentos
do Rio de Janeiro **sem site próprio** a partir dos Dados Abertos CNPJ da Receita Federal e
vende a eles **site + mensalidade (R$497 + R$79/mês)**. Todo lead ganha automaticamente um
site de demonstração em `/s/[slug]`. Só a equipe de vendas loga (sem auto-cadastro).

- **Produção:** https://sites-rio.vercel.app (Vercel, deploy automático no push da `main`)
- **Repo GitHub:** `Joaoflu13/Sites-Rio-` (atenção: hífen no FINAL do nome)
- **Banco:** Supabase Postgres (~104 mil estabelecimentos ingeridos; limite free 500MB)

## Comandos

```bash
npm run dev                # dev server
npm run build              # prisma generate && next build
npm test                   # vitest (src/**/*.test.ts)
npx vitest run src/lib/classify.test.ts   # um teste só
npm run db:push            # aplica schema (usa DIRECT_URL)
npm run db:seed            # admin (SEED_ADMIN_*) + 36 categorias CNAE — idempotente

# Pipeline de dados (rodam LOCALMENTE, nunca na Vercel; exigem DIRECT_URL):
npm run ingest -- --dir ./data/<AAAA-MM> --ref <AAAA-MM> [--phase A|B] [--limit N] [--resume <runId>] [--check-cnaes]
npm run enrich -- [--max N] [--provider serper|google-cse|fake] [--bairro X] [--group HEALTH]
npm run rescore            # recalcula scores sem gastar API
npm run stats              # contagens + tamanho do banco (guardrail 500MB)

# E2E (Playwright): requer build + servidor na 3100 + banco com fixtures:
#   npm run ingest -- --dir ./data/test --ref test-01 && npm run enrich -- --provider fake --max 10
npm run build && npm run start -- -p 3100 &
node scripts/e2e.mjs       # PW_CHROMIUM=<path do chromium> se necessário
```

## Arquitetura (o essencial)

Três subsistemas sobre um único Postgres:

1. **Pipeline de dados** (`scripts/*.ts`, tsx, streaming): `ingest-rfb.ts` lê os zips mensais
   da RFB (latin1, `;`, sem header) — fase A filtra município `6001` (Rio) + situação `02` +
   CNAEs habilitados (`CnaeCategory.enabled`) e insere com `createMany skipDuplicates`
   (re-runs idempotentes; checkpoint em `IngestionRun` p/ `--resume`); fase B casa razão
   social/porte via `UPDATE...FROM (VALUES)` em lote. `enrich.ts` busca cada negócio numa
   API de busca plugável (`src/lib/finder/`), classifica presença web (`src/lib/classify.ts`,
   função pura: listas de diretórios/social/agregadores + similaridade de nome contra
   homônimos) e calcula score 0–100 (`src/lib/score.ts` + tiers de bairro em
   `src/lib/bairros.ts`). Fila do enrich = `presenceCheckedAt IS NULL` (retomável por
   construção; item só é carimbado no update do resultado).

2. **CRM interno** (`src/app/app/*`, guard `requireUser` no layout): fila de prospecção
   (`/app/leads`, negócios SEM `Prospection`), detalhe com evidências da busca, pipeline por
   status (`/app/pipeline`). `Prospection` é 1-por-Business (`businessId @unique`),
   compartilhado pela equipe; status NOVO remove a linha (volta pra fila).

3. **Fábrica de sites** (`src/app/s/[slug]/page.tsx`): renderiza o site do estabelecimento
   sob demanda — nada é gerado/deployado por site. Slug determinístico
   `slugify(nome)-<6 últimos dígitos do cnpj>` (`src/lib/slug.ts`); temas por grupo CNAE em
   `src/lib/themes.ts` (gradientes CSS, sem imagens externas). `DemoSite` (lazy, 1-por-Business)
   guarda personalização pós-venda; `published=true` remove a faixa de oferta e o `noindex`.
   Edição em `/admin/sites`.

**Convenções herdadas do projeto irmão playa-quadra:** NextAuth v5 credentials com sessão JWT
(`src/lib/auth.ts`, roles ADMIN|MEMBER injetadas no token); guards em `src/lib/admin.ts`
chamados na página E no topo de TODA server action (`actions.ts` co-locados por rota);
rate-limit de login persistido no Postgres (`src/lib/rateLimit.ts`); e-mail via Resend com
fallback para console (`src/lib/mail.ts`); Prisma com URL dupla — app usa `DATABASE_URL`
pooled (6543/pgbouncer), scripts/migrações usam `DIRECT_URL` (5432); `scriptPrisma()` em
`scripts/lib/rfb.ts` recusa a pooled de propósito.

## Regras importantes

- **LGPD:** só dados públicos de PJ (registro CNPJ da RFB). O export CSV e as telas internas
  mostram tudo (ferramenta interna); o site público `/s/` mostra o que um site de verdade
  mostraria. Não armazenar dados de pessoa física.
- **CSV export** (`/api/admin/export`): UTF-8 com BOM + `;` (Excel-BR) e neutralização de
  fórmula (prefixo `'` quando a célula começa com `=+-@`); manter os dois ao mexer.
- **Custo do enrich:** cada busca custa dinheiro (Serper ~US$1/1k). Nunca re-buscar item já
  carimbado; respeitar a fila por `presenceCheckedAt IS NULL`.
- **Supabase free:** 500MB e pausa após ~1 semana inativo. `stats.ts` alerta acima de 250 mil
  linhas — a válvula é desabilitar CNAEs de menor `valueWeight` e reimportar.

## Contexto operacional (dono não-técnico)

O dono opera por PowerShell no Windows seguindo instruções passo a passo. O fluxo de sync
usado até aqui: Claude gera `git bundle` → dono baixa → `git fetch <bundle> <branch> &&
git merge --ff-only FETCH_HEAD && git push origin HEAD:main` na pasta `Downloads\sites-rio`.
Mudou o schema? Lembrar o dono de rodar `npm run db:push`. Env novo? Lembrar de adicionar na
Vercel (Settings → Environment Variables) e redeployar. Variáveis: ver `.env.example`
(`SALES_WHATSAPP` alimenta o botão da faixa de demo).
