# Fase 1f — Deploy staging (Vercel + Neon + Upstash) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare l'app completa live come staging su Vercel + Neon + Upstash (URL `catalogo-finder.vercel.app`), con catalogo importato ed embeddato su Neon durevole.

**Architecture:** Vercel fa build+serve (nessuna connessione DB al build). Le operazioni DB che richiedono la porta 5432 (che la dev-container web blocca) girano da un workflow **GitHub Actions** (`workflow_dispatch`) su runner a rete aperta: `migrate deploy → import:agb → db:seed (+seed:kit) → embed:products`. Un secondo workflow gira la suite Vitest su PR. L'unica modifica di codice applicativo è `maxDuration` (120→60) per il piano Vercel Hobby.

**Tech Stack:** Next.js 15, tRPC v11, Prisma 6 + Neon/pgvector, Better Auth, Upstash Redis (ioredis), GitHub Actions, pnpm 10, Node 22, Vitest.

## Global Constraints

- TypeScript strict sempre.
- Tutte le API via tRPC; tutte le query via Prisma (raw SQL solo in RAGEngine).
- UI in italiano; codici prodotto in font mono.
- pnpm 10 obbligatorio (`packageManager: pnpm@10.17.0`); Node 22.
- Nessun segreto nel repo: `.env` git-ignored; segreti nei secret store Vercel/GitHub.
- Un commit per task; gate finali: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- Spec di riferimento: `docs/superpowers/specs/2026-07-10-fase1f-deploy-design.md`.

## Natura della fase & split di esecuzione

Questa fase è **prevalentemente infrastruttura/ops**. I task si dividono in due categorie, marcate nel titolo:

- **[CLAUDE]** — file nel repo (workflow YAML, modifica `maxDuration`, `.env.example`, doc). Eseguibili da Claude, con commit.
- **[UTENTE]** — azioni sui pannelli web (Upstash, GitHub Secrets, Vercel) e dispatch/verifica. Non producono commit di Claude; il piano dà istruzioni precise e criteri di verifica.

**Gate di sequenza:** i workflow `workflow_dispatch` compaiono nella UI Actions solo se il file è **sul branch di default (`main`)**. Quindi i task [CLAUDE] 1–4 vanno **mergiati su `main`** (PR normale) *prima* dei task [UTENTE] 6–8 (Vercel deploy da `main` + dispatch ops).

## File Structure

**Nuovi**
- `.github/workflows/ci.yml` — suite Vitest su PR/push a `main`.
- `.github/workflows/ops-neon.yml` — pipeline ops DB (`workflow_dispatch`).

**Modificati**
- `src/app/api/trpc/[trpc]/route.ts` — `maxDuration` 120 → 60.
- `.env.example` — commenti Better Auth (non "NextAuth v4"), `SETTINGS_ENCRYPTION_KEY`, forma URL Neon pooled/direct.
- `handoff.md` · `CLAUDE.md` (STATO) — a fine fase.

---

### Task 1: [CLAUDE] `maxDuration` 120 → 60 per Vercel Hobby

**Files:**
- Modify: `src/app/api/trpc/[trpc]/route.ts`

**Interfaces:**
- Produces: nessuna interfaccia nuova; solo la costante `maxDuration = 60`.

- [ ] **Step 1: Modifica la costante e il commento**

In `src/app/api/trpc/[trpc]/route.ts`, sostituisci il blocco:

```ts
// Il loop tool-use della chat può superare i 10s di default delle function Vercel.
export const maxDuration = 120;
```

con:

```ts
// Il loop tool-use della chat supera i 10s di default delle function Vercel.
// Cap del piano Vercel Hobby = 60s (con billing Gemini attivo una chat normale
// resta in 2–5s). Al passaggio a Vercel Pro rialzare a 300.
export const maxDuration = 60;
```

- [ ] **Step 2: Verifica typecheck**

Run: `pnpm typecheck`
Expected: PASS (nessun errore).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trpc/[trpc]/route.ts
git commit -m "chore(fase1f): maxDuration 120->60 per Vercel Hobby"
```

---

### Task 2: [CLAUDE] Allineare `.env.example`

**Files:**
- Modify: `.env.example`

**Interfaces:**
- Produces: documentazione env aggiornata (nessun impatto runtime).

- [ ] **Step 1: Correggi la sezione AUTH e aggiungi le voci mancanti**

Sostituisci il blocco AUTH:

```
# ═══════════════════════════════════════════════════════════════
# AUTH (NextAuth v4)
# ═══════════════════════════════════════════════════════════════
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-me-min-32-chars-run-openssl-rand-base64-32"
```

con:

```
# ═══════════════════════════════════════════════════════════════
# AUTH (Better Auth — le var mantengono i nomi NEXTAUTH_* per compat)
# In produzione: NEXTAUTH_URL = URL Vercel reale (es. https://catalogo-finder.vercel.app)
# ═══════════════════════════════════════════════════════════════
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-me-min-32-chars-run-openssl-rand-base64-32"
```

Poi, sotto la sezione SECURITY, aggiungi (se assente) la voce master key:

```
# Master key per la cifratura delle API key AI salvate a DB (/impostazioni).
# Opzionale in dev/CI; se assente, la feature "key da DB" è disattiva.
# Genera: openssl rand -base64 32 — distinta per ambiente, mai loggata.
SETTINGS_ENCRYPTION_KEY=""
```

Infine, aggiorna il commento DATABASE per Neon:

```
# ═══════════════════════════════════════════════════════════════
# DATABASE (Neon in prod / local Postgres+pgvector in dev)
# Neon: DATABASE_URL = connessione POOLED (host con -pooler, ?sslmode=require&pgbouncer=true)
#       DIRECT_URL   = connessione DIRETTA (host senza -pooler, ?sslmode=require) — per le migrazioni
# ═══════════════════════════════════════════════════════════════
```

- [ ] **Step 2: Verifica assenza di segreti reali**

Run: `git diff .env.example`
Expected: solo commenti e placeholder `change-me`/`""` — nessuna key o URL reale.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(fase1f): allinea .env.example (Better Auth, SETTINGS_ENCRYPTION_KEY, Neon URLs)"
```

---

### Task 3: [CLAUDE] Workflow CI (Vitest su PR)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: workflow `CI` che esegue `pnpm test` su PR/push verso `main`. Nessuna env necessaria (`vitest.config.ts` inietta i default in `test.env`).

- [ ] **Step 1: Crea il workflow**

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Enable corepack (pnpm 10)
        run: corepack enable
      - name: Install deps
        run: pnpm install --frozen-lockfile
      - name: Test (Vitest)
        run: pnpm test
```

- [ ] **Step 2: Verifica sintassi YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML ok')"`
Expected: `YAML ok`. Se `python3`/`pyyaml` non è disponibile, ispeziona a mano (indentazione a 2 spazi; chiavi `on`/`jobs`/`steps`); in ogni caso GitHub valida la sintassi al push e segnala eventuali errori nella tab Actions.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(fase1f): esegui la suite Vitest su PR verso main"
```

---

### Task 4: [CLAUDE] Workflow ops Neon (migrate/import/seed/embed)

**Files:**
- Create: `.github/workflows/ops-neon.yml`

**Interfaces:**
- Consumes (da GitHub Secrets, impostati nel Task 5): `NEON_DIRECT_URL` (connessione diretta Neon, non-pooler), `GEMINI_API_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
- Produces: su Neon → schema migrato (+ pgvector/pg_trgm), 6.191 prodotti, admin + template kit, 6.191 embedding.

**Note tecniche (verificate nel repo):**
- Gli script `import-agb.ts`, `embed-products.ts`, `seed.ts`, `seed-kit.ts` **non** importano `src/env.ts`: usano un proprio `PrismaClient` (`DATABASE_URL`) e leggono `process.env` direttamente → il job richiede solo `DATABASE_URL`/`DIRECT_URL`/`GEMINI_API_KEY`/`SEED_ADMIN_*`.
- `import:agb` prende il PDF come `process.argv[2]` → `pnpm import:agb listino.pdf`.
- Il job punta `DATABASE_URL` alla connessione **diretta** (il Prisma client dei batch legge `DATABASE_URL`): batch one-shot senza pooler. `migrate deploy` usa `DIRECT_URL`.

- [ ] **Step 1: Crea il workflow**

```yaml
name: Ops — Neon (migrate/import/seed/embed)
on:
  workflow_dispatch:
    inputs:
      listino_url:
        description: "URL diretto del listino AGB PDF (default: link registrato in CLAUDE.md)"
        required: false
        default: "https://drive.usercontent.google.com/download?id=1TugU94aM6OP557ELiLQpH0nUxhxrXMUz&export=download&confirm=t"
jobs:
  ops:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    env:
      DATABASE_URL: ${{ secrets.NEON_DIRECT_URL }}
      DIRECT_URL: ${{ secrets.NEON_DIRECT_URL }}
      GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      GEMINI_MODEL: gemini-2.5-flash
      SEED_ADMIN_EMAIL: ${{ secrets.SEED_ADMIN_EMAIL }}
      SEED_ADMIN_PASSWORD: ${{ secrets.SEED_ADMIN_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Enable corepack (pnpm 10)
        run: corepack enable
      - name: Install deps
        run: pnpm install --frozen-lockfile
      - name: Install poppler-utils
        run: sudo apt-get update && sudo apt-get install -y poppler-utils
      - name: Prisma generate
        run: pnpm exec prisma generate
      - name: Download listino PDF
        run: |
          curl -sSL "${{ github.event.inputs.listino_url }}" -o listino.pdf
          head -c 5 listino.pdf | grep -q '%PDF' || { echo "::error::Il download non è un PDF valido"; exit 1; }
          echo "PDF scaricato: $(wc -c < listino.pdf) byte, $(pdfinfo listino.pdf | awk '/Pages/{print $2}') pagine"
      - name: Migrate deploy (Neon + pgvector/pg_trgm)
        run: pnpm exec prisma migrate deploy
      - name: Import catalogo (6.191 prodotti)
        run: pnpm import:agb listino.pdf
      - name: Seed admin + template kit
        run: |
          pnpm db:seed
          pnpm db:seed:kit
      - name: Embed catalogo (idempotente, batch 50)
        run: pnpm embed:products
```

- [ ] **Step 2: Verifica sintassi YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ops-neon.yml')); print('YAML ok')"`
Expected: `YAML ok`. Se `python3`/`pyyaml` non è disponibile, ispeziona a mano; GitHub valida comunque al push.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ops-neon.yml
git commit -m "ci(fase1f): workflow ops Neon (migrate/import/seed/embed) via workflow_dispatch"
```

---

### Task 5: [UTENTE] Prerequisiti esterni — Upstash, billing, GitHub Secrets

Nessun commit di Claude. Istruzioni da eseguire sui pannelli web.

- [ ] **Step 1: Provisiona Upstash Redis**
  - console.upstash.com → Create Database → nome `catalogo-finder`, regione vicina a Neon (EU) → Create.
  - Copia l'endpoint **`rediss://`** (con TLS). Servirà come `REDIS_URL` su Vercel (Task 6).
  - Verifica: il DB compare come "Active" con un URL `rediss://...`.

- [ ] **Step 2: Conferma il billing sulla key Gemini**
  - aistudio.google.com / Google Cloud → verifica che la key `GEMINI_API_KEY` sia su un progetto con **billing attivo** (necessario per superare il cap free-tier ~1.000/giorno ed embeddare i 6.191 in un colpo).
  - Verifica: una chiamata `embedContent` non restituisce 429 di quota (lo confermerà il Task 7).

- [ ] **Step 3: Imposta i GitHub Actions Secrets**
  - Repo GitHub → Settings → Secrets and variables → Actions → New repository secret. Crea:
    - `NEON_DIRECT_URL` = connessione **diretta** Neon (host **senza** `-pooler`), es. `postgresql://<user>:<pwd>@ep-old-silence-abpt0yhn.eu-west-2.aws.neon.tech/neondb?sslmode=require`
    - `GEMINI_API_KEY` = la key Gemini (billing attivo)
    - `SEED_ADMIN_EMAIL` = es. `admin@ufptrade.local`
    - `SEED_ADMIN_PASSWORD` = password forte (annotala nel password manager)
  - Verifica: i 4 secret compaiono nella lista (valori mascherati).

---

### Task 6: [UTENTE] Deploy su Vercel (Hobby) + env var runtime

Nessun commit di Claude. Da eseguire **dopo** il merge su `main` dei Task 1–4.

- [ ] **Step 1: Importa il progetto su Vercel**
  - vercel.com → Add New → Project → importa il repo GitHub → Framework: **Next.js** (auto-detect) → **non** deployare ancora (prima le env, Step 2). Nome progetto: `catalogo-finder`.

- [ ] **Step 2: Imposta le Production Environment Variables** (Settings → Environment Variables):
    - `DATABASE_URL` = Neon **pooled** (host con `-pooler`, `?sslmode=require&pgbouncer=true`)
    - `DIRECT_URL` = Neon **diretto** (host senza `-pooler`, `?sslmode=require`)
    - `REDIS_URL` = l'URL `rediss://` di Upstash (Task 5)
    - `NEXTAUTH_URL` = `https://catalogo-finder.vercel.app`
    - `NEXTAUTH_SECRET` = `openssl rand -base64 32` (stabile)
    - `IP_HASH_SECRET` = `openssl rand -base64 32`
    - `SETTINGS_ENCRYPTION_KEY` = `openssl rand -base64 32` (annotala nel password manager: perderla = key AI cifrate irrecuperabili)
    - `GEMINI_API_KEY` = la key (o lasciala vuota e gestiscila da `/impostazioni`)
    - `GEMINI_MODEL` = `gemini-2.5-flash`
  - Verifica: 9 variabili impostate sull'ambiente Production.

- [ ] **Step 3: Deploy**
  - Deploy dalla UI (o push su `main`). Attendi il build verde.
  - Verifica: `https://catalogo-finder.vercel.app` risponde con la pagina di login (il DB è ancora vuoto: il login fallirà finché non gira il Task 7 — atteso).

---

### Task 7: [UTENTE] Esegui la pipeline ops (dispatch) e verifica i conteggi

Nessun commit di Claude. Da eseguire **dopo** il merge su `main` (workflow visibile) e dopo il Task 5.

- [ ] **Step 1: Dispatch del workflow ops**
  - Repo GitHub → Actions → "Ops — Neon (migrate/import/seed/embed)" → Run workflow → branch `main` → (lascia `listino_url` di default o incolla un link aggiornato) → Run.

- [ ] **Step 2: Verifica dai log del run**
  - Step "Import catalogo": log `✓ Prodotti unici: 6191` (o valore atteso dal listino corrente).
  - Step "Embed catalogo": log `Completato: N embedding generati` senza 429 di quota.
  - Verifica idempotenza: un secondo Run mostra `Niente da fare: tutti i prodotti hanno già l'embedding.`
  - Verifica: il run termina **verde** su tutti gli step.

---

### Task 8: [UTENTE] Verifica end-to-end sullo staging (definition of done)

Nessun commit di Claude. Sullo staging deployato (`catalogo-finder.vercel.app`):

- [ ] **Step 1:** login admin (credenziali `SEED_ADMIN_*`) → `/impostazioni`: testa e salva una key AI (cifratura + audit ok).
- [ ] **Step 2:** admin crea un agente → logout → login agente.
- [ ] **Step 3:** `/archivio`: ricerca testuale **e ibrida** (con embedding reali) → risultati coerenti, codici in mono.
- [ ] **Step 4:** `/assistente`: chat con tool-use (ricerca prodotti) → risposta entro i 60s.
- [ ] **Step 5:** `/richieste/nuova`: genera un kit ARTECH → distinta con prezzi.
- [ ] **Step 6:** `/dashboard`: KPI reali + ultime richieste.
- [ ] **Verifica finale:** 6.191 prodotti e 6.191 embedding presenti (dai log del Task 7 o dal SQL editor di Neon: `SELECT count(*) FROM products;` e `SELECT count(*) FROM products WHERE embedding IS NOT NULL;`).

---

### Task 9: [CLAUDE] Aggiornare handoff.md e CLAUDE.md (fine fase)

**Files:**
- Modify: `handoff.md`
- Modify: `CLAUDE.md` (sezione STATO)

- [ ] **Step 1:** In `handoff.md`: spuntare l'embedding catalogo (fatto su Neon), aggiungere sezione "Fase 1f — cosa è stato costruito" (workflow ci.yml/ops-neon.yml, maxDuration, .env.example, deploy staging su `catalogo-finder.vercel.app`), aggiornare cronologia e contesto tecnico; segnare Fase 1 (MVP) completata.
- [ ] **Step 2:** In `CLAUDE.md` STATO: aggiungere "+ Fase 1f (deploy staging Vercel+Neon+Upstash) ✅"; aggiornare "Prossima:" alla fase successiva (es. Fase 2 o hardening produzione).
- [ ] **Step 3: Commit**

```bash
git add handoff.md CLAUDE.md
git commit -m "docs(fase1f): fine fase — deploy staging completato, handoff/STATO aggiornati"
```

---

## Self-review (coperto)

- **Spec coverage:** §1 env→Task 2/5/6; §2 pipeline ops→Task 4/7; §3 config prod (maxDuration→Task 1; NEXTAUTH_URL/Upstash/Neon→Task 6); §4 CI→Task 3; §5 verifica→Task 8; prerequisiti→Task 5/6. Nessun gap.
- **Placeholder scan:** nessun TBD/TODO; ogni step ha comando/codice/istruzione concreta. `<user>/<pwd>` negli esempi di connection string sono segnaposto d'istruzione utente (valori reali dal pannello Neon).
- **Type consistency:** nomi secret coerenti (`NEON_DIRECT_URL`, `GEMINI_API_KEY`, `SEED_ADMIN_*`) tra Task 4 (workflow) e Task 5 (creazione); nomi script (`import:agb`, `db:seed`, `db:seed:kit`, `embed:products`) verificati in `package.json`.
