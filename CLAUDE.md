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
- **Single-agent AI con tool-use** (NON multi-agent). **Provider LLM: Gemini UNICO**
  (chat streaming + embedding). **Kimi/Moonshot rimosso 2026-07-24** (verdetto
  `/llm-council`, supera la decisione precedente "Gemini + Kimi"): kit engine
  deterministico → il ruolo "kit gen" non esiste più; fallback dormiente in prod
  (nessuna key) → nessun consumatore residuo. Resilienza = circuit breaker
  per-Gemini + rate limit + backoff visibile + degrado graceful, **NON** un secondo
  vendor. ⚠️ *Concentrazione vendor app-wide*: un outage/429-storm Gemini degrada
  **chat E ricerca semantica** (embedding query live); ricerca testuale e kit
  restano attivi. Fix strutturale dei 429 ricorrenti = piano Gemini a pagamento.
- **Chat = streaming SSE** (`POST /api/chat/stream`, route handler autenticato
  Better Auth) → `ChatService.generateStream` → `AIGateway.chatStream`. **UNICA
  deroga** alla regola "mai `fetch` diretto dal client": l'hook
  `src/hooks/use-chat-stream.ts` (SSE non esprimibile su `httpBatchLink`). Tutto
  il resto resta tRPC. Cancellazione **solo via `AbortSignal`** (mai
  `.return()`/`.throw()` sul generatore: salterebbe la persistenza del parziale).
- **Embedding = `vector(768)`** (`gemini-embedding-001`, normalizzato). Costante
  unica `src/server/constants/embedding.ts` (`EMBEDDING_DIM = 768`).
- **Struttura T3**: server-only sotto `src/server/` (guardato con `server-only`);
  client tRPC sotto `src/trpc/`; `src/env.ts` (zod).
- **Ogni chiamata AI passa dall'unico modulo `AIGateway`**
  (`src/server/ai/gateway.ts`): rate limit + circuit breaker con stato su Redis
  + timeout. **Nessun fallback di provider** (Gemini unico dal 2026-07-24; in
  streaming un retry a metà risposta duplicherebbe i token già emessi).
  Nessuna chiamata provider fuori da `src/server/ai/`.
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
+ **Opzione B (viewer a PAGINE SINGOLE) ✅ su branch `claude/listino-page-split-n8ofuk` (PR da aprire)**:
risolve le immagini parziali pre-splittando il listino in ~959 paginette su Vercel Blob (ognuna un file
minuscolo con tutte le sue immagini → scaricata per intero, niente Range). `scripts/split-listino.ts`
(`pdfseparate` + `@vercel/blob`, naming `listino/page-N.pdf` idempotente) + workflow `ops-split-listino.yml`
(secret `BLOB_READ_WRITE_TOKEN`) · route `/api/listino?page=N` (auth, param validato anti-SSRF, no Range) ·
env `LISTINO_PAGE_URL_TEMPLATE` + `LISTINO_TOTAL_PAGES` (al posto di `LISTINO_PDF_URL`) · viewer a pagina
singola (`<Page pageNumber={1}>`, `totalPages` via prop dal layout server) **+ fix mobile-first** del
`width` fisso 720px (ora responsive via `ResizeObserver`). Gate verdi (typecheck·lint·test **332**·build).
**AZIONI OPS al merge:** secret `BLOB_READ_WRITE_TOKEN` → run `Ops — Split listino` → impostare le 2 env su
Vercel (dai log) e rimuovere `LISTINO_PDF_URL` → redeploy → verifica browser ≤375px. Dettagli: `handoff.md`
§RIPRENDI DA QUI e `docs/superpowers/{specs,plans}/2026-07-23-listino-page-split*`.
**PR #25 MERGIATA** (versione Blob pubblico). Al primo run ops lo split è fallito (`Cannot use public access on a
private store`): lo store Blob è **PRIVATO** → **follow-up** (branch ripartito da main dopo #25, nuova PR): env
**`BLOB_READ_WRITE_TOKEN`** al posto di `LISTINO_PAGE_URL_TEMPLATE`; la route legge le paginette **private** lato
server via `@vercel/blob` `get(access:"private", token)`; `@vercel/blob` in **dependencies**; listino mai pubblico.
Gate verdi (test **330**). **PR #25 + #26 MERGIATE**; split privato ri-lanciato (run #2, 959 paginette private).
+ **IMMAGINI PRODOTTO ✅ (branch `claude/listino-page-split-n8ofuk`, PR da aprire)**: scoperta la **causa radice**
del «immagini viewer» — le foto del listino sono **JPEG2000** e **PDF.js non le decodifica** (il range/split non
c'entravano). **Scelta utente: estrarre le foto dal PDF e mostrarle sulla scheda prodotto** (poppler decodifica il
jpx → PNG → `<img>` native). Tabella **`ProductImage`** (separata da Product) + migrazione `add_product_images` ·
helper puro di mappatura **immagine→codice per banda verticale** (`listino-images.ts`) · script `extract:images` +
workflow `ops-extract-images.yml` · route `/api/product-image?code=…` (auth, byte dal DB) · UI `ProductImage`
(`<img onError hide>`) sulla scheda dettaglio. Gate verdi (test **341**). **PR #27 MERGIATA + ops run 30089631152
(`✓ 7082 immagini salvate in product_images`)**; route verificata live (401 senza auth). Dettagli:
`docs/superpowers/specs/2026-07-24-immagini-prodotto-design.md`.
+ **UX Archivio ✅ (PR #29 MERGIATA e in `main`)**: workflow completo
(brainstorming → /llm-council → critica adversariale 3-lenti → /impeccable → piano → TDD). **(1) Persistenza**:
query/filtri/pagina negli **URL searchParams** (`useSearchParams` sotto `<Suspense>` in `archivio/page.tsx`,
scrittura `router.replace(…,{scroll:false})`), **vista** in `localStorage` (idratata post-mount, no flash).
**(2) Ritorno-alla-lista con scroll** (priorità #1): snapshot `scrollY` per-chiave in `sessionStorage`
(`archivio-scroll.ts`), `history.scrollRestoration='manual'`, ripristino in `rAF` una volta dopo i dati in cache;
salvataggio su **`pointerdown` (cattura)** + `pagehide` (NON su scroll/unmount: Next scrolla in cima aprendo il
dettaglio → salverebbe 0). **(3) Cronologia 7gg**: `product.recentSearches` read-side su `ActivityLog`
(`recent-searches.ts`: scarta 0-risultati, dedup, collassa prefissi) → «Ricerche recenti» nell'empty-state.
**Extra**: thumbnail card/righe (riservate; `ProductImage` esteso con `fallback`, `ProductThumb`) · chip filtri
attivi + azzera · empty-state con suggerimenti. Moduli puri `archivio-search-params.ts`/`archivio-scroll.ts`/
`recent-searches.ts` + hook `use-archivio-search.ts`. Gate verdi (typecheck·lint·**test 369/+28**·build). **Verifica
browser reale (Chromium desktop + mobile 375px)** ha confermato il ripristino scroll (1073→1073 · 900→900) e
**scovato 2 bug** poi corretti (salvataggio a 0; rAF annullato dalla cleanup). **Nessuna migrazione, nessuna dep,
NESSUNA AZIONE OPS.** Spec/piano: `docs/superpowers/{specs,plans}/2026-07-24-archivio-ux*`.
+ **UX Archivio — follow-up ✅ (PR #30 MERGIATA e in `main`)**: 4 idee prima fuori scope, tutte a basso
rischio. **(A) Scorciatoia `/`** focalizza la ricerca (helper puro `is-editable-target.ts` per non intercettare
mentre si scrive; `Esc` sfoca; hint `<kbd>` desktop). **(B) «Copia link»** copia l'URL della ricerca (già
condivisibile) con feedback. **(C) «Visti di recente»** via **`localStorage`** (`recently-viewed.ts`: dedup, cap 8;
registrato nella scheda dettaglio; rail nell'empty-state). **(D) Pulsante listino su card/righe**: `listinoPage`
(già restituito da `product.search`) esposto in `ProductSummary`; card/riga ristrutturate **stretched-link** (anchor
overlay + `ListinoButton` fratello z-index → apre il viewer senza navigare); sulla riga solo desktop (a ≤375px
resta la scheda). Gate verdi (typecheck·lint·**test 380/+11**·build). **Verifica browser (Chromium desktop +
mobile 375px): 12/12 check verdi.** Nessuna migrazione, nessuna dep, **NESSUNA AZIONE OPS**. Spec/piano:
`docs/superpowers/{specs,plans}/2026-07-24-archivio-ux-follow-up*`.
+ **CHAT ASSISTENTE professionale ✅ (branch `claude/assistant-chat-streaming-mobile-1apei1`, PR da aprire)**:
riscrittura completa della chat Fase 1c (bozza grezza, mobile inusabile). Workflow: brainstorming → **2×
`/llm-council`** (streaming + rimozione Kimi) → `/impeccable` (2 scelte UI approvate dall'utente su anteprima
interattiva) → `/writing-plans` → **12 task SDD** (implementer + reviewer per task). **(1) Streaming SSE**
end-to-end: `GeminiChatProvider.chatStream` (`:streamGenerateContent?alt=sse` + `eventsource-parser`) →
`AIGateway.chatStream` (guardie, **niente fallback/retry**) → `ChatService.generateStream` (tool-loop **cap 3
round**, eventi `tool|delta|done|error`, persistenza **una sola volta**) → route `POST /api/chat/stream` (auth,
ownership, header anti-buffering, `maxDuration=60`) → hook `useChatStream` (batch `rAF`, **STOP**, deroga fetch
confinata). **(2) Gemini-only** (Kimi rimosso ovunque). **(3) Conversazioni**: `rename`/`delete` soft/`archive`/
`list({search})` + **prodotti citati per-messaggio** in `get`. **(4) UI A1+B1** (scelte utente): risposte AI a
**tutta larghezza** (niente bolla/bordo sinistro — DESIGN.md aggiornato) e **card prodotto inline** sotto la
risposta (niente pannello/sheet); markdown `react-markdown`+`remark-gfm` (plugin `remark-agb-code` per i codici
mono, code-block con copia, **href allowlist** anti-XSS); composer auto-grow **Invia↔STOP**; drawer conversazioni
mobile; `?c=` in URL; scroll intelligente; banner errore con countdown `Retry-After` (auto-retry max 2).
**Bug reali intercettati dalle review** (sarebbero finiti in produzione): lo **STOP apriva il circuit breaker**
(5 stop = chat offline per tutti), errori JSON silenziati nel parser SSE, invio silenziosamente rotto nello
stopgap, e una **race che riversava lo stream in un'altra conversazione**. Gate verdi (typecheck·lint·**test 518**)
+ **verifica browser 13/13** (Chromium desktop + **375px** + viewport corto, 17 screenshot). **ZERO migrazioni,
ZERO azioni ops DB** (solo: rimuovere da Vercel le env `KIMI_API_KEY`/`KIMI_MODEL` se presenti).
Spec/piano: `docs/superpowers/{specs,plans}/2026-07-24-chat-streaming*`. — **PR #32 MERGIATA** in `main`.
+ **BONIFICA KIT ARTECH LEGNO ✅ (branch `claude/kit-engine-study-wfo2hq`, PR da aprire)**: tutti i moduli kit
riverificati riga per riga contro il **listino AGB 2026** (959 pagine, schemi di montaggio inclusi). Esito: dei
**4 template attivi, 3 producevano distinte non ordinabili**. 8 task TDD, un commit per task.
**(1) PVC → `isActive:false` + modulo che rifiuta**: i 4 codici material-specific (`A51921.36.04`,
`A50712.00.00`, `A50922.07.00`, `A50812.07.00`) compaiono **solo** nelle pagine-certificato ift p0013 (11) e
p0395 (393), **senza prezzo**; altri 7 (`A51921.36.01/.02/.03`, famiglia sx `A51922.36.0N`) non esistono nemmeno
lì — dedotti per simmetria. Ogni distinta PVC usciva con **4 righe su 12 senza prezzo**. Il PVC vero è nel
«listino PVC e ALLUMINIO» (p0849 (847)). **(2) BATTENTE → `isActive:false` + rifiuto**: lo schema p0416 (414) ha
**21 voci**, il modulo ne generava **5** — mancava l'intero appoggio della cerniera superiore, **l'anta non era
appesa**; schema **composito** (tre alternative di cerniera) → non decidibile dal listino. `BATTENTE_CREMONESI`
conservata, verificata contro p0429 (427). **(3) Pilota anta-ribalta**: supporto cerniera `A50801.01.0N` →
**`A50805.05.DX/.SX`** (il primo è «Aria 4 - Interasse 9» battuta 18 su un serramento aria 12/interasse
13/battuta 20; p0451 (449) + certificato ift; stesso prezzo) · banda cremonese GR02 `650→610` (p0424 (422)) ·
descrizione incontro ribalta 9x18. Squadra angolare e formula incontri **non** toccate (fonte autorevole a
favore) → domande esperto. **(4) `PILOT_GEOMETRY` + `assertPilotGeometry`**: aria/interasse/battuta/sede erano
raccolti, validati e **ignorati** (aria 4 riceveva in silenzio i codici dell'aria 12) → ora i moduli rifiutano.
**(5-7) VASISTAS riscritto** come trascrizione dello schema p0418 (416): forbici dalla tabella per **LBB** (prima
per altezza), via **DSS + incontro DSS** (non sono fra le 13 voci), dentro le **cerniere** voci 10-11-12 e il 2°
terminale, supporto/perno legati alle cerniere portanti, **`sashWeightKg` opzionale** (3ª cerniera 70-80 kg,
portata 40 kg/forbice) → golden **13 righe / 19 pezzi**. **(8) Docs**: schede `kit-assunzioni/` riscritte come
**esito** + nuova `legno.md` con l'**indice globale delle 10 domande** per l'esperto (i commenti nel codice ci
rimandano per numero). **Collaterale: parser catalogo allargato** ai codici con segmenti alfanumerici
(`.DX/.SX/.CR/.FM`, cilindri `CG…`) → **+1.297 codici a prezzo, 6.191 → 7.488**.
**TIPOLOGIE ATTIVE: anta-ribalta LEGNO** (golden 16 righe/21 pezzi/90,20 € con chiusure supplementari) **e
vasistas LEGNO** (13/19, PROVVISORIO); **battente e PVC disattivati** in attesa di dati; **ALLUMINIO** resta
gated. Gate verdi (typecheck·lint·**test 589/11 skip**) + verifica browser wizard desktop e **375px**
(8 screenshot; corretta la griglia materiali `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`).
**🔴 AZIONI OPS AL MERGE (obbligatorie)**: un run completo di **«Ops — Neon»** = migrazione
**`20260725213059_kit_sash_weight`** + **RE-IMPORT del catalogo** (senza, `A50805.05.DX/.SX` non è a DB → riga
senza prezzo e golden **90,20 → 85,76 €**) + **`db:seed:kit`** (è ciò che disattiva davvero PVC e battente) +
`embed:products`; poi **audit di `kit_requests`** (se sono uscite distinte PVC/battente a clienti reali, avvisare
gli agenti). Difetto collaterale segnalato e **non** corretto: `dedupeRows` last-wins in `map-product.ts`.
**✅ VERIFICA FINALE END-TO-END** (a chiusura sessione): ambiente montato in locale e **listino importato davvero**
(`import:agb` → 7.488 prodotti, +1.297 confermato), **integration test gated eseguito 5/5**, e distinte reali
generate coi prezzi veri — anta-ribalta **16 righe/21 pezzi/90,20 € zero warning** (il totale NON cambia con la
correzione), vasistas **13/19/90,59 € zero warning**, 3 forbici a LBB 1000 con supporto/perno fermi a 2, rifiuti
corretti per peso 75 kg / PVC / battente / aria 4; browser rifatto su DB vero a **375px e desktop**.
**PR #33 + #34 MERGIATE**; **AZIONI OPS ESEGUITE** (run «Ops — Neon» `30198585201`, 2026-07-26 11:00Z:
migrate + re-import 7.488 + seed kit + embed, 4 step verdi).
Spec/piano: `docs/superpowers/{specs,plans}/2026-07-25-kit-bonifica-artech-legno*`.
+ **KIT BILICO RETTANGOLARE TOUR ✅ (PR #35 MERGIATA, ops eseguite)**: terza
tipologia attiva e **prima serie non-ARTECH**. Scoperta chiave: il bilico non è una distinta di componenti
sciolti ma **4 kit + 2 aste** — le legende «Componenti» degli schemi generici `p0536 (534)`/`p0537 (535)`
stanno **dentro il disegno** (invisibili a `pdftotext`) e raggruppano tutto in quattro codici ordinabili; la
tabella di `p0538 (536)` è la loro **composizione**, non una lista d'ordine (provato con l'aritmetica: kit
incontri 43,95 € contro 44,12 € di contenuto dichiarato). Nasce **attivo** perché **61 codici su 61 sono a
listino con prezzo** (verificati con la firma di riga del parser reale; totale 7.488 = import su Neon).
**`kitInputSchema` diventa un'unione discriminata su `series`**: `kit.create` persiste ogni campo e
`kit.generate` **ricostruisce l'input rileggendo le colonne**, quindi la riga a DB *è* l'input di ogni
rigenerazione e campi solo `.optional()` avrebbero fatto nascere ogni riga bilico con la geometria ARTECH
addosso (la bonifica riaperta, spostata nella persistenza); l'unione **scarta** i campi estranei al ramo →
impossibilità strutturale, non una guardia. Deciso con **`/llm-council`** (5 advisor + peer review + chairman,
verificando le loro affermazioni nel repo: `z.discriminatedUnion` non ha davvero `.pick()`, ma è **falso** che
`finish` free-text sia un bug latente — `requireKey` solleva). Nuovo `from-request.ts` (ricostruzione per ramo,
ri-validata) · modulo `rules-tour-bilico-legno.ts` (schema 1-5 = unica chiave; mano e 3/4 lati **derivati**,
non scelti; asse 17,5 mai persistito) · **test di mutazione** `no-silent-fields.test.ts` (muta ogni campo di
ogni modulo attivo: output identico in silenzio = fallimento), che ha scovato **`openingDir` raccolto,
validato, persistito e mai letto da nessun modulo** (domanda 16). UI ramificata per serie, con lo schema
mostrato come geometria (listello · asse · battuta) e non come numero nudo, e superficie/lati echeggiati già
al passo delle quote. Gate verdi (typecheck·lint·**test 659**·build 17 route) + **integration gated 9/9 sul
catalogo reale** + **browser 50/50** (desktop e **375px**). Distinte reali: **450,03 €** (3 lati) ·
**766,51 €** (4 lati) · **433,46 €** (schema 3). **AZIONI OPS ESEGUITE** (run `30207287069`, 15:12Z, 12/12
step verdi: migrazione `20260726120000_kit_bilico_tour` applicata, import 7.488, template TOUR creato, embed
«niente da fare»); **resta solo la verifica funzionale in produzione**. Spec:
`docs/superpowers/specs/2026-07-26-kit-bilico-tour-design.md` · assunzioni e domande 11-16 in
`kit-assunzioni/tour.md` · audit `kit_requests` e mail per AGB **pronti da usare** in
`kit-assunzioni/DA-FARE-audit-e-domande-agb.md`.

+ **FIX «SEDE» — segnalazione dal campo ✅ (PR #37)**: un agente esperto, chiamato a verificare
un'anta-ribalta, **non ha saputo dire cosa fosse il campo «Sede»**. Non è ignoranza sua: il listino
chiama la stessa quota in due modi. La sede è l'**alloggiamento dell'incontro sul telaio**; è scritta
«sede telaio» nei titoli degli schemi, nella tabella microventilazione `p0474 (472)` e nel Galileo Pro
alluminio `p0877 (875)`, ma in **tutte** le tabelle degli incontri — quelle che l'agente guarda per
ordinare — non compare mai: è il **secondo numero** del token nella colonna ASSE (`9x18`, `13x24`,
`13x30`). E **non è derivabile** da aria+asse: per aria 12 esistono quattro formati, quindi «asse 13»
lascia due sedi possibili. Fix: etichetta → «**Sede telaio**» + hint col formato di listino (idem per
«Asse», l'altra metà del token), legati con `aria-describedby`; **`seatMm` da max 22 a max 30**, perché
il 22 tagliava fuori la **sede 30** — quella di *tutti* gli schemi base 2026 — e dava un errore di range
invece del messaggio del motore (si allarga ciò che è *scrivibile*, non ciò che è *generabile*).
Collaterale importante: estraendo tutti i formati dalle 959 pagine esistono solo `9x18`/`9x20`/`13x24`/
`13x30` — **`13x18` non esiste**, ma il pilota dichiara interasse 13 + sede 18 e monta la famiglia `.05`
(= 9x18): una delle due etichette è sbagliata dalla Fase 1d (non muove codici né i 90,20 €, ma è un dato
falso sulla richiesta). Domande 3b e 4 per AGB riscritte come **dimostrate**. Gate: typecheck·lint·**test
660**·browser **14/14** desktop e 375px. Nessuna migrazione, nessuna azione ops.

+ **SETTE GEOMETRIE REALI ✅ (PR #38 + #39 MERGIATE)**: un agente intervistato disse che il
generatore non era funzionale — verificato eseguendo il codice, i suoi **tre clienti principali
erano tutti rifiutati** (MC aria 4/interasse **8,5**/battuta 15, respinto da zod perché 8,5 non è
intero; Peruzzi aria 4/interasse 9/battuta 18; Fosca aria 12/interasse 13/battuta **18**), mentre
il motore copriva una **quarta** combinazione che nessuno dei tre ordina. **Causa radice: due
quote, un nome** — a `p0474 (472)` AGB pubblica due tabelle adiacenti, stessa pagina e stesse
famiglie, intitolate «sede telaio 18/24/30» e «BATTUTA 18/20/24/30»: «battuta» indica quindi sia
la battuta dell'anta (15/18/20 → `.22`/`.24`/`.26`/`.34`/`.36`) sia la sede telaio (18/20/24/30 →
`.05`/`.12`/`.CR`/`.MN`), e l'agente nomina solo la prima. Entrarono: `geometry: ArtechGeometry`
(7 valori) + `seatConfig` al posto di 4 campi numerici liberi · **sede derivata** e mostrata, non
più chiesta · tabelle di **codici interi** (`A50904.22` **non esiste**) · **ricalcolo versionato**
garantito nel router (una distinta emessa non si riscrive: se ne crea una nuova versione) · **gate
su catalogo reale**. Test **709**.
+ **ENTRATA MANIGLIA ✅ (PR #40 MERGIATA, ops eseguite)**, branch `claude/handoff-workflow-choice-u7hvc9`: chiude
l'ultimo parametro che il motore decideva da sé. La cremonese era cablata in **entrata 15**
(`A50122.15.NN`) dalla Fase 1d, senza guardia, perché il campo **non esisteva nell'input**: un
serramento a entrata 7,5 riceveva **in silenzio** il codice della 15 — che esiste, ha un prezzo e
non produce warning. Sul GR07 del golden vale **6,09 € su 90,20 €** (+38 % sulla riga).
**L'handoff descriveva l'asse sbagliato** («0, 8 e 15»): a `p0424 (422)` la colonna ENTRATA è
`1) 7,5` · `2) 15` · `3) Asta*` — `.08` è l'entrata **7,5** e `.00` **non è un'entrata** ma la
versione ad asta, senza DSS né monoblocco martellina; conferma trovata **nei dati** (il nome a
catalogo di `A50122.08.07` è «per schema A **1) 7,5**»). Cosa c'è: `entrata: "E75" | "E15"` sul
ramo ARTECH, **ortogonale** a `geometry` (un test prova che cambia SOLO la riga della cremonese) ·
**nessun valore preselezionato** — un default sarebbe lo stesso silenzio in un posto più visibile ·
tabelle di **codici interi** per entrata · colonna `kit_requests.entrata` nullable + backfill
`E15` sulle sole righe ARTECH · trasporto da **entrambe** le mutation (`create` **e** `ricalcola`) ·
rilettura **senza fallback** · **vasistas rifiuta** l'entrata 7,5 (due NB di `p0426 (424)` tolgono
le forbici su 4 GR su 6 senza indicare il sostituto) e il wizard **la disabilita** invece di farla
scegliere e fallire dopo · battente: `p0429 (427)` pubblica una sola entrata, l'asse lì non esiste.
**Chiuso anche il buco che aveva lasciato passare il bug**: le liste di `no-silent-fields.test.ts`
erano scritte a mano e nulla verificava che coprissero lo schema — ora un campo non dichiarato fa
fallire il test col proprio nome (e ha scovato subito che la vasistas ignora
`supplementaryClosures`, legittimo e ora dichiarato). Gate: typecheck·lint·**test 748**·build ·
**gate su catalogo reale 29 casi** · **browser 375px e desktop**. Distinte reali su catalogo
importato (7.488 prodotti): entrata 15 → **16 righe / 21 pezzi / 90,20 €** (golden invariato) ·
entrata 7,5 → **16 / 21 / 96,29 €**, cremonese `A50122.08.07`, zero warning. **AZIONI OPS ESEGUITE**
(run `30572337032`, 2026-07-30 19:11Z, 12/12 verdi: migrate `20260730160444_kit_entrata` + import
+ seed + embed). ⚠️ **Lezione pagata sul campo**: fra il merge (18:33Z) e la migrazione (18:53Z)
la produzione è rimasta **rotta venti minuti** — `kit.get` fa `findFirst` senza `select`, quindi
prima della migrazione fallivano le **letture**, non solo le creazioni. Alla prossima migrazione
il run ops parte **nella stessa finestra del merge**: scriverlo nella PR non basta.
Spec/piano: `docs/superpowers/{specs,plans}/2026-07-30-kit-entrata*`.

**▶ PROSSIMA SESSIONE — SCELTA FRA TRE STRADE.** L'entrata era la quarta di quattro ed è fatta.
Restano: **scontistica cliente** (la consigliata — oggi i totali sono il **lordo di listino AGB**,
non ciò che il cliente paga, e `Customer` ha già a schema `discount`/`priceList`/`paymentTerms`
inutilizzati) · **schemi cliente + composer chiusure** (§3.5-3.7 della spec 2026-07-29) · **varianti
componenti** (la spec le tiene fuori scope finché la distinta è incompleta). **Prima di scegliere**: la PR #40 è mergiata e le ops sono eseguite, quindi resta una sola
domanda — **sono arrivate le tre
distinte reali** di MC, Peruzzi e Fosca? Aperta da due sessioni, è la cosa che vale di più: senza,
i tre clienti principali ricevono distinte mai confrontate con un ordine vero, e la formula della
corsa delle chiusure resta una retta tirata per un punto solo. Debito noto e circoscritto: il gate
fissa `widthMm: 550` → esercita 1 banda su 5 di `FORBICI` e 1 su 4 di `BRACCI_GRUPPI` (chiusura ~15
righe, stessa forma del test appena scritto) · `no-silent-fields` non è legato a `RULE_MODULES` ·
`dedupeRows` last-wins. Dettagli, lezioni operative e prompt di apertura: `handoff.md`
§RIPRENDI DA QUI.

+ **SCONTISTICA CLIENTE ✅ (PR #42 MERGIATA, ops eseguite)**: i totali mostravano il
**lordo di listino AGB**, cioè quello che paghiamo al fornitore, non quello che il cliente paga. Workflow completo
(brainstorming → 4 domande all'utente → spec → `/writing-plans` → 10 task TDD → `/impeccable` → verifica browser).
**Scelte utente**: sconto **unico per cliente** · **modificabile anche a distinta generata** · righe **al lordo**,
sconto solo nel riepilogo · **avviso oltre soglia, mai blocco** · soglia **configurabile da ADMIN**.
**(1) Dati — una sola colonna**: `KitRequest.discountPercent Decimal(5,2)?` (migrazione `20260730201437_kit_discount_percent`,
nessun backfill: NULL = nessuno sconto = comportamento storico). Lo sconto vive **sulla richiesta** e non solo su
`Customer`: se stesse solo lì, ritoccarlo cambierebbe in silenzio il totale di **ogni distinta già mandata** — la
stessa ragione per cui il ricalcolo è versionato. `Customer.discount`, `KitRequest.customerId` e
`SettingCategory.COMPANY_INFO` **esistevano già** → nessun'altra migrazione. **`totalPrice` resta il LORDO**, il netto
è derivato e mai salvato (due totali a DB divergono al primo bug); il KPI «valore» in dashboard resta quindi al lordo.
**(2) Confine col motore**: `kit.create` passa da `kitInputSchema` nudo a **`{ specs, customerId? }`** — il commerciale
non entra nell'input che `kit.generate` ricostruisce dalle colonne; un test in `types.test.ts` prova che lo schema
**scarti** `customerId`/`discountPercent`. **(3)** `customer` router (list/create/update/delete con paletto sulle
richieste collegate, anagrafica **condivisa**) · `kit.setDiscount` ammessa in **qualunque stato** (rifiuta solo sulla
riga superata) · soglia in `Settings{COMPANY_INFO}` in chiaro. **(4) UI**: selettore cliente nel wizard (con
empty-state vero — in produzione l'anagrafica è **vuota**) · riepilogo `Totale listino AGB → Sconto → Totale cliente`
· sezione soglia in `/impostazioni`. **Bug trovati dai test e dagli screenshot, non dal codice**: `Number.isInteger(v*100)`
**rifiuta 40,55** (fa `4054.9999…`) → validazione in un posto solo; `42.5%` col punto in una UI italiana → `formatPercent`;
e a **375px la tabella scorre in orizzontale**, quindi il suo piè con i totali era **fuori schermo** → i totali sono
migrati nel riepilogo, che è l'unico posto in cui compaiono. Gate verdi (typecheck·lint·**test 843**·build 17 route) ·
**browser 40/40** (desktop + 375px) · **integration gated 38/38 sul catalogo reale** · golden **16 righe / 21 pezzi /
90,20 €** e gemello entrata 7,5 **96,29 €** invariati, verificati esplicitamente. **AZIONI OPS ESEGUITE** (run `30583325831`, 2026-07-30 21:41Z, 4/4 verdi: migrate
`20260730201437_kit_discount_percent` + import 7.488 + seed + embed «niente da fare»). Serviva la sola
migrazione; il workflow esegue comunque tutti e quattro i passi, idempotenti. Nuova **domanda 28** in `DOMANDE-APERTE.md`: il
listino ha **34 classi di sconto**, i codici ARTECH sono tutti **F3** e i TOUR tutti **T1** → una percentuale unica li
tratta uguali (scelta consapevole, da riverificare con l'ufficio commerciale).
Spec/piano: `docs/superpowers/{specs,plans}/2026-07-30-scontistica-cliente*`.

+ **PROFILO SERRAMENTO DEL CLIENTE ✅ (**PR #44 MERGIATA, ops eseguite**)**:
il wizard chiedeva **geometria ed entrata a ogni richiesta**, fra 14 combinazioni, e sbagliarle non produce alcun
errore — i codici dell'altra combinazione esistono a listino, hanno un prezzo, nessun warning. Ma quelle due quote
**non cambiano** fra un ordine e l'altro dello stesso cliente (i tre principali ne hanno una fissa ciascuno).
**(0) Un difetto già in produzione, trovato dal council mentre rispondeva ad altro**: `nuova-client.tsx:57` cablava
`geometry: "A12_I13_B20"`, la geometria del cliente del golden → **ogni nuovo ordine partiva con la geometria di un
altro cliente**. Tolto nel primo commit, isolato; **dieci test** navigavano al riepilogo senza scegliere la geometria
(uno asseriva perfino `checked === true`): erano la codifica del difetto, non la sua sentinella.
**(1) Dati**: due colonne nullable su `customers` (`kit_geometry`, `kit_entrata`, migrazione
`20260730232026_customer_kit_profile`, **nessun backfill**, nessun `CREATE TYPE`). Nessun modello nuovo: la tabella
separata della spec 2026-07-29 §3.5 aveva come unica giustificazione «più profili per cliente», e l'utente ha stabilito
**una linea a testa**. Lo **snapshot è già gratis** — `kit.create` scrive di suo geometria ed entrata sulla riga.
**(2) Confine col motore**: `kitInputSchema` **scarta** i due campi (due test), perché `kit.generate` rilegge le
colonne di `kit_requests` e un campo senza colonna lì farebbe divergere ogni rigenerazione.
**(3) La UI l'ha decisa il `/llm-council`** (5 advisor + 3 peer review), respingendo la mia proposta: precompilare
reintroduce un valore che l'agente **non ha scelto in quel momento**, con in più un'etichetta che lo fa *sembrare*
verificato — mentre il primo dato lo digita l'agente, dalla stessa memoria che è il punto di rottura. Sintesi adottata:
**nessun prefill, un pulsante «Usa il profilo»** — atto esplicito, e la regola della #40 regge alla lettera su
**entrambi** i campi. Etichetta onesta: *dichiarato in anagrafica, mai confrontato con un ordine*. **Guadagno non
richiesto**: al passo 4 il riepilogo **constata** la divergenza dal profilo (non blocca: non sappiamo quale delle due
dichiarazioni sia giusta) — è il **primo rilevatore d'errore** che il sistema possieda.
**(4) Pagina `/clienti`**, che chiude anche il buco per cui `customer.update`/`delete` esistevano nel router **senza
essere raggiungibili da alcuna schermata**: un cliente, una volta creato, non era più correggibile. Nessun gate ADMIN
(anagrafica condivisa, `agentProcedure`). **(5) Debito chiuso**: il gate su catalogo reale fissava `widthMm: 550` e
verificava **10 dei 40 codici braccio** → 5 larghezze × 7 geometrie × 2 mani + una **guardia** contro il calo silenzioso
di copertura; da **29 a 100 casi**, tutti verdi. E il golden ora è **asserito davvero** (`16 righe / 21 pezzi /
90,20 €`, gemello `96,29 €`): prima il gate diceva `totalPrice > 0`.
**(6) Fuori scope motivato — nuova domanda 29**: l'«**incontro nottolino incassato**» chiesto dall'utente **non è
mappabile a un codice** (la parola compare 2 volte in 959 pagine, entrambe fuori contesto). Il listino pubblica però
**tre assi che il motore cabla senza chiederli**: il **corpo** (`A51400.05.02` piastrina vs `A51400.05.13` corpo pieno,
stesso formato 9x18, stesso prezzo, p0469 (467) voci 2 e 4 del **disegno**) · i **perni di posizionamento** (`A52200.*`,
su nottolino/ribalta/DSS) · l'**antieffrazione** (p0470 (468), pagina **non citata** fra le fonti del modulo, 2-3 €
contro 0,81). Due indizi si contraddicono (la mano DX/SX indica l'antieffrazione, non il corpo; «fresatura» è la
geometria aria 4, non una variante) e il `.13` richiede la copertura della **domanda 20** → **non si indovina**.
Circostanziata anche la 20: i codici che fanno scattare la copertura sono `A51400.CR.13` (Fosca) e i ribalta
`A51400.05.70`/`.CR.70`, **entrambi** marcati `*` — il primo è quello del **golden**, che essendo un ordine reale a 16
righe **non si tocca** su questa base. Gate verdi (typecheck·lint·**test 875**·build 18 route) · **integration gated
100 casi** · **browser 30/30** (desktop e **375px**, 24 screenshot guardati — è così che è saltato fuori lo sconto
precompilato «42.5» col punto in una UI italiana, con 30 check verdi).
**AZIONI OPS ESEGUITE** (run `30614027728`, 2026-07-31 08:02Z, 12/12 verdi): migrazione
`20260730232026_customer_kit_profile` applicata **quattordici minuti PRIMA del merge**, lanciando «Ops — Neon» sul
**ref del branch** — prima volta con finestra di disservizio **zero** (#40 ne aveva venti minuti, #42 qualcuno).
Spec/piano: `docs/superpowers/{specs,plans}/2026-07-30-profilo-serramento-cliente*`.

+ **ANAGRAFICA COMPLETA ✅ (PR #45 MERGIATA, ops eseguite)**: la `/clienti` della #44 aveva elenco, modifica ed
eliminazione ma **non la creazione** — con l'anagrafica vuota, che è lo stato del primo giorno, l'unico modo di
aggiungere un cliente era **iniziare una richiesta kit e poi abbandonarla**. Una pagina «Clienti» da cui non si creano
clienti; l'ha visto l'utente, non i test, perché nessuna asserzione può accorgersi di un pulsante mai pensato.
**(1) Pulsante «Nuovo cliente»**, presente anche nell'empty-state. Il form è **lo stesso** della modifica, non un
secondo: l'unica differenza vera vive in tre righe di `salva()` — in **creazione** i campi vuoti si **omettono**
(`customer.create` li vuole `.optional()`), in **modifica** si mandano a **`null`** (`update` distingue «azzera» da
«non toccare»); un test per ciascun verso. **(2) I tre clienti principali in anagrafica**: MC (`A4_I85_B15`), Peruzzi
(`A4_I9_B18`), Fosca (`A12_I13_B18`) — le stesse geometrie già usate come fixture nei test del motore. Stanno nel
**seed** e non in uno script a parte (app mono-azienda, `pnpm db:seed` gira già a ogni run ops → zero step nuovi),
con `upsert`/`update: {}` su `customerCode`: **crea se manca, non tocca se c'è**, verificato sul DB vero ritoccando
a mano sconto ed entrata e rilanciando — il ritocco sopravvive, il conteggio resta 3. Serve perché il workflow rigira
a ogni deploy. **(3) Entrata e sconto restano NULL, con un test che lo protegge**: l'entrata è la **domanda 17**,
ancora aperta, e inventarne una nel profilo di un cliente vero sarebbe lo stesso difetto chiuso dalla #44 in un posto
più difficile da vedere. Gate: typecheck·lint·**test 883**·build · **browser 22/22** (desktop e 375px).
**Nessuna migrazione**; **AZIONI OPS ESEGUITE** (run `30618326143`, 09:15Z, 12/12 verdi: `db:seed` → i tre clienti
creati su Neon).

+ **ANTIEFFRAZIONE + VARIANTI COMPONENTE ✅ (branch `claude/antieffrazione-feature-dv8d37`, PR DA APRIRE)**:
l'utente ha chiesto l'antieffrazione per l'anta-ribalta. Preparandola erano emerse **due domande a cui il listino non
risponde** (il «nottolino a fungo» va su serramenti sede 30? gli incontri si ordinano a viti inclinate o dritte?), e
la risposta dell'utente ha riorientato il lavoro: «*non saprei risponderti … ha senso aggiungere una sezione finale
nel wizard, per far scegliere in modo semplice e visivo, quando ci sono più scelte per uno o più componenti che non
dipendono dallo schema dello sviluppo del kit ma da una scelta personale*». Le due domande sono quindi state
**risolte non rispondendole**: sono diventate **scelte nella UI** — nuovo passo **«Componenti»**, con codice, nome a
catalogo, prezzo e differenza davanti. È la **settima** volta che il progetto incontra «una decisione che il motore
prende da sé e non dichiara» (`openingDir`, entrata, geometria, `PILOT_GEOMETRY`, il default `A12_I13_B20`): le
prime sei sono state chiuse una alla volta, **questa chiude la classe**. **Domande 2 (squadra angolare) e 30
(antieffrazione) CHIUSE** — la risposta di merito ora sposterebbe il *default*, non i codici disponibili.
**(1) Registro `artech-varianti.ts`**: cinque varianti (squadra angolare · incontro ribalta · movimento angolare ·
incontri nottolino · piastrino), **74 codici scritti per esteso** e verificati sul catalogo reale dal gate — mai
concatenati, perché `A50904.22` **non esiste** ed è la prima cosa che una formula produrrebbe (è il difetto che ha
fatto disattivare PVC e battente). La **disponibilità è la tabella**: l'interasse 8,5 di MC vede **due** squadre, le
altre sei geometrie quattro; e per l'**aria 4** il listino pubblica **solo le viti inclinate**, quindi per MC e
Peruzzi le dritte **non compaiono affatto**. **(2) Una sola colonna**: `kit_requests.variants JSONB` (migrazione
`20260731143758_kit_variants`, **solo** `ALTER TABLE … ADD COLUMN`, nessun backfill, nessun `@default` a DB:
**`NULL` = «lo standard del programma»**). Sta nel **ramo ARTECH** dell'unione discriminata, così una riga TOUR non
può portarsi addosso varianti ARTECH. **(3) Il «fungo» resta FUORI, ed è collocazione non rinuncia**:
`A50320.02.01` sta nel capitolo Movimenti Angolari (quindi *sostituisce* un movimento angolare) e il listino lo lega
alla **sede 30 nei due versi** (NB a p0435 (433); nota `(**)` stampata solo sulle righe `13x30` a p0469 (467)) — la
sede 30 il motore la rifiuta a monte: è una **famiglia di schemi diversa**, entrerà con la **domanda 4**. Il
**movimento angolare a due nottolini** invece è entrato e non era nella richiesta dell'utente: **l'ha aggiunto il
listino** (NB stampata). **(4) Garanzia in due strati contro la variante inerte**: `RuleModule.varianti`
**obbligatorio** (un modulo nuovo non compila senza averci pensato) e il motore **rifiuta a runtime**, col nome della
variante, una richiesta che ne porti una non dichiarata; `no-silent-fields` deriva i casi **dalla dichiarazione del
modulo** con una mutazione **per chiave**, quindi una variante che smettesse di essere letta fa fallire il test **col
proprio nome** (provato mutilando il modulo). **(5) Ciclo di import reale** fra `types.ts` e `artech-varianti.ts`,
che si manifestava **solo con certi ordini di caricamento** della suite: sciolto col file foglia
`src/server/kit/varianti-schema.ts` (solo zod), **protetto da una regola ESLint provata nei due versi**.
**(6) Due difetti trovati dalla review e corretti**: la potatura al cambio geometria **materializzava a DB uno
standard** che una richiesta identica scriverebbe `NULL`; e «prezzo non a catalogo» — un'affermazione **sul listino
AGB** — veniva detta mentre la query stava ancora caricando. **Il golden non si è mosso**: **16 righe / 21 pezzi /
90,20 €**, gemello entrata 7,5 **96,29 €**; novità, ora sono asseriti anche l'**ordine assoluto delle righe** e le
**16 descrizioni carattere per carattere**. Con l'**antieffrazione completa**: **17 righe / 22 pezzi / 110,13 €**,
zero warning. Gate verdi (typecheck·lint·**test 992**·build 18 route) · **integration su catalogo reale 111 test
eseguiti** · **browser 33 + 10 check** (Chromium desktop e **375px**, screenshot guardati).
**🔴 AZIONE OPS**: un run di «Ops — Neon» **sul ref del branch, PRIMA del merge** — `kit.get`/`generate`/`ricalcola`
leggono con `findFirst` **senza `select`**, quindi fra deploy e migrazione fallirebbero le **letture** delle
richieste, non solo le creazioni (è alla lettera l'incidente da venti minuti della PR #40). **Il raggio è più largo
di «le richieste»**: anche `src/server/api/routers/dashboard.ts:40` fa `kitRequest.findMany` **senza `select`**,
quindi si rompe pure **`dashboard.overview`**, cioè la **pagina d'ingresso di tutti e dieci gli agenti** — nessuno
scarto fra merge e migrazione è tollerabile. **Nessun re-import necessario**: i 74 codici sono già tutti a catalogo
con prezzo. **Le varianti NON si possono cambiare dopo la creazione** (`kit.ricalcola` le eredita verbatim,
`kit.ts:249-252`; nessuna mutation le modifica): per cambiarle si rifà il wizard da capo — **va detto agli agenti
insieme alla feature**; il seguito è un `variants` opzionale in input a `ricalcola`. Debito noto: `nuova-client.tsx` è a **1.979 righe**
(i ~330 del passo «Componenti» sarebbero estraibili in `src/components/kit/`); «Visualizza nel listino» **per
singola opzione omesso** (un `<button>` dentro il `<label>` di `RadioOption` è HTML non valido e ruberebbe il clic
alla radio: servirebbe spezzare `RadioOption`); `dedupeRows` last-wins in `map-product.ts`; preview Vercel rotte su
ogni PR. Spec/piano: `docs/superpowers/{specs,plans}/2026-07-31-varianti-componenti*`.

+ **VARIANTI MODIFICABILI DOPO LA CREAZIONE ✅ (branch `claude/verifica-distinte-reali-8zz9mw`,
PR da aprire)**: la #47 lasciava un difetto dichiarato — le cinque varianti del passo «Componenti»
**non si cambiavano più** dopo la creazione, si rifaceva il wizard da capo. Ora sulla scheda c'è
**«Modifica componenti»**, che riapre il wizard precompilato; al conferma nasce una **nuova
versione**. **(0) La verifica funzionale della #47, fatta per prima, ha scoperto un buco**:
`110,13 €` **non era asserito da nessun test** — il test del modulo conta righe e pezzi ma **non
vede i prezzi affatto** (i moduli restituiscono `KitLine` senza prezzo, che il motore risolve dopo
contro il catalogo), quindi il numero viveva solo nei `.md`. Chiuso nel primo commit, insieme ai
**tre totali bilico** che stavano ancora dietro un `toBeGreaterThan(0)` (450,03 · 766,51 · 433,46,
ri-misurati e identici alla #35). **(1) Contratto** deciso col **`/llm-council`** (5 advisor
unanimi + 3 peer review): `ricalcola({kitRequestId, variants?})` — assente = **eredita** · `{}` =
**reset** allo standard (scrive `NULL`) · oggetto = **sostituzione integrale**, mai un merge. Il
reset non è inventato: le 5 chiavi erano già `.optional()` in uno `.strict()`, quindi `{}` era già
valido; **dichiararlo** è ciò che impedisce all'operazione di essere a senso unico. **(2) Solo
«Componenti» è editabile**, e non per prudenza ma per il tipo: la firma **congela la geometria**,
quindi la combinazione geometria/varianti mai validata è **irrappresentabile**, non «sconsigliata»
— le due alternative (un diff che sceglie fra versione e richiesta nuova; `ricalcola` che accetta
l'intera `specs`) aprivano un **secondo percorso di scrittura** su `specs`. **(3) Validazione prima
di ogni scrittura**, ed è il **motore eseguito in memoria**: le varianti disponibili dipendono dalla
geometria e quel controllo vive nei moduli, quindi un secondo validatore avrebbe potuto
disallinearsi dalle tabelle dei codici. **(4) L'idratazione passa da `kitInputFromRequest`**, la
stessa funzione del motore (possibile perché **solo `engine.ts` ha `server-only`**): un prefill che
rileggesse le colonne per conto suo sarebbe una seconda ricostruzione, e se divergesse l'agente
confermerebbe a schermo una configurazione che la riga non codifica. **(5)** «Ricalcola» →
**«Nuova versione»** (la parola prometteva «rifai lo stesso conto» mentre emette un documento con un
numero nuovo), rinominata anche nelle due stringhe che la citavano altrove. **(6)** `ComponentiRibalta`
e `RadioOption` estratte in `src/components/kit/` — insieme, perché estrarre solo la prima avrebbe
chiuso un **ciclo** wizard→componenti→wizard; `nuova-client.tsx` da 1.983 a 1.383 righe. **Difetti
colti dai test**: `variantiFinali ?? request.variants` faceva ricadere il **reset**
sull'ereditarietà (`??` tratta `null` come nullish) — spegnere l'antieffrazione non avrebbe fatto
nulla in silenzio. **Quattro trovati dalla review di branch, coi gate tutti verdi**: (a) un
**refetch** di `kit.get` cancellava le varianti appena scelte — lo structural sharing di
react-query non regge sulle `Date` e il `QueryClient` è nudo (`staleTime: 0` +
`refetchOnWindowFocus`), quindi bastava cambiare finestra → idratazione **una volta sola**;
(b) la validazione copriva solo il ramo con `variants`, mentre «Nuova versione» chiama `ricalcola`
**senza**: su una riga PVC/battente già emessa nascevano **due righe morte** → si valida ogni volta
che si sta per scrivere; (c) su una **bozza** la UI prometteva una versione che non nasce (il
router scrive in loco); (d) la **vasistas** passava il filtro per serie pur non avendo varianti →
si filtra sulla **tipologia**, con un test in `registry.test.ts` che fallisce se un modulo cambia
idea. Gate verdi (typecheck·lint·**test 1.035**·build 18 route) · **catalogo reale 112
test** · **browser 22/22 desktop e 22/22 a 375px**, col ciclo intero 90,20 → 110,13 → **ritorno a
90,20** (la prova che il reset funziona). **🟢 NESSUNA MIGRAZIONE, NESSUNA AZIONE OPS.** Nuova
**domanda 31**: il numero di richiesta identifica la richiesta o la versione? (`count()+1` su
colonna `@unique`; verificato che nessun `kitRequest.delete` esista, quindi la collisione
deterministica non è raggiungibile). Spec/piano:
`docs/superpowers/{specs,plans}/2026-08-01-varianti-dopo-creazione*`.
