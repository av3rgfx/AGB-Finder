# Handoff — UFPtrade WebApp

> Creato/aggiornato da Claude alla fine di ogni sessione per riprendere il lavoro
> senza perdere contesto. (Regola permanente: aggiornare tutti i `.md` a fine sessione.)

---

## Sessione attuale

| Campo | Valore |
|-------|--------|
| **Data** | 2026-07-10 |
| **Fase in corso** | Fase 1 — MVP Gestionale |
| **Sotto-fase** | 1a ✅ · Better Auth ✅ · 1b ✅ · 1c Chat AI ✅ · **1d Kit engine ✅** · **1e Dashboard dati reali ✅ (PR #9)** · **Gestione API key admin ✅ (PR #10)** · **1f Deploy staging 🔄 IN CORSO (app live su Vercel; manca il popolamento del DB via pipeline ops)** |
| **Branch git** | `claude/handoff-md-review-6vyafm` (ripartito da `origin/main`). PR #11 (riallineamento handoff + spec/piano 1f + Task 1–4) e PR #12 (bump Next 15.5.20) **mergiate**. Questo aggiornamento handoff va su una nuova PR. |
| **Piano eseguito** | 1c/1d/1e/API-key (vedi sotto) · **`docs/superpowers/plans/2026-07-10-fase1f-deploy.md` (1f, Task 1–4 [CLAUDE] ✅ mergiati; Task 5–9 in corso)** |

> **▶ RIPRENDI DA QUI (Fase 1f — deploy staging, IN CORSO).**
> L'app è **LIVE** su Vercel: **https://catalogo-finder-kappa.vercel.app** (piano
> Hobby). Neon + Upstash collegati; workflow ops/CI su `main`; Next bumpato a
> **15.5.20** (Vercel blocca le versioni vulnerabili — vedi Problemi).
> **MANCA il popolamento del DB**: la **pipeline ops (Task 7) NON è ancora stata
> lanciata** → Neon è **vuoto** (niente tabelle né admin) → **il login NON funziona
> ancora** (è atteso).
> **➡ PROSSIMO PASSO: GitHub → Actions → _Ops — Neon_ → Run workflow → branch `main`.**
> Fa `migrate deploy` → `import:agb` (6.191) → `db:seed` (admin) + `db:seed:kit` →
> `embed:products` (billing Gemini attivo → gira intero, ~10–20 min).
> Poi **login**: `admin@ufptrade.local` / password = valore del secret
> **`SEED_ADMIN_PASSWORD`** (nel password manager — NON nel repo). Infine Task 8
> (verifica e2e) e Task 9 (chiusura docs). Dettagli: sezione «Fase 1f» sotto.

## Stato attuale in breve

- **Fase 1c (Chat AI) implementata al completo, TDD, tutti i gates verdi**:
  `typecheck` · `lint` · `test` (137 passed + 6 integrazione/gated) · `build`.
- Verificata nel **browser** (Playwright, senza key): login → `/assistente`,
  stato vuoto con 3 prompt, invio → bolla utente + bolla errore «Assistente non
  configurato.» con «Riprova» (rigenera senza duplicare), dropdown conversazioni,
  titolo dal primo messaggio, pannello prodotti con stato vuoto. `/archivio`
  continua a funzionare (ramo testuale).
- Integrazione pgvector verificata su Docker: `storeEmbeddings` + ricerca ibrida
  con `FakeEmbeddingService` → `vectorScore > 0`.
- **E2e con key reale (2026-07-04, key Gemini fornita dall'utente, solo in `.env`):**
  - Listino re-importato nel container (6.191/22, identico alla 1b).
  - **Chat reale verificata nel browser**: tool-use multi-round (ricerca filtrata
    → 0 → retry senza filtri nello stesso turno), codici reali citati in mono,
    4 schede nel pannello, messaggi TOOL/ASSISTANT a DB con modello/token/latenza
    (2–5s a quota libera; 1–2 min sotto 429 con retry+backoff del gateway).
  - **Ricerca ibrida reale verificata** (900 embedding reali): «maniglia con
    chiave per anta ribalta» → ramo testuale 0 hit, ramo vettoriale trova i 5
    A50107* giusti (vec≈0.72); prefisso codice `A50122` resta dominante.
  - **Tuning da e2e** (commit dedicati): system prompt (retry immediato senza
    filtri, niente markdown), descrizioni tool (filtri restrittivi), batch
    embedding 100→50 (il free tier rifiuta sistematicamente le richieste da 100).
- **RICICLO CONTAINER (2026-07-04 ~07:00Z)**: l'ambiente remoto è stato
  ricreato → persi `.env` (con la GEMINI_API_KEY), il DB Docker (catalogo +
  **i 900 embedding reali**) e i loop in scratchpad. Il codice era tutto
  pushato: nulla di perso lato git.
- **Ambiente RICOSTRUITO nella sessione del check (2026-07-04)**: install +
  engine Prisma + Docker/Postgres/Redis + migrazioni + seed + **re-import
  listino 6.191/22** (PDF dal link registrato) + suite verde (137 passed).
  Manca SOLO la key in `.env`.
- **SECONDO RICICLO (2026-07-04 ~10:30Z)** + ricostruzione bis: key utente in
  `.env` (e nel transcript sessione: ripristinabili senza richiederle),
  re-import 6.191/22, loop embedding avviato → **fermo a 1.000/6.191: cap
  giornaliero free-tier ~1.000 contenuti confermato al centesimo**. Il trickle
  multi-giorno NON sopravvive ai ricicli (2 in un giorno): le opzioni vere sono
  **billing sulla key** (catalogo intero ≈ centesimi, minuti) o rimandare a
  Neon (1f). Chat e ricerca testuale funzionano comunque.
- **Key Kimi fornita = prodotto "Kimi Code"**: 401 su api.moonshot.ai/.cn —
  per il fallback serve una key della **Moonshot API platform**
  (platform.moonshot.ai). Fallback non attivo, chat su sola Gemini.
- **Raccomandazione persistenza key**: variabili d'ambiente dell'environment
  Claude Code (impostazioni web) — sopravvivono ai ricicli; mai nel repo.

## Fase 1c — cosa è stato costruito

| Componente | File | Note |
|---|---|---|
| CircuitBreaker | `src/server/ai/breaker.ts` | 5 fail/60s → open 30s; stato SOLO su Redis; TTL scaduto = half-open |
| RateLimiter | `src/server/ai/ratelimit.ts` | finestra fissa; 20 msg/min/utente + cap 60 RPM/provider |
| RedisLike + client | `src/server/ai/redis.ts` | ioredis lazy; interfaccia minima iniettabile; `src/test/fake-redis.ts` per i test |
| Errori tipizzati | `src/server/ai/errors.ts` | messaggi italiani; `ProviderHttpError.status` guida retry/fallback |
| ChatProvider | `src/server/ai/providers/{types,gemini,kimi}.ts` | solo fetch (NO SDK); Gemini `generateContent` v1beta, Kimi OpenAI-compatible |
| **AIGateway** | `src/server/ai/gateway.ts` | UNICO punto uscita AI: rate limit → breaker → timeout 30s + 1 retry jitter su 429/5xx → fallback Gemini→Kimi; `embedQuery` (3s, null su errore); `getAIGateway()` singleton da env |
| RAGEngine esteso | `src/server/ai/rag.ts` | + `listUnembedded`/`storeEmbeddings` (resta l'unico modulo raw SQL); degrado try/catch su embedding; **niente più `server-only`** (riuso da tsx) |
| Embedding batch | `src/server/ai/embedding.ts` + `product-text.ts` + `scripts/embed-products.ts` | `generateBatch` ≤100, `HttpStatusError`, backoff exp; `pnpm embed:products` idempotente (pagina su `embedding IS NULL`) |
| Tool chat | `src/server/chat/tools.ts` | `search_products` (limit ≤10, filtri) + `get_product_by_code`; errori come output al modello |
| ChatService | `src/server/chat/service.ts` | USER persistito PRIMA della chiamata; loop tool cap 5 → round finale forzato senza tool; TOOL/ASSISTANT con metadati; errore → ASSISTANT `ERROR` (RateLimited → rilanciata) |
| Router chat | `src/server/api/routers/chat.ts` | create/list/get/send/retry/archive (AGENT, ownership); ActivityLog; RateLimited → `TOO_MANY_REQUESTS` |
| Ricerca ibrida attiva | `product.search` | `new RAGEngine(ctx.db, getAIGateway().queryEmbeddings())`; senza key → testuale, mai rotta |
| UI Assistente | `src/app/(dashboard)/assistente/` + `src/components/chat/` | split 60/40 (DESIGN.md), bolle con codici mono, pannello prodotti con copia+link, dropdown conversazioni, «Sta scrivendo…», errore inline con Riprova |
| maxDuration | `src/app/api/trpc/[trpc]/route.ts` | `export const maxDuration = 120` |
| CLAUDE.md | regola emendata | **AIGateway al posto di BullMQ** (LLM Council 2026-07-02) |

### Decisioni prese durante la 1c (delta vs spec/piano)
- **Budget per-provider = 60 RPM** (cap di sicurezza globale, non 15): col budget
  sotto il limite utente il rate-limit utente non era mai raggiungibile.
  Saltare tutti i provider SOLO per budget → `RateLimitedError` (non
  «non disponibile»).
- **Rate limit → nessun messaggio ERROR in DB**: `send`/`retry` rilanciano come
  `TOO_MANY_REQUESTS`; la UI mostra banner errore con «Riprova» (stesso esito, meno stato).
- **`retry` = procedura dedicata**: cancella gli ASSISTANT `ERROR` e rigenera dalla storia.
- **Storia per il modello**: solo USER/ASSISTANT `SENT` (i round TOOL restano in DB, non nel prompt).
- **Fix dipendenze (Task 0)**: pnpm risolveva `@better-auth/core@1.6.23` contro
  il peer `better-call@1.1.8` (trascinato dalla vecchia `@better-auth/cli`) →
  import di better-auth rotto. **Override pnpm**: `better-call@1.3.7`,
  `@better-fetch/fetch@1.3.1`.
- Bolla ottimistica utente con stato `pendingContent` (copre anche la fase di
  `chat.create` alla prima domanda).

## Fase 1d — cosa è stato costruito

Kit deterministico (**MAI LLM**), pilota **ARTECH anta-ribalta LEGNO**, 8 task
TDD (piano `docs/superpowers/plans/2026-07-04-fase1d-kit-engine.md` +
emendamento `2026-07-04-fase1d-emendamento-legno.md`). Golden: 550×1820mm,
SX, TIRARE, aria 12, asse/interasse 13, battuta 20, sede 18, ARGENTO →
**16 righe / 21 pezzi**, verificato sia in unit (prodotti fake) sia in
integrazione sul catalogo reale (6.191 prodotti, listino 2026) sia nel
browser end-to-end.

| Componente | File | Note |
|---|---|---|
| Tipi/contratto | `src/server/kit/types.ts` | `kitInputSchema` (zod, generico — nessun campo ARTECH-specifico); `KitLine`/`RuleModule`/`KitGenerationError`; costanti `PILOT` (FINESTRA, verticali passo 600, coperture KIT) |
| Regole ARTECH legno | `src/server/kit/rules-artech.ts` | Tabelle dati `as const` (cremonese per range altezza, corpo forbice per range larghezza, bracci per gruppo larghezza, coperture per finitura+mano) + funzioni pure per quantità; ogni scelta non derivabile con certezza è marcata `// ASSUNZIONE` (vedi Decisioni) |
| Registry | `src/server/kit/registry.ts` | Puntatore `{engine, version}` → `RuleModule`; engine non registrato/puntatore malformato → errore esplicito |
| Seed template | `prisma/seed-kit.ts` (`pnpm db:seed:kit`) | `KitTemplate` "ARTECH anta-ribalta legno" attivo, idempotente |
| **KitEngine** | `src/server/kit/engine.ts` | Pipeline VALIDATE → SELECT TEMPLATE (DB, priority) → APPLY RULES (registry) → risoluzione prezzi da `Product` (Prisma, no raw SQL); codice non a listino → warning esplicito, kit comunque generato |
| Router kit | `src/server/api/routers/kit.ts` | `create`/`generate`/`get`/`list` (AGENT, ownership, transazione su `generate`, ActivityLog `KIT_REQUEST_CREATED`/`KIT_GENERATED`) |
| UI Richieste | `src/app/(dashboard)/richieste/` + `src/components/kit/` | Lista con stato vuoto+CTA, dettaglio con `DistintaTable` (codici mono+copia) e banner warning, wizard `/nuova` 4 step (tipologia → dimensioni → mano/finitura → riepilogo) con default LEGNO |
| Test integrazione | `src/server/kit/engine.integration.test.ts` | Gated `INTEGRATION_DATABASE_URL`; risolve i 16 codici sul catalogo reale, zero warning, tutti prezzati, `totalPrice > 0` |

### Decisioni 1d (delta vs spec/piano)
- **Pivot golden ALLUMINIO → LEGNO** (Task 0): la gamma «ad applicare» ALLUMINIO
  della distinta reale 2021 non esiste più nel listino 2026 (9/20 codici
  sopravvissuti a DB, gli 11 mancanti sono tutti profilo-specifici — nemmeno i
  prefissi esistono). Il capitolo ARTECH 2026 è completo per LEGNO → pilota
  spostato su ARTECH anta-ribalta LEGNO; struttura/quantità della distinta
  reale restano identiche (16 righe/21 pezzi), i codici profilo-specifici sono
  rimappati sugli equivalenti legno 2026.
- **ADR council — regole "a forma di dati" in TypeScript, non JSON a DB**
  (`docs/superpowers/specs/2026-07-04-fase1d-kit-engine-design.md`): con n=1
  distinta reale, progettare oggi uno schema JSON generico è wrong abstraction
  garantita — le tabelle a range sono banali in qualsiasi rappresentazione, sono
  le *formule* a discriminare. **Trigger di migrazione registrato**: alla 2ª
  serie si rivaluta, alla 3ª si estrae il vocabolario comune in
  `KitTemplate.rules`. `KitTemplate` resta comunque vivo come
  registro/dispatcher (puntatore versionato `{engine, version}` validato zod).
- **Gap di catalogo — supporto-cerniera (`A50801.01.xx`)**: il listino 2026
  non ha una variante "Supporto cerniera — Parte telaio" per aria 12/interasse
  13/battuta 20 (i parametri del golden); esistono solo due varianti "Aria 4"
  (`A50801` int.9/battuta18, `A50803` int.8,5/battuta15). Pinnato `A50801`
  (più vicino su entrambi gli assi di confronto) — **da verificare con AGB**
  prima di fidarsi in produzione: potrebbe mancare a catalogo un codice
  interasse13/battuta20 dedicato.
- **Formula quantità incontri-nottolino, non dati `colonne.'not.'`**: verificata
  l'ipotesi data-driven (somma dei `colonne.'not.'` dei componenti mobili
  selezionati) sui dati reali → non regge (il fusto forbice ha `not."="-"`,
  somma pesata darebbe 4 ≠ 5 atteso). Si usa la formula ASSUNZIONE del piano
  originale (`2 + scatti passo 600 in altezza + scatti passo 600 in
  larghezza`), che riproduce esattamente il golden.
- **Finiture coperte nel pilota: solo ARGENTO** (`COPERTURE_KIT` in
  `rules-artech.ts`); il wizard mostra solo ARGENTO come opzione selezionabile
  (`FINISH_OPTIONS`, duplicato manuale — annotato come minor in review Task 7).

## Fase 1e — cosa è stato costruito (merge PR #9, 2026-07-06)

Dashboard `/dashboard` da placeholder statico a **dati reali via tRPC**, TDD,
nessuna modifica a `schema.prisma`. Spec `docs/superpowers/specs/2026-07-06-fase1e-dashboard-dati-reali-design.md`,
piano `docs/superpowers/plans/2026-07-06-fase1e-dashboard-dati-reali.md`.

| Componente | File | Note |
|---|---|---|
| Helper fuso | `src/lib/format.ts` (`startOfTodayRome`) | Mezzanotte odierna a **Europe/Rome** (DST inclusa) → confine "oggi" per i KPI; niente nuove dipendenze |
| Router dashboard | `src/server/api/routers/dashboard.ts` (`overview`) | `protectedProcedure` (AGENT+); input `{ scope: mine\|team }`, **server autoritativo** (non-ADMIN forzato a `mine`); `Promise.all` di `count`/`findMany` Prisma (no raw SQL); output KPI (richieste, kit generati con `generatedAt != null`, conversazioni, prodotti cercati — total + oggi) + ultime 5 richieste con cliente/prezzo |
| Client dashboard | `src/app/(dashboard)/dashboard/dashboard-client.tsx` | react-query; toggle **"I miei / Team"** solo se ADMIN; 4 StatCard con "+N oggi"; sezione ultime richieste (link a `/richieste/[id]`); card **Scorciatoie** (assistente/nuova richiesta/archivio) che rimpiazza il box AI finto; stati loading (skeleton) / **errore esclusivo** (banner + Riprova, niente empty-state falso) / empty |
| Shell server | `src/app/(dashboard)/dashboard/page.tsx` | resta server component: passa `firstName`/`isAdmin` al client |
| Test | `dashboard.test.ts` · `dashboard-client.test.tsx` · `format.test.ts` | scope mine/team, riduzione AGENT→mine, `kitGenerati` su `generatedAt`, confine oggi, mapping `recentKits`; KPI/toggle/empty/loading/errore; `startOfTodayRome` CET+CEST |

## Gestione API key admin — cosa è stato costruito (merge PR #10, 2026-07-10)

Override **cifrato su DB con fallback env** per le key AI, gestibile da **ADMIN
non-tecnici** dall'app (senza accesso Vercel / redeploy). Verdetto LLM Council
2026-07-10. Spec `docs/superpowers/specs/2026-07-10-gestione-api-key-admin-design.md`,
piano `docs/superpowers/plans/2026-07-10-gestione-api-key-admin.md`. Il modello
`Settings` esisteva già a schema → **nessuna migrazione**.

| Componente | File | Note |
|---|---|---|
| Cifratura | `src/server/settings/crypto.ts` (`server-only`) | **AES-256-GCM** (`node:crypto`); `base64(iv[12]\|tag[16]\|ct)`, IV random per chiamata; master key da `SETTINGS_ENCRYPTION_KEY` (32 byte, base64/hex); assente → `SettingsCryptoUnavailableError` (mai crash/cifratura debole) |
| Env | `src/env.ts` | `SETTINGS_ENCRYPTION_KEY: z.string().optional()` (dev/CI girano senza) |
| Service | `src/server/settings/service.ts` (`server-only`) | `resolveApiKey` (**DB prima → fallback env**); `setApiKey` (cifra, `upsert` su `@@unique([category,key])`, `ActivityLog SETTINGS_CHANGED` con solo `{provider, maskedSuffix}` — **mai** plaintext, poi `INCR` version-stamp Redis); `getStatus` mascherato (`configured/source/maskedSuffix/updatedAt/updatedBy`) |
| Helper test key | `src/server/ai/gateway.ts` (`testProviderKey`) | verifica una key con chat minima, timeout corto, senza persistere |
| Gateway async + invalidazione | `src/server/ai/gateway.ts` (`getAIGateway` **async**) | risolve le key via `resolveApiKey` per chat **e** embedding (stessa key Gemini); version-stamp Redis `settings:ai-keys:version` riletto ~30–60s → ricostruisce il singleton al cambio; **degrada al singleton esistente se Redis è irraggiungibile** (fix `b9a8559`). Tutti i call-site resi `await` |
| Router settings | `src/server/api/routers/settings.ts` | tutte `adminProcedure`: `aiKeys.status` · `aiKeys.testConnection` (`{provider, apiKey?}`, provider temporaneo, no persist) · `aiKeys.set` (**ri-valida server-side** poi `setApiKey`) |
| UI Impostazioni | `src/app/(dashboard)/impostazioni/{page,impostazioni-client}.tsx` | admin-only; card per provider (stato DB/env/mancante, `••••1234` mono, "ultima modifica"); campo key **write-only**; **Salva abilitato solo dopo un test riuscito** |
| Test | `crypto.test.ts` · `service.test.ts` · `settings.test.ts` | roundtrip/tamper/master-key assente; DB-prima+fallback+audit-senza-plaintext+bump versione; `adminProcedure` nega non-ADMIN, `set` ri-valida |

> **Impatto sul task embedding**: con la gestione API key in-app, aggiornare la
> key Gemini **non richiede più redeploy** — un ADMIN la ruota da `/impostazioni`.
> La decisione aperta resta il **billing** della key (per superare il cap
> free-tier ~1.000 ed embeddare i 6.191 prodotti), non il "come" applicarla.

## Fase 1f — deploy staging (IN CORSO)

Spec `docs/superpowers/specs/2026-07-10-fase1f-deploy-design.md`, piano
`docs/superpowers/plans/2026-07-10-fase1f-deploy.md`. Verdetto council: procedere
con 1f ed embeddare come step finale (NON una GH Action anticipata). Scelta ops:
la dev-container web **filtra la 5432**, quindi le operazioni DB girano da **GitHub
Actions** (rete aperta → Neon:5432 ok).

### Fatto ✅ (PR #11 e #12 mergiate)
| Cosa | Dettaglio |
|---|---|
| Task 1 | `maxDuration` 120→60 in `src/app/api/trpc/[trpc]/route.ts` (cap Vercel Hobby) |
| Task 2 | `.env.example` allineato (Better Auth, `SETTINGS_ENCRYPTION_KEY`, URL Neon pooled/direct) |
| Task 3 | `.github/workflows/ci.yml` — Vitest su PR (verde sulla PR reale) |
| Task 4 | `.github/workflows/ops-neon.yml` — pipeline ops `workflow_dispatch` (migrate→import→seed→embed; job punta `DATABASE_URL` al Neon **diretto**) |
| Fix | `vitest.config.ts` forza `SETTINGS_ENCRYPTION_KEY=""` (ermeticità: senza, `resolveApiKey` interroga il DB e 2 test router falliscono) |
| Fix | **Next 15.3.0 → 15.5.20** (PR #12): Vercel **blocca** i deploy su versioni Next vulnerabili («Vulnerable version of Next.js detected»); il build passava ma il deploy veniva rifiutato |
| Deploy | App **LIVE** su Vercel (Hobby): **https://catalogo-finder-kappa.vercel.app** (nome `catalogo-finder` occupato → suffisso `-kappa`) |
| Config | `NEXTAUTH_URL` corretto all'URL reale + redeploy. Env Production su Vercel: `DATABASE_URL` (Neon pooled+pgbouncer), `DIRECT_URL` (Neon diretto), `REDIS_URL` (Upstash `rediss://`), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `IP_HASH_SECRET`, `SETTINGS_ENCRYPTION_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Infra utente | **Neon** (progetto "Catalogo Finder", `eu-west-2`) · **Upstash** (`catalogo-finder`, EU) · **GitHub Secrets**: `NEON_DIRECT_URL`, `GEMINI_API_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` · **billing Gemini attivo** |

### Da fare 🔲 — riprendere da qui
1. **Task 7 — lanciare la pipeline ops** (il DB Neon è ancora **vuoto** → login KO):
   GitHub → **Actions** → *Ops — Neon* → **Run workflow** → `main`. Fa
   `migrate deploy` (schema + pgvector) → `import:agb` (6.191) → `db:seed` (admin) +
   `db:seed:kit` → `embed:products` (~10–20 min, billing attivo). Idempotente.
   - Verifica dai log: `✓ Prodotti unici: 6191`, `Completato: N embedding generati`.
2. **Login**: `admin@ufptrade.local` / password = secret **`SEED_ADMIN_PASSWORD`**
   (nel password manager — mai nel repo).
3. **Task 8 — verifica e2e** sullo staging: `/impostazioni` (testa/salva key) ·
   creare un agente · `/archivio` (ricerca testuale + **ibrida** su embedding reali) ·
   `/assistente` (chat tool-use entro 60s) · `/richieste/nuova` (kit ARTECH) · `/dashboard`.
4. **Task 9 — chiusura fase**: aggiornare `handoff.md` + `CLAUDE.md` STATO (Fase 1
   MVP completa); definire la fase successiva (hardening produzione / Vercel Pro + dominio, o Fase 2).

### Note / landmine 1f
- **Vercel Hobby** = uso non commerciale + cap function 60s. Per la produzione vera
  serve **Pro** (termini + headroom 300s → rialzare `maxDuration`; + deployment protection).
- **Preview deploy Vercel falliscono** finché le env stanno solo su Production
  (l'ambiente Preview non le ha → `env.ts` fa fallire il build). Per lo staging non serve.
- **Next vulnerabile**: tenere Next su una release non flaggata da Vercel (era 15.3.0 → 15.5.20).

## Task pendenti

### Immediati
- [X] GEMINI_API_KEY in `.env` (fornita 2026-07-04; anche nel transcript sessione)
- [ ] **Embedding catalogo (0/6.191 su Neon)** → **inglobato nella Fase 1f**: gira
  nella pipeline ops GitHub Actions (`embed:products`), **da lanciare (Task 7)**.
  Il blocco 5432 della dev-container web resta valido (le operazioni DB girano da
  GitHub Actions, non dal container); billing Gemini attivo. Vedi sezione «Fase 1f».
- [ ] **Key Moonshot API platform** per il fallback Kimi (quella "Kimi Code" dà 401)
- [X] Merge 1c su `main` (2026-07-04, merge locale + push; suite verde sul risultato)

### Da Fase 1d
- [ ] **Verificare con AGB il supporto-cerniera** `A50801.01.xx` pinnato per
  aria 12/interasse 13/battuta 20 (gap di catalogo — vedi Decisioni 1d): non
  esiste una variante dedicata nel listino 2026, va confermato col tecnico o
  con una prossima distinta reale.
- [ ] **Altre finiture coperture** (`COPERTURE_KIT` in `rules-artech.ts` copre
  solo ARGENTO): estendere tabella + `FINISH_OPTIONS` nel wizard quando si hanno
  i codici delle altre finiture a listino.
- [ ] **PVC/ALLUMINIO**: `kitInputSchema` accetta già i 3 materiali ma il
  generatore ha solo le regole LEGNO (guardia esplicita → `KitGenerationError`
  sugli altri); wizard li mostra disabilitati con hint «presto disponibile».
  Da abilitare quando ci saranno le regole (nuovo `RuleModule` + registry).
- [X] **Follow-up da review finale 1d** (non bloccanti, chiusi 2026-07-06 su
  branch `claude/handoff-review-ztcteg`, TDD un commit per task):
  - [X] test bordo CHIUSURE_VERTICALI (H valida per cremonese ma fuori banda
    1520-2120 → errore esplicito `artech.verticali`)
  - [X] `.strict()` su `templateRulesSchema` (puntatore con chiavi estranee → errore)
  - [X] doppio push su RequestRow (`stopPropagation` sul `<Link>` interno)
  - [X] test ramo warnings-only del dettaglio (kit fuori listino: warning visibili)
  - [X] hint radio disabilitate fuori dal nome accessibile (`aria-label` +
    `aria-describedby`)
  - [ ] retry su unique per `requestNumber`: **NON fatto (YAGNI)** — "solo se
    crescerà la concorrenza"; da riprendere solo se emergono collisioni reali.

### Fatto dopo l'ultimo aggiornamento handoff (riportato ora)
- [X] **Fase 1e — Dashboard dati reali** (merge PR #9, 2026-07-06) — vedi sezione dedicata
- [X] **Gestione API key admin** (Settings cifrato + `/impostazioni`, merge PR #10, 2026-07-10) — vedi sezione dedicata

### In corso
- [🔄] **Fase 1f — deploy staging**: spec+piano fatti, Task 1–4 mergiati, app **live**
  su Vercel, Next bumpato. **Resta**: lanciare la pipeline ops (Task 7) → login →
  verifica e2e (Task 8) → chiusura docs (Task 9). Dettagli: sezione «Fase 1f».

### Sessioni future
- [ ] **Produzione vera** dopo lo staging: Vercel **Pro** (termini commerciali +
  `maxDuration` 300 + deployment protection) + dominio custom.
- [ ] Fallback Kimi (key Moonshot platform) · finiture coperture · regole PVC/ALLUMINIO.

## Contesto tecnico

| Componente | Stato |
|------------|-------|
| Database schema | [X] Migrato (nessuna migrazione nuova in 1c/1e/API-key: `Settings` era già a schema) |
| Auth | [X] Better Auth (override better-call 1.3.7 in package.json) |
| Chat AI | [X] Codice completo; SENZA key risponde «Assistente non configurato.» |
| Embedding | [ ] Su **Neon vuoto**: da generare con la pipeline ops (Task 7). Ramo testato con fake + reale (900 su Docker in 1c) |
| Dashboard (1e) | [X] `/dashboard` dati reali via `dashboard.overview` (KPI + ultime richieste + scorciatoie, toggle team per ADMIN) |
| Gestione API key | [X] `/impostazioni` admin: override cifrato AES-256-GCM su `Settings` con fallback env; richiede `SETTINGS_ENCRYPTION_KEY` in env per attivarsi |
| **Deploy (1f)** | [🔄] App **live** su Vercel Hobby (`catalogo-finder-kappa.vercel.app`), Neon + Upstash collegati, workflow ops/CI su `main`, Next 15.5.20. **DB Neon vuoto** finché non gira la pipeline ops |
| Kit engine (1d) | [X] Pilota ARTECH anta-ribalta LEGNO completo; golden 16 righe verificato su catalogo reale + browser (vedi «Fase 1d») |
| Git | [X] `origin/main` @ `ad086a5` (PR #12 merge); branch `claude/handoff-md-review-6vyafm` ripartito da main |

### Regola utente — file esterni (2026-07-01)
- **Listino AGB PDF**: se manca nell'ambiente, **chiedere il link all'utente**
  (mai cercarlo sul web autonomamente). Link fornito:
  https://drive.google.com/file/d/1TugU94aM6OP557ELiLQpH0nUxhxrXMUz/view?usp=sharing

### Problemi riscontrati e workaround
- **better-call/better-auth** (vedi sopra): override pnpm permanenti in `package.json`.
- **pnpm 11 ignora `pnpm.overrides` in `package.json`** (2026-07-06): corepack
  di default nel container remoto lancia pnpm 11, che ha spostato `overrides`/
  `onlyBuiltDependencies` in `pnpm-workspace.yaml` e **scarta silenziosamente**
  gli override del repo → `better-call` regredisce a 1.1.8 (senza
  `kAPIErrorHeaderSymbol`) → `better-auth` va in crash a load (test/build auth
  rossi) e il lockfile fa drift. **Fix applicato**: `"packageManager":
  "pnpm@10.17.0"` in `package.json` (pnpm 10 legge ancora `pnpm.overrides`).
  Con il pin, `pnpm install --frozen-lockfile` è pulito. Se un giorno si vuole
  passare a pnpm 11: migrare gli override in `pnpm-workspace.yaml`.
- **`pnpm build` mentre `next dev` gira** invalida `.next` del dev server →
  chunk 404: riavviare `pnpm dev`.
- **Engine Prisma**: `bash scripts/setup-prisma-engines.sh` DOPO `pnpm install`.
- **Container nuovo**: `.env` va completato a mano (DATABASE_URL/DIRECT_URL/REDIS_URL/
  NEXTAUTH_*/IP_HASH_SECRET/SEED_ADMIN_*) — vedi `.env.example`; poi `dev-bootstrap.sh`.
- **Vitest**: `beforeEach` con body a graffe (il return viene invocato come cleanup).
- **`pnpm lint | tail`** maschera l'exit code → mai in catena `&&` con pipe.

## Istruzioni permanenti (utente)
1. **/using-superpowers** — sempre quando si sviluppa.
2. **/llm-council** — sempre per dubbi, quesiti, problematiche.
3. **/impeccable** — sempre per UI/UX.
4. **/ponytail** — sempre quando si scrive codice.
5. **Aggiornare tutti i `.md`** (handoff incluso) **a fine di ogni sessione** (la
   fine sessione la dichiara l'utente).

## Cronologia sessioni

| Data | Cosa fatto | Branch |
|------|-----------|--------|
| 2026-07-01 | Fase 1a completa + migrazione Better Auth + spec Fase 1b | `claude/ufptrade-mvp-setup-gcwxnt` |
| 2026-07-02 | Piano 1b + esecuzione completa (parser, import 6.191 prodotti, RAGEngine tsvector+trigram, router, UI Archivio+dettaglio) | `claude/superpowers-handoff-next-z1wyh7` |
| 2026-07-02 | Spec Fase 1c (LLM Council: AIGateway al posto di BullMQ) | `claude/handoff-review-3xcvvy` (PR #4) |
| 2026-07-03 | Piano 1c + esecuzione completa (AIGateway, provider, ChatService, router chat, embedding batch, UI Assistente, CLAUDE.md); gates verdi + verifica browser senza key | `claude/handoff-review-48kkhi` |
| 2026-07-04 | E2e reale 1c verificato (chat tool-use + ranking ibrido, 900 embedding) · riciclo container: ambiente ricostruito (re-import 6.191, suite verde), embedding da rifare, in attesa key + decisione quota | `claude/handoff-review-48kkhi` |
| 2026-07-05 | Fase 1d completa: spec+piano (ADR council regole-in-TS) + pivot golden ALLUMINIO→LEGNO (Task 0) + 8 task TDD (tipi, regole ARTECH legno, registry+seed, engine, router kit, UI richieste+wizard, golden integrazione su catalogo reale) + verifica browser (positivo 16 righe/90,20€ + negativo errore fuori-campo) + gates verdi | `claude/handoff-review-48kkhi` |
| 2026-07-06 | Follow-up review 1d non bloccanti (TDD, un commit per task): `templateRulesSchema.strict()` · test bordo CHIUSURE_VERTICALI · fix doppio push RequestRow · test ramo warnings-only dettaglio · fix a11y hint radio (`aria-label`/`aria-describedby`). Retry-su-unique lasciato per YAGNI. Scoperto+risolto il landmine pnpm 11 (override scartati) → pin `packageManager: pnpm@10.17.0`. 4 gate verdi (typecheck·lint·test 183 passed·build). | `claude/handoff-review-ztcteg` (PR #8) |
| 2026-07-06 | **Fase 1e — Dashboard dati reali** (TDD): `startOfTodayRome` · router `dashboard.overview` (scope mine/team, server autoritativo) · `DashboardClient` (KPI+oggi, ultime richieste, scorciatoie, stati loading/errore/empty). Fix `db:seed:kit` in bootstrap. **Handoff non aggiornato in questa sessione** (drift). | `claude/handoff-next-steps-p6xyzp` (PR #9) |
| 2026-07-10 | **Gestione API key admin** (TDD): crypto AES-256-GCM · env `SETTINGS_ENCRYPTION_KEY` · service `resolveApiKey`/`setApiKey`/`getStatus` (DB→env, audit senza plaintext, version-stamp) · `getAIGateway` async + invalidazione + degrado se Redis giù · router `settings.aiKeys` (status/testConnection/set) · UI `/impostazioni`. **Handoff non aggiornato in questa sessione** (drift). | `claude/handoff-next-steps-p6xyzp` (PR #10) |
| 2026-07-10 | **Review/riallineamento handoff**: riportate 1e + gestione API key (erano merge ma non documentate qui); aggiornati stato, task pendenti, contesto tecnico, cronologia. Prossimo passo di roadmap: Fase 1f (deploy). | `claude/handoff-md-review-6vyafm` |
| 2026-07-10 | **Fase 1f — deploy staging**: scoperto blocco 5432 dev-container → council → spec+piano (ops via GitHub Actions) · Task 1–4 [CLAUDE] (maxDuration 120→60, `.env.example`, `ci.yml`, `ops-neon.yml`) + fix ermeticità `vitest.config` (**PR #11**) · bump **Next 15.3.0→15.5.20** perché Vercel blocca le versioni vulnerabili (**PR #12**) · **deploy staging live** su `catalogo-finder-kappa.vercel.app` (Vercel Hobby) + Neon + Upstash + GitHub Secrets · `NEXTAUTH_URL` corretto. **Resta**: lanciare la pipeline ops (Task 7 → popola Neon → login), verifica e2e (Task 8), chiusura docs (Task 9). | `claude/handoff-md-review-6vyafm` (PR #11, #12) |
