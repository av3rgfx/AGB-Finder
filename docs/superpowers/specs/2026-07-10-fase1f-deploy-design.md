# Design — Fase 1f: Deploy staging (Vercel + Neon + Upstash)

**Data:** 2026-07-10
**Stato:** approvato (brainstorming) — pronto per writing-plans
**Fase:** 1f — chiude la Fase 1 (MVP Gestionale) portando l'app su infrastruttura reale

## Contesto e obiettivo

Le fasi 1a→1e + gestione API key admin sono complete e in `main` (Next.js 15
App Router, tRPC v11, Prisma 6 + Neon/pgvector, Better Auth, Redis per
rate-limit/breaker/version-stamp key, provider Gemini). Manca il deploy su
infrastruttura reale e l'embedding del catalogo (6.191 prodotti) su un DB
durevole.

**Obiettivo:** portare l'app completa live come **staging promuovibile a
produzione** — Vercel (build+serve) · Neon (Postgres/pgvector, progetto già
creato in `eu-west-2`) · Upstash (Redis). URL `*.vercel.app`. Nessun lancio
formale agli agenti in questa fase: si valida lo stack reale end-to-end.

**Definizione di "fatto":** sullo staging deployato funzionano login reale,
catalogo importato (6.191), chat AI con tool-use, generazione kit, e **ricerca
ibrida con embedding veri** — tutti verificati sul dominio deployato.

## Vincolo infrastrutturale che motiva l'architettura

La dev-container di Claude Code sul web **filtra la porta Postgres 5432** (solo
HTTPS/443 passa): la pipeline standard Prisma non raggiunge Neon da lì. Le
operazioni DB (migrate/import/seed/embed) devono quindi girare da una **rete a
egress aperto** verso Neon:5432. Scelta (verdetto LLM Council 2026-07-10):
**GitHub Actions** come pipeline ops del deploy — è il posto giusto e non un
anticipo prematuro (girare la pipeline *standard* da un runner aperto, senza
codice glue).

## Decisioni fissate (brainstorming 2026-07-10)

1. **Scope = staging su infra reale**, non lancio in produzione. Promuovibile.
2. **Upstash Redis provisionato ora** (free tier); `ioredis` usa l'URL `rediss://`
   senza modifiche al codice. Abilita rate-limit AI, circuit breaker, invalidazione
   version-stamp delle key.
3. **Billing Gemini attivo** → l'embedding dei 6.191 gira intero in un colpo come
   step finale della pipeline ops.
4. **Operazioni DB via GitHub Actions** (`workflow_dispatch`): un unico workflow
   ops, ripetibile e auditabile.
5. **Vercel Hobby (gratis) + `maxDuration = 60`** per lo staging. Il `maxDuration=120`
   attuale eccede il cap Hobby (60s); con billing attivo i 429 del free-tier
   spariscono e una chat normale risponde in 2–5s → 60s bastano. **Pro rimandato al
   lancio produzione** (termini commerciali, headroom 300s, deployment protection).
6. **CI test minimale**: workflow che gira `pnpm test` (Vitest) su PR verso `main`
   — l'unico gate che il build Vercel non copre (Vercel già fa typecheck+lint+build).

## Architettura & data flow

```
Utente ─► https://catalogo-finder.vercel.app  (Next.js su Vercel: build + serve, runtime dinamico)
             │  tRPC / Better Auth
             ├─► Neon    (DATABASE_URL pooled pgbouncer=true; DIRECT_URL per le migrazioni)
             └─► Upstash (rediss:// via ioredis: rate-limit, breaker, version-stamp key)
                    ▲
GitHub Actions "ops" (runner ubuntu, egress aperto → raggiunge Neon:5432)
   workflow_dispatch ─► migrate deploy ─► import:agb ─► db:seed (+seed:kit) ─► embed:products
```

Il **build Vercel non si connette al DB**: le pagine dashboard sono dinamiche
dietro auth, e `src/env.ts` valida solo il *formato* delle variabili (non apre
connessioni). Tutte le operazioni sul DB vivono nel workflow ops.

## §1 — Env & segreti (due store distinti)

**Vercel (Production env vars, runtime):**
`DATABASE_URL` (Neon pooled, `?sslmode=require&pgbouncer=true`) · `DIRECT_URL`
(Neon diretto, host senza `-pooler`) · `REDIS_URL` (Upstash `rediss://`) ·
`NEXTAUTH_URL` (= URL Vercel prod, `https://catalogo-finder.vercel.app`) ·
`NEXTAUTH_SECRET` · `IP_HASH_SECRET` · `SETTINGS_ENCRYPTION_KEY` ·
`GEMINI_API_KEY` (o gestita a runtime da `/impostazioni`) · `GEMINI_MODEL`.

**GitHub Actions secrets (ops):** `DIRECT_URL`, `DATABASE_URL`, `GEMINI_API_KEY`,
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, più valori *placeholder* per le var che
`src/env.ts` richiede se importato dagli script (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
`IP_HASH_SECRET`, `REDIS_URL`) — gli script ops non aprono Redis né auth.

**`SETTINGS_ENCRYPTION_KEY`:** generata una volta (`openssl rand -base64 32`),
**distinta per ambiente**, mai loggata, salvata in un password manager. È l'unico
single-point-of-failure per i valori cifrati in `Settings`: perderla = key AI
cifrate irrecuperabili.

**Nessun segreto nel repo.** `.env` resta git-ignored; su Vercel/GitHub si usano
i rispettivi secret store.

## §2 — Pipeline ops (GitHub Actions)

File **`.github/workflows/ops-neon.yml`**, trigger **`workflow_dispatch`**
(manuale — niente auto-run su push, per evitare import/embed accidentali). Input
opzionale `listino_url` (default = link registrato in `CLAUDE.md`) così l'utente
controlla il PDF al dispatch (coerente con la regola "file esterni": il link lo
fornisce l'utente, non lo si cerca sul web). *Fallback se il link Drive desse
problemi:* caricare il PDF una volta come **GitHub Release asset** e scaricarlo da
lì (deciso: si parte con il download da link). Step su `ubuntu-latest`:

1. checkout · setup Node 22 · corepack `pnpm@10` · `pnpm install --frozen-lockfile`
2. `apt-get install -y poppler-utils` · `pnpm exec prisma generate` (engine
   scaricati normalmente: runner a egress aperto, **niente** `setup-prisma-engines.sh`)
3. `curl` del listino PDF da `listino_url` → file locale; **fail-fast** se non è un PDF valido
4. `pnpm exec prisma migrate deploy` (Neon via `DIRECT_URL`) → schema +
   estensioni `vector`/`pg_trgm` (la migrazione `init` fa già `CREATE EXTENSION IF NOT EXISTS`)
5. `pnpm import:agb <pdf>` (idempotente, upsert) → 6.191 prodotti
6. `pnpm db:seed` (admin da `SEED_ADMIN_*`) + `pnpm db:seed:kit` (template kit ARTECH)
7. `pnpm embed:products` (idempotente su `WHERE embedding IS NULL`, batch 50; con
   billing attivo gira per intero)

Ogni step è **idempotente** → il workflow è ri-eseguibile senza danni (re-import
o re-embed dopo aggiornamenti listino). **Connessioni nel job ops:** essendo un
batch one-shot (non serverless), il job punta `DATABASE_URL` alla connessione
**diretta** (host senza `-pooler`, niente `pgbouncer`) — il Prisma *client*
(usato da `import:agb`/`embed:products`) legge `DATABASE_URL`, quindi così evita
del tutto il pooler per il batch lungo; `migrate deploy` usa comunque `DIRECT_URL`.
La `DATABASE_URL` pooled `pgbouncer=true` resta invece quella del runtime Vercel (§1).

## §3 — Config app per produzione

- **Better Auth:** `baseURL = env.NEXTAUTH_URL` → impostare `NEXTAUTH_URL` all'URL
  Vercel prod perché i cookie siano `Secure` e i redirect corretti (https).
  Staging same-origin → basta `baseURL`; `trustedOrigins` solo se in futuro servisse.
- **`maxDuration`:** portare `src/app/api/trpc/[trpc]/route.ts` da **120 → 60**
  (cap Hobby). Commento aggiornato. Al passaggio a Pro si rialza (300).
- **Upstash su Vercel:** `ioredis` con `rediss://` funziona (egress Vercel aperto);
  `lazyConnect` già impostato → nessuna connessione al build.
- **Neon free tier:** 0.5 GB (catalogo + vettori ≈ decine di MB, ampiamente dentro);
  "scale to zero" → primo accesso dopo inattività ha un cold-start (accettabile in staging).

## §4 — CI test (workflow separato)

File **`.github/workflows/ci.yml`**, su `pull_request` verso `main` (e push a `main`):
setup Node/pnpm → `pnpm install --frozen-lockfile` → `pnpm test` (Vitest). È
l'unico gate non coperto dal build Vercel (che già esegue typecheck + ESLint +
build). Nessun accesso al DB: i test usano fake/mocks (i test di integrazione
gated su `INTEGRATION_DATABASE_URL` restano esclusi).

## §5 — Verifica (definition of done)

Sullo staging deployato, in sequenza:
1. login admin (seed) → `/impostazioni`: testa e salva una key AI (cifratura + audit)
2. admin crea un agente → logout → login agente
3. `/archivio`: ricerca testuale **e ibrida** (embedding reali) → risultati coerenti,
   codici in mono
4. `/assistente`: chat con tool-use (ricerca prodotti) entro i 60s
5. `/richieste/nuova`: genera un kit ARTECH → distinta con prezzi
6. `/dashboard`: KPI reali + ultime richieste
7. Conteggi a DB: **6.191 prodotti** e **6.191 embedding** presenti su Neon

## Sicurezza — note

- Due secret store (Vercel runtime + GitHub ops): accettato, inerente alla scelta
  A; ridurre la duplicazione ruotando in modo coordinato.
- `workflow_dispatch` manuale evita esecuzioni ops accidentali.
- Cookie `Secure` garantiti da `NEXTAUTH_URL` https.
- La `GEMINI_API_KEY` non viene mai loggata dagli errori provider (verificato in 1c).

## Testing

Questa fase è prevalentemente infrastruttura/ops: poco codice nuovo testabile a
unità. L'unica modifica di codice applicativo è `maxDuration` (120→60), banale e
coperta dal type-check. La verifica reale è **manuale end-to-end** (§5) sullo
staging. I workflow GitHub Actions si validano con un dispatch reale (l'idempotenza
permette ri-esecuzioni). La suite Vitest esistente resta verde (nessuna regressione).

## Fuori scope (YAGNI)

- Vercel Pro / dominio custom / deployment protection (al lancio produzione).
- Monitoring/alerting (Sentry, Datadog).
- Upstash QStash / job schedulati (nessun job durevole richiesto in 1f).
- Auth sui preview deploy · multi-ambiente separato (preview vs prod).
- Ottimizzazioni performance non misurate (indici extra, caching KPI).
- Fallback Kimi (serve una key Moonshot platform — resta task a parte).

## File coinvolti

**Nuovi:**
- `.github/workflows/ops-neon.yml` — pipeline ops (migrate/import/seed/embed)
- `.github/workflows/ci.yml` — test Vitest su PR

**Modificati:**
- `src/app/api/trpc/[trpc]/route.ts` — `maxDuration` 120 → 60
- `.env.example` — allineare i commenti (Better Auth, non "NextAuth v4"); documentare
  `SETTINGS_ENCRYPTION_KEY` e la forma degli URL Neon (pooled/direct)
- `handoff.md` / `CLAUDE.md` STATO — a fine fase

**Invariati:** schema Prisma, logica applicativa (a parte `maxDuration`).

## Prerequisiti esterni (azioni utente)

1. **Upstash**: creare il database (free tier) e fornire l'URL `rediss://`.
2. **Billing Gemini**: attivo (confermato) — per l'embed completo.
3. **Vercel**: account Hobby + connessione del repo GitHub; impostare le env var (§1).
4. **GitHub Actions secrets**: impostare i secret ops (§1).
5. **Neon**: progetto già creato; connection string pooled+direct (fornite).
