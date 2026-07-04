# Handoff — UFPtrade WebApp

> Creato/aggiornato da Claude alla fine di ogni sessione per riprendere il lavoro
> senza perdere contesto. (Regola permanente: aggiornare tutti i `.md` a fine sessione.)

---

## Sessione attuale

| Campo | Valore |
|-------|--------|
| **Data** | 2026-07-04 |
| **Fase in corso** | Fase 1 — MVP Gestionale |
| **Sotto-fase** | 1a ✅ · Better Auth ✅ · 1b ✅ · **1c Chat AI ✅ (e2e reale verificato)** — embedding catalogo al ~15% (quota free-tier) |
| **Branch git** | `claude/handoff-review-48kkhi` (pushato; nessuna PR aperta) |
| **Piano eseguito** | `docs/superpowers/plans/2026-07-03-fase1c-chat-ai.md` (task 0–15 ✅; embedding full-catalog in coda su quota) |

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
- **IN CODA: embedding full-catalog** — quota free-tier ≈1.000 contenuti/giorno:
  900/6.191 fatti. Loop idempotente `embed-loop.sh` attivo in scratchpad +
  trigger di check post-reset quota (07:20Z). Opzioni: billing sulla key
  (catalogo intero ≈ pochi centesimi, minuti) · trickle free-tier (~6 giorni) ·
  altra key.

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

## Task pendenti

### Immediati
- [ ] **Completare embedding catalogo** (900/6.191): decisione utente su quota
  (billing / trickle ~6 giorni / altra key); il loop e il re-run di
  `pnpm embed:products` riprendono da dove sono (idempotenti)
- [ ] `KIMI_API_KEY` per il fallback (opzionale ma consigliata: elimina i 429-storm)
- [ ] Valutare PR/merge del branch `claude/handoff-review-48kkhi` (scelta utente)

### Sessioni future
- [ ] Fase 1d: Kit deterministic engine · 1e: dashboard dati reali · 1f: deploy

## Contesto tecnico

| Componente | Stato |
|------------|-------|
| Database schema | [X] Migrato (nessuna migrazione nuova in 1c) |
| Auth | [X] Better Auth (override better-call 1.3.7 in package.json) |
| Chat AI | [X] Codice completo; SENZA key risponde «Assistente non configurato.» |
| Embedding | [ ] Vettori reali non generati (serve key); ramo pronto e testato con fake |
| Docker (DB + Redis) | [X] `scripts/dev-bootstrap.sh` (in questo container: seed 50 prodotti, admin `admin@ufptrade.local`) |
| Git | [X] Branch pushato; un commit per task (11 commit 1c) |

### Regola utente — file esterni (2026-07-01)
- **Listino AGB PDF**: se manca nell'ambiente, **chiedere il link all'utente**
  (mai cercarlo sul web autonomamente). Link fornito:
  https://drive.google.com/file/d/1TugU94aM6OP557ELiLQpH0nUxhxrXMUz/view?usp=sharing

### Problemi riscontrati e workaround
- **better-call/better-auth** (vedi sopra): override pnpm permanenti in `package.json`.
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
