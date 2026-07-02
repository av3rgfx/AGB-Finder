# UFPtrade — Utensilferramenta Pistoiese S.p.A.

WebApp gestionale B2B per agenti di vendita: catalogo AGB, assistente AI e
generazione kit deterministica. **Fase 1a — Fondamenta** (setup, DB, auth,
tRPC, login, dashboard) + **Fase 1b — Catalogo & ricerca** (parser listino,
import, RAGEngine tsvector+trigram, Archivio + dettaglio).

## Stack

Next.js 15 · React 19 · TypeScript (strict) · tRPC v11 · Prisma 6 +
PostgreSQL/pgvector · Better Auth (email/password, sessioni DB, plugin admin) ·
Tailwind CSS 3 · Vitest · pnpm.

## Prerequisiti

- Node 22, pnpm (via `corepack`)
- Docker (Postgres + Redis)

## Avvio sviluppo

```bash
pnpm install

# Sandbox/proxy: scarica gli engine Prisma via curl e scrive le var in .env.
# In ambienti normali Prisma li scarica da solo — puoi saltare questo passo.
bash scripts/setup-prisma-engines.sh

cp .env.example .env         # poi imposta i secret (openssl rand -base64 32)
                             # e SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD

docker compose up -d         # Postgres(pgvector) + Redis
pnpm prisma migrate deploy   # applica lo schema + indici pgvector/tsvector
pnpm db:seed                 # crea l'admin + categorie base (idempotente)

pnpm dev                     # http://localhost:3000
```

Login con le credenziali `SEED_ADMIN_*`. `/` → `/login`; dopo l'accesso →
`/dashboard`.

> **Nota ambiente sandbox:** se il socket Docker non è attivo, avvia il daemon
> prima di `docker compose up` (es. `sudo dockerd &`). Gli engine Prisma sono
> risolti via `PRISMA_QUERY_ENGINE_LIBRARY` / `PRISMA_SCHEMA_ENGINE_BINARY`
> (impostate da `scripts/setup-prisma-engines.sh`). Comodo one-shot:
> `bash scripts/dev-bootstrap.sh`.

## Script

| Comando | Descrizione |
|---|---|
| `pnpm dev` | Server di sviluppo |
| `pnpm build` | Build di produzione (`prisma generate` + `next build`) |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm lint` | ESLint (`next/core-web-vitals`) |
| `pnpm test` | Vitest (unit) |
| `pnpm db:migrate` / `db:seed` / `db:studio` | Prisma |
| `pnpm db:seed:catalog` | Seed catalogo sintetico (50 prodotti AGB reali) |
| `pnpm import:agb <listino.pdf>` | Import completo del listino AGB |

## Import catalogo AGB

Prerequisito: `poppler-utils` (`pdftotext`). Il PDF del listino (39 MB) **non è
committato**: se non è disponibile nell'ambiente, **chiedere il link
all'utente** (regola in `CLAUDE.md` §FILE ESTERNI — mai recuperarlo dal web).

```bash
pnpm import:agb /percorso/LISTINO-2026.pdf
```

Output atteso (listino 2026): `Pagine: 959 · Righe con codice: 8491 · Parsed:
8217 · Skipped: 274` → `Prodotti unici: 6191 · Categorie: 22`. L'import è
idempotente (upsert per `agbCode`); per dev senza PDF c'è `pnpm db:seed:catalog`.

La ricerca (`/archivio`) è ibrida: tsvector `italian` + pg_trgm (flessioni
singolare/plurale) + boost prefisso codice; il ramo vettoriale (pgvector) si
attiva in Fase ≥1c con gli embedding Gemini.

## Struttura (T3)

```
src/
  app/            App Router — (auth)/login, (dashboard)/*, api/{auth,trpc}
  server/         SERVER-ONLY — db, auth/config, api/{trpc,routers,root},
                  ai/ (RAGEngine, EmbeddingService), catalog/ (parser+import,
                  moduli puri senza `server-only`: riusati da scripts/ via tsx)
  trpc/           Client tRPC (React Query)
  components/     ui/ (Button, Input), layout/ (Sidebar, TopBar), product/
  lib/            utils, route-guard, format, use-debounced-value
prisma/           schema.prisma (12 modelli), migrations, seed.ts, seed-catalog.ts
scripts/          import-agb.ts, dev-bootstrap.sh, setup-prisma-engines.sh
```

## Regole di progetto

TypeScript strict · tutte le API via tRPC · tutte le query via Prisma · kit
engine deterministico (mai LLM) · chiamate AI via BullMQ · UI in italiano ·
codici prodotto in monospace · admin crea tutti gli account.
