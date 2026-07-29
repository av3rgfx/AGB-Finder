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

**▶ PROSSIMA SESSIONE — PERFEZIONARE L'ANTA-RIBALTA.** Il pilota copre **UNA SOLA** configurazione
(aria 12 / interasse 13 / battuta 20 / sede 18) e un agente vero si è già visto **rifiutare** una
finestra legittima (700×1400, battuta 18, **sede 30**) — rifiuto corretto, ma la sua configurazione è
a listino ed è **più coerente della nostra**: `asse 13 + sede 30` = formato `13x30`, che esiste, mentre
`asse 13 + sede 18` non esiste in 959 pagine; e per la sede 30 c'è una **pagina-schema stampata**
(`p0406 (404)`), per la sede 18 no. **Mappa delle dipendenze ricostruita** (in `handoff.md`): cremonese
← **entrata** × HBB · braccio forbice ← **battuta × interasse** (suffisso `.34` = battuta 18/interasse 13,
`.36` = battuta 20/interasse 13) · squadra angolare ← **aria × battuta** · supporto cerniera ← **aria ×
interasse × battuta** · incontri ← **aria × (asse × sede)** · fusto/movimento/supporti/coperture/chiusure
non toccati. **Coprire battuta 18 + sede 30 costa cinque codici**, tutti già a listino e prezzati
(`.36`→`.34`, `A50805.05`→`A50804.05`, squadra riga aria 12/battuta 18, incontri `.05`→`.MN`): **non serve
attendere AGB**, manca solo il riscontro di una distinta reale. **🔴 SCOPERTA — quinto parametro mai
notato: l'ENTRATA.** Il cremonese esiste in entrata **0/8/15** e il motore usa sempre la **15 cablata**,
senza guardia, perché il campo non esiste nell'input: un serramento entrata 8 riceve **in silenzio** il
cremonese sbagliato. Stessa classe di bug della bonifica, sopravvissuta dove nessuno guardava. Resta poi
il confronto voce-per-voce con `p0406 (404)`: **22 voci a schema, 16 posizioni emesse**, sei senza
corrispondenza (2 DSS · 9 doppio nottolino a fungo · 17 microventilazione · 19-20 spessori di sollevamento ·
22 copertura incontro). **Non rompere il golden: 16 righe / 21 pezzi / 90,20 €.** Domande in parole semplici
per un agente esperto: `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md` (la **16** — se esiste una
distinta reale per battuta 18/sede 30 diventa il **secondo golden**). Prompt di apertura, tabelle e lezioni
operative: `handoff.md` §RIPRENDI DA QUI.
