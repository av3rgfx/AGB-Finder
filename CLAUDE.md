# UFPtrade WebApp — Contesto progetto (per Claude)

App gestionale B2B per **Utensilferramenta Pistoiese S.p.A.**: catalogo AGB,
assistente AI e generazione kit deterministica per agenti di vendita.

## STACK
Next.js 15 (App Router) · React 19 · TypeScript (strict) · tRPC v11 ·
`@tanstack/react-query` v5 · Prisma 6 + PostgreSQL/pgvector · **Better Auth** ·
Tailwind CSS 3 · Vitest · pnpm. Deploy target: Vercel + Neon + Upstash.

## DECISIONI ARCHITETTURALI (autoritative — sostituiscono i doc originali dove divergono)
- **Auth = Better Auth** (NON NextAuth). Email/password, `disableSignUp` (admin
  crea gli account), **sessioni DB 8h** (revoca immediata), plugin `admin` con
  ruoli custom **AGENT/ADMIN** via access-control, tipi inferiti. Config in
  `src/server/auth/config.ts`; client `src/lib/auth-client.ts`.
  → *Verdetto LLM Council: Auth.js v5 è in sola manutenzione; Better Auth è il
  successore attivo.*
- **Kit generation = engine deterministico TypeScript. MAI LLM.** (Fase 1d)
- **Single-agent AI con tool-use** (NON multi-agent). Provider: Gemini (primario)
  + Moonshot Kimi (kit gen + fallback).
- **Embedding = `vector(768)`** (`gemini-embedding-001`, normalizzato). Costante
  unica `src/server/constants/embedding.ts` (`EMBEDDING_DIM = 768`).
- **Struttura T3**: server-only sotto `src/server/` (guardato con `server-only`);
  client tRPC sotto `src/trpc/`; `src/env.ts` (zod).
- **Ogni chiamata AI via BullMQ** (rate limit + circuit breaker) — Fase ≥1c.

## REGOLE INVIOLABILI
- TypeScript strict sempre.
- Tutte le API via **tRPC** (mai `fetch` diretto dal client).
- Tutte le query via **Prisma**. **Raw SQL solo per pgvector**, incapsulato nel
  solo modulo `RAGEngine` (`$queryRaw`/`$executeRaw`) — e nelle migrazioni.
- UI **in italiano**. Codici prodotto in **font monospace** (JetBrains Mono).
- **Admin crea tutti gli account** — nessuna self-registration.
- RBAC: `PUBLIC` → `AGENT` → `ADMIN`.

## ISTRUZIONI PERMANENTI DI WORKFLOW (utente)
1. **Usa sempre `/using-superpowers`** quando sviluppi (poi le skill che indica:
   brainstorming → writing-plans → esecuzione TDD).
2. **Usa sempre `/llm-council`** per dubbi, quesiti, incongruenze, problematiche.
3. **Usa sempre `/impeccable`** quando sviluppi/progetti UI/UX.
4. **Aggiorna TUTTI i file `.md`** (incluso `handoff.md`) **a fine di ogni
   sessione** — la fine sessione la dichiara esplicitamente l'utente.

## FILE CHIAVE
- `prisma/schema.prisma` — schema DB (fonte di verità)
- `src/server/auth/config.ts` — Better Auth
- `src/server/api/trpc.ts` — init tRPC + procedure RBAC
- `src/server/ai/` — RAGEngine, EmbeddingService (Fase 1b+)
- `src/server/kit/` — engine deterministico (Fase 1d)
- `handoff.md` — stato sessione · `docs/superpowers/{specs,plans}/` — spec e piani

## FILE ESTERNI (regola utente)
- **Listino AGB (PDF)**: se il file non è disponibile nell'ambiente (es. container
  nuovo, scratchpad svuotata), **NON cercarlo sul web da solo**: chiedere il link
  direttamente all'utente, che lo fornirà. Ultimo link fornito (2026-07-01):
  https://drive.google.com/file/d/1TugU94aM6OP557ELiLQpH0nUxhxrXMUz/view?usp=sharing
- Stessa regola per qualunque altro file/documento aziendale mancante: prima
  chiedere all'utente, mai recuperarlo autonomamente da fonti esterne.

## AMBIENTE (workaround sandbox)
- **Engine Prisma**: `bash scripts/setup-prisma-engines.sh` (il downloader va in
  ECONNRESET dietro il proxy; li scarichiamo via curl → `PRISMA_*` in `.env`).
- **Docker**: `bash scripts/dev-bootstrap.sh` (avvia daemon + Postgres/Redis +
  migrate + seed).
- **Import PDF**: richiede `poppler-utils` (`pdftotext`).
- Comandi prisma/tsx: fare `set -a; source .env; set +a` prima (per gli engine).

## TESTING / GATE
`pnpm typecheck` · `pnpm lint` · `pnpm test` (Vitest) · `pnpm build`. TDD:
test prima, commit frequenti, un commit per task.

## STATO
Fase 1a (Fondamenta) ✅ + migrazione Better Auth ✅. Fase 1b (Catalogo + hybrid
search) in progettazione — vedi `handoff.md`.
