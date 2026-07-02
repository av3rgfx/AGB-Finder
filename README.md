# UFPtrade — Utensilferramenta Pistoiese S.p.A.

WebApp gestionale B2B per agenti di vendita: catalogo AGB, assistente AI e
generazione kit deterministica. **Fase 1 — Fondamenta** (setup, DB, auth,
tRPC, login, dashboard).

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

## Import catalogo AGB

Il listino AGB (PDF) si importa con un parser **deterministico** (nessun LLM):

```bash
# prerequisito una tantum: pdftotext (poppler)
sudo apt-get install poppler-utils

set -a; source .env; set +a
pnpm import:agb /percorso/LISTINO-2026.pdf
```

Report atteso (listino 2026): ~957 pagine, ~8.400 righe-codice, **~96–97% di
parse rate**, ~6.200 codici unici in ~22 categorie. L'import è idempotente
(upsert per `agbCode`); le righe anomale vengono conteggiate come "saltate",
mai fatali. Il PDF non va committato: senza di esso, `pnpm db:seed` popola un
catalogo demo di 37 prodotti reali dalle fixture committate.

La ricerca (`/archivio`) usa il full-text italiano (tsvector) con tre strategie:
prefisso codice AGB (`B00590.15` → ILIKE), AND stretto multi-termine, fallback
OR ranked. Gli embedding pgvector (768) si attivano in fase successiva via
`GEMINI_API_KEY` + coda BullMQ, senza modifiche al codice di ricerca.

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

## Struttura (T3)

```
src/
  app/            App Router — (auth)/login, (dashboard)/*, api/{auth,trpc}
  server/         SERVER-ONLY — db, auth/config, api/{trpc,routers,root}
  trpc/           Client tRPC (React Query)
  components/     ui/ (Button, Input), layout/ (Sidebar, TopBar)
  lib/            utils, route-guard
prisma/           schema.prisma (12 modelli), migrations, seed.ts
```

## Regole di progetto

TypeScript strict · tutte le API via tRPC · tutte le query via Prisma · kit
engine deterministico (mai LLM) · chiamate AI via BullMQ · UI in italiano ·
codici prodotto in monospace · admin crea tutti gli account.
