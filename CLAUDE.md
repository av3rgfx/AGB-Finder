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
- **Ogni chiamata AI passa dall'unico modulo `AIGateway`**
  (`src/server/ai/gateway.ts`): rate limit + circuit breaker con stato su Redis
  + fallback Gemini→Kimi. Nessuna chiamata provider fuori da `src/server/ai/`.
  Batch = script tsx idempotenti (`pnpm embed:products`). NIENTE BullMQ (verdetto
  LLM Council 2026-07-02: worker persistente impossibile su Vercel, anti-pattern
  su Upstash); per job asincroni durevoli futuri: Upstash QStash.

## REGOLE INVIOLABILI
- TypeScript strict sempre.
- Tutte le API via **tRPC** (mai `fetch` diretto dal client).
- Tutte le query via **Prisma**. **Raw SQL solo per pgvector**, incapsulato nel
  solo modulo `RAGEngine` (`$queryRaw`/`$executeRaw`) — e nelle migrazioni.
- UI **in italiano**. Codici prodotto in **font monospace** (JetBrains Mono).
- **Ogni design UI/UX si fa per MOBILE *e* desktop, mai solo desktop.** Ogni pagina o
  componente nuovo/modificato va progettato e implementato **responsive** (mobile-first),
  e **verificato a viewport mobile** (≤ 375px) prima di considerarlo concluso. Nessuna
  funzionalità va nascosta o resa inutilizzabile su mobile.
- **Admin crea tutti gli account** — nessuna self-registration.
- RBAC: `PUBLIC` → `AGENT` → `ADMIN`.

## ISTRUZIONI PERMANENTI DI WORKFLOW (utente)
1. **Usa sempre `/using-superpowers`** quando sviluppi (poi le skill che indica:
   brainstorming → writing-plans → esecuzione TDD).
2. **Usa sempre `/llm-council`** per dubbi, quesiti, incongruenze, problematiche.
3. **Usa sempre `/impeccable`** quando sviluppi/progetti UI/UX — **sempre in versione
   mobile *e* desktop**, con verifica a viewport mobile (vedi REGOLE INVIOLABILI).
4. **Usa sempre `/ponytail`** ogni volta che scrivi codice e programmi
   (scrittura, refactor, fix, review, scelta librerie/dipendenze): soluzione
   più semplice e minimale che funziona (YAGNI, riuso, stdlib prima delle
   dipendenze). NON abbassa mai lo standard su validazione input, error
   handling, sicurezza, accessibilità o test richiesti.
5. **Aggiorna TUTTI i file `.md`** (incluso `handoff.md`) **a fine di ogni
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
- **pnpm 10 obbligatorio** (`packageManager: pnpm@10.17.0`): pnpm 11 ignora
  `pnpm.overrides` in `package.json` e scarta l'override `better-call@1.3.7` →
  `better-auth` crasha a load. Corepack rispetta il pin; non forzare pnpm 11
  (semmai migrare gli override in `pnpm-workspace.yaml`). Vedi handoff.
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
Fase 1a (Fondamenta) ✅ + migrazione Better Auth ✅ + Fase 1b (Catalogo + hybrid
search, 6.191 prodotti) ✅ + Fase 1c (Chat AI: AIGateway, provider Gemini/Kimi,
ChatService tool-use, router chat, embedding batch, UI Assistente) ✅ + Fase 1d
(Kit engine deterministico — pilota ARTECH anta-ribalta LEGNO, 16 righe,
golden verificato su catalogo reale + browser) ✅ + Fase 1e (Dashboard dati reali:
router `dashboard.overview`, KPI + ultime richieste + scorciatoie, toggle team
ADMIN) ✅ + Gestione API key admin (Settings cifrato AES-256-GCM + `/impostazioni`,
fallback env) ✅ + **Fase 1f (deploy staging Vercel + Neon + Upstash) 🔄 QUASI COMPLETA**:
app **live** su `catalogo-finder-kappa.vercel.app`, workflow ops/CI su `main`,
Next 15.5.20. **Task 7 (pipeline ops) ✅** → DB Neon popolato (6.191 prodotti + 6.191
embedding + admin). **Task 8 (e2e) ✅ VERIFICATO** (2026-07-11, login admin reale, via
API backend): auth ADMIN · `dashboard.overview` · ricerca **testuale + ibrida** (query
semantica → famiglia A50107\* per solo vettore) · **chat tool-use** (Gemini cita codici
reali) · **kit ARTECH golden** `KIT-2026-0001` (16 righe / 21 pezzi / 90,20€, zero
warning) · `settings.aiKeys.status` (Gemini da env). Dettagli e caveat: `handoff.md`
(sezione «Fase 1f»). + **Fase 1g (kit multi-materiale) ✅ su PR #15** (Opzione C da
**LLM Council**): fix LEGNO chiusure supplementari opzionali · `kit-shared.ts` (meccanica
condivisa) · modulo **PVC provvisorio** (cert ift, da validare con esperto) · **ALLUMINIO
gated** (il listino 2026 non ha composizione alluminio: «PLANA» è cerniera complanare
legno/PVC — modulo rifiuta + `isActive:false`) · colonna `KitRequest.supplementary_closures`
+ migrazione + wizard (PVC on, ALLUMINIO off, toggle chiusure) — **PR #15 MERGIATA**
(migrazione applicata a Neon via ops run #2). + **Fase 1h (nuova TIPOLOGIA «anta a battente»
ARTECH LEGNO) ✅** su branch `claude/handoff-review-irs3gv` (Opzione C **estesa**, no /llm-council,
7 commit, gate verdi typecheck·lint·test **252**·build 13 route): l'anta proiettante richiesta
NON è a listino 2026 (0 riscontri, come l'alluminio) → **scelta utente = a battente**.
`artech-legno-shared.ts` (behavior-preserving, golden anta-ribalta invariato) +
`rules-artech-battente-legno.ts` **PROVVISORIO** (cremonese Mod. 502 `A50200.15.NN` + famiglie
condivise − meccanismo di ribalta → distinta **5 righe**) + enum `windowType` widen + seed
per-windowType + wizard **solo-LEGNO** (PVC/ALU gated per il battente). **Restano**: **al deploy**
`db:seed:kit` su Neon (template battente; **NESSUNA migrazione** — l'enum Postgres ha già
`ANTA_BATTENTE`) · integration gated (`INTEGRATION_DATABASE_URL`) per verificare i codici battente
a catalogo · validazione esperto (domande in `docs/superpowers/kit-assunzioni/{alu,pvc,battente}.md`).
Poi: scelta fase successiva — **decisione utente**. + **Gestione utenti admin + login username ✅**
su branch `claude/handoff-review-irs3gv` (dopo il merge Fase 1h #16; SDD 3 subagent-round + review
finale opus, gate verdi typecheck·lint·test **293**·build 14 route): sezione admin **/utenti**
(crea · elenca · cambia ruolo · attiva/disattiva[**ban**+status] · reset password · **modifica** ·
elimina), **ogni mutation `adminProcedure`** con **paletti anti-lockout** (mai su self né sull'ultimo
admin attivo; `delete` bloccato se ci sono record collegati kit/conversazioni/**settings**) · **login
con email O username** (plugin Better Auth `username`) + **account senza email** reale (email-segnaposto
`<username>@no-email.ufptrade.local`, unica costante `src/lib/placeholder-email.ts`). Review finale →
fix: `usernameSchema` allineato al validator del plugin (max 30, no trattino, altrimenti account
non-autenticabile), rimossa route `setStatus` non guardata, pre-check email → `CONFLICT`. **RESTA al
deploy**: applicare la **migrazione `username`** a Neon via ops (`20260713094200_username` — aggiunge
`users.username`/`display_username` + unique; nessun'altra migrazione). **PR A+B unica → PR #17 MERGIATA**;
**migrazione `username` APPLICATA a Neon via ops run #4** (login email/username OK in produzione).
+ **UI mobile responsive + regola mobile-first ✅ (PR #18 MERGIATA, live)**: il layout mobile era
inutilizzabile (sidebar `hidden md:block` senza alternativa) → **hamburger + drawer** (Sidebar riusata),
TopBar mobile, **`/utenti` azioni in menu ⋯** (dropdown `position:fixed` per non farsi ritagliare
dall'`overflow-x-auto`), fix griglia login (`grid-cols-1`). Verifica screenshot Chromium a 375px.
**PR #11–#18 mergiate e LIVE** su `catalogo-finder-kappa.vercel.app`; Neon allineato.
+ **Fase 1i (nuova TIPOLOGIA «vasistas» ARTECH LEGNO) ✅ su PR #20 (APERTA)**, branch
`claude/handoff-md-review-erkjm0`: terza tipologia del kit engine, PROVVISORIA (schema di montaggio listino
2026 pag. 416, anta singola, E.15, solo LEGNO). `rules-artech-vasistas-legno.ts` (cremonese `A50111.15` per
GR + catena DSS `A50190`/`A51400.05.03` + forbici `A50545` + incontri via colonna NOT.(GR)), guardie
(solo LEGNO, superficie ≤ 2 m², campo GR01–GR06), enum `windowType` += VASISTAS (**nessuna migrazione**),
registry, seed `isActive:true`, wizard solo-LEGNO. Golden 10 righe/12 pezzi. **Al merge #20:** `db:seed:kit`
su Neon. Assunzioni in `docs/superpowers/kit-assunzioni/vasistas.md`. + **«Visualizza nel listino» ✅ su
PR #21 (APERTA)**, branch `claude/listino-viewer`: pulsante che apre un viewer `react-pdf` in-app alla pagina
del listino di un codice, evidenziandolo (distinta kit + dettaglio prodotto). Parser page-aware
(`Product.listinoPage`, **migrazione** `add_listino_page`) + backfill; PDF su **Vercel Blob** dietro auth
(route `/api/listino` con Range). **Al merge #21 (ops per attivare):** (1) upload listino linearizzato su
Vercel Blob + env `LISTINO_PDF_URL`; (2) migrazione `add_listino_page` su Neon; (3) `pnpm backfill:pages`.
**PR #20 (vasistas) + #21 (viewer listino) + #22 (ottimizz. ops backfill) + #23 (fix immagini viewer)
MERGIATE e LIVE.** Neon allineato via ops run 30024919979 (migrazione `add_listino_page` + import + seed
vasistas). Viewer listino **attivato** (Vercel Blob + `LISTINO_PDF_URL`) e funzionante (apre alla pagina
giusta + evidenzia il codice). **⚠️ Problema aperto: immagini viewer parziali** (range-request: PDF.js
disegna prima che tutti gli XObject immagine arrivino) → **prossimo passo deciso = Opzione B (pre-split del
PDF in pagine singole su Blob + route `/api/listino?page=N` + viewer a pagina singola)**. Altri task aperti
(non bloccanti): validazione esperto kit provvisori (vasistas/battente/PVC/ALU); pulsante listino sulle card
archivio (stretched-link). Dettagli e prompt Opzione B: `handoff.md` §RIPRENDI DA QUI.
