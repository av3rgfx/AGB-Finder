# Fase 1c — Chat AI (Assistente) — Design

**Status:** approvato a sezioni dall'utente — in attesa di review dello spec.
**Data:** 2026-07-02

## Goal

Dare agli agenti UFP un **assistente tecnico-commerciale in chat** sul catalogo
AGB (6.191 prodotti): domande in linguaggio naturale, ricerca prodotti via
tool-use (RAG), risposte con codici citati e schede prodotto nel pannello
laterale. In più: **attivare il ramo vettoriale** della ricerca ibrida
(embedding batch dei prodotti + embedding della query).

Perimetro confermato dall'utente: **chat + embedding** insieme. UX: **risposta
completa** (niente streaming). Layout: **split pane 60/40** da DESIGN.md.

## Decisione architetturale (LLM Council, unanime — sostituisce la regola BullMQ)

La regola CLAUDE.md «Ogni chiamata AI via BullMQ» è **emendata**: BullMQ
richiede un worker Node persistente (impossibile su Vercel serverless), è un
anti-pattern documentato su Upstash Redis (fatturazione a comando vs polling
continuo) e per una chat request/response aggiunge solo latenza e un canale di
ritorno. Con ~10 conversazioni concorrenti e ~62 richieste batch non c'è carico
da accodare.

**Nuova regola autoritativa:** *ogni chiamata AI passa dall'unico modulo
`AIGateway` (`src/server/ai/gateway.ts`): rate limit + circuit breaker con
stato su Redis + fallback Gemini→Kimi. Nessuna chiamata diretta ai provider
fuori da `src/server/ai/`.* (Stesso pattern del RAGEngine per il raw SQL:
invariante verificabile a review.) Batch = script tsx idempotenti. Se in futuro
serviranno job asincroni durevoli: Upstash QStash, mai BullMQ-su-Upstash.

CLAUDE.md va aggiornato in questa fase.

## Architettura

```
UI Chat ──tRPC──► chat.send (procedura AGENT)
                    │ 1. persiste messaggio USER (prima della chiamata AI)
                    ▼
                ChatService (loop tool-use, cap 5 round)
                    │           ▲ tool: search_products / get_product_by_code
                    ▼           │ (RAGEngine / Prisma, read-only)
                AIGateway.chat()
                    ├─ rate limit per-utente (20 msg/min) + budget per-provider
                    ├─ circuit breaker per-provider con stato su Redis
                    ├─ timeout AbortController 30s + 1 retry con jitter su 429/5xx
                    ├─ GeminiChatProvider (REST v1beta generateContent, fetch)
                    └─ KimiChatProvider   (Moonshot, API OpenAI-compatible, fetch)
                    │ 2. persiste messaggi TOOL + ASSISTANT (modelUsed,
                    ▼    tokensUsed, latencyMs, referencedProductIds)
                risposta completa al client
```

Vincoli rispettati: nessun SDK provider (solo `fetch`, come
`GeminiEmbeddingService`); dipendenza nuova **solo `ioredis`** (breaker + rate
limit sul `REDIS_URL` già in env: Docker in dev, Upstash TCP in prod; al deploy
1f si potrà passare alla REST API dietro la stessa interfaccia);
`export const maxDuration = 120` sulla route `/api/trpc`.

## Componenti

### 1. Infra resilienza — `src/server/ai/breaker.ts`, `src/server/ai/ratelimit.ts`
- **Circuit breaker distribuito** (per provider): su fallimento transitorio
  `INCR cb:{provider}:fail` (TTL 60s); a soglia 5 → `SET cb:{provider}:open EX 30`;
  prima di chiamare, se `open` esiste → salta al provider successivo; il TTL
  scaduto fa da half-open (la prima chiamata è il probe); su successo `DEL fail`.
  Stato **in Redis, mai in-memory** (le lambda Vercel non condividono memoria).
- **Rate limiter** sliding/fixed window su Redis: per-utente
  (`rl:user:{id}` — 20 msg/min → `TOO_MANY_REQUESTS`) e per-provider
  (budget RPM Gemini condiviso).
- Entrambi dietro una piccola interfaccia con client Redis iniettabile →
  testabili con fake in-memory (pattern `FakeEmbeddingService`).

### 2. AIGateway — `src/server/ai/gateway.ts`
Unico punto di uscita verso i provider. `chat(messages, tools, opts)` e
`embedQuery(text)`:
- catena: rate limit → breaker Gemini → chiamata (timeout 30s, 1 retry con
  jitter su 429/5xx) → su fallimento/breaker aperto → Kimi (breaker proprio) →
  entrambi giù → errore tipizzato (messaggio italiano).
- `embedQuery`: timeout corto (3s), `taskType: RETRIEVAL_QUERY`; su errore
  ritorna `null` → il RAGEngine degrada al solo ramo testuale (già previsto).

### 3. ChatProvider — `src/server/ai/providers/gemini.ts`, `providers/kimi.ts`
Interfaccia comune: `(messages, toolDeclarations) → { text | toolCalls, usage }`.
- Gemini: `generateContent` v1beta con `tools.functionDeclarations`.
- Kimi: `chat/completions` OpenAI-compatible con `tools`.
- Solo costruzione richiesta + parsing risposta; niente logica di resilienza
  (sta nel gateway). Fetch iniettabile per i test.

### 4. ChatService — `src/server/chat/service.ts`
Orchestrazione di un turno:
1. persiste messaggio USER;
2. loop tool-use (cap 5 round): il modello chiama `search_products`
   (query + filtri opzionali, `limit ≤ 10`, via `RAGEngine.search`) o
   `get_product_by_code` (lookup Prisma esatto su `agbCode`); ogni esecuzione
   persiste un messaggio TOOL (`toolName/toolInput/toolOutput`);
3. raccoglie gli `id` prodotto dai tool output → `referencedProductIds`;
4. persiste ASSISTANT con `modelUsed`, `tokensUsed`, `latencyMs`;
5. ActivityLog: `CONVERSATION_CREATED` / `CONVERSATION_MESSAGE`.

System prompt (italiano): assistente tecnico-commerciale del catalogo AGB per
agenti UFP; cita sempre i codici; usa i tool, non inventare; dichiara quando
non trovi nulla. Fuori scope: kit (1d), email parsing (futuro).

### 5. Router — `src/server/api/routers/chat.ts` (procedure AGENT)
`create` · `list` (conversazioni proprie, paginate) · `get` (messaggi) ·
`send` · `archive`. Titolo = primo messaggio utente troncato (rinomina: YAGNI).
Ogni procedura verifica che la conversazione appartenga all'agente.

### 6. Embedding batch — `scripts/embed-products.ts` (`pnpm embed:products`)
- pagina su `WHERE embedding IS NULL` (checkpoint/resume gratuito, rilanciabile
  dopo ogni re-import);
- `batchEmbedContents` (≤100 testi/richiesta ≈ 62 richieste totali),
  `taskType: RETRIEVAL_DOCUMENT`, `outputDimensionality: 768`, `l2Normalize`
  esistente; esecuzione sequenziale + backoff esponenziale su 429/5xx;
- testo embeddato: `name + shortDescription + materiale/dimensione/finitura`
  da `specifications` (quando presenti);
- scrittura vettori via **nuovo metodo del RAGEngine** (`$executeRaw` —
  resta l'unico modulo raw SQL);
- `GeminiEmbeddingService` esteso con `generateBatch()`.

### 7. Ricerca ibrida attiva
`product.search` e il tool `search_products` passano al RAGEngine l'embedding
della query via `AIGateway.embedQuery` (pesi 0.4 testo / 0.6 vettore, ramo già
pronto). Senza key / Gemini giù / timeout → solo testuale, **la ricerca
Archivio non si rompe mai per colpa dell'AI**.

### 8. UI — `src/app/(dashboard)/chat/` + `src/components/chat/`
- Usa la voce nav **«Chat AI» → `/chat` già presente** nella sidebar (nessuna
  voce nuova), accesso AGENT. Sviluppo UI con **/impeccable**.
- **Split pane 60/40**: chat a sinistra; a destra pannello con le schede dei
  prodotti citati (da `referencedProductIds` dei messaggi ASSISTANT): codice
  mono JetBrains + copia, nome, prezzo, disponibilità, link al dettaglio
  Archivio; stato vuoto dedicato.
- Header chat: dropdown conversazioni recenti + «Nuova conversazione»
  (niente terza colonna).
- Stili DESIGN.md: utente a destra su N100; assistente a sinistra con accent
  Brand Orange Light; fade-in + slide-up 100ms; codici in mono con copia.
- Stati: «sta scrivendo…» durante la generazione; vuoto con 3 prompt d'esempio
  cliccabili; errore inline con «Riprova».

## Error handling

- Errori tipizzati dal gateway → `TRPCError` in italiano:
  `TOO_MANY_REQUESTS` («Troppe richieste, riprova tra poco»); entrambi i
  provider giù → «Assistente momentaneamente non disponibile»; key mancanti →
  «Assistente non configurato» (la voce resta visibile, la chat rifiuta con
  messaggio chiaro).
- Fallimento generazione dopo il messaggio USER già salvato → messaggio
  ASSISTANT `status: ERROR` + `errorMessage`; «Riprova» rigenera senza
  duplicare il messaggio utente.
- Errore di un tool → torna al modello come tool output d'errore (può
  riformulare), dentro il cap di 5 round; errore hard → flusso ERROR.
- Embedding query fallito → fallback silenzioso al testuale (warn nei log).

## Testing (TDD, come 1b)

- **Unit** (fake Redis in-memory + provider fake): breaker
  (soglia→open→half-open), rate limiter, gateway (retry, fallback, entrambi
  giù), ChatService (tool call scriptate → persistenza, referencedProductIds,
  cap round), parsing request/response Gemini/Kimi con fetch mockato, chunking
  dello script embedding, RBAC/ownership del router chat.
- **Integrazione** (gated `INTEGRATION_DATABASE_URL`): scrittura vettori +
  ricerca col ramo pgvector attivo via `FakeEmbeddingService`.
- **E2e in sandbox con key reali** (fornite dall'utente, solo in `.env` locale,
  mai committate): conversazione vera con tool-use; embedding batch reale;
  verifica ranking ibrido; verifica browser (Playwright).
- Gate: `pnpm typecheck` · `lint` · `test` · `build`.

## Fuori scope (1c)

Streaming SSE · rinomina conversazioni · terza colonna conversazioni ·
kit generation (1d) · email parsing · coda QStash · admin UI per re-embed
(si rilancia lo script) · multi-agent.

## Prerequisiti d'ambiente

- `GEMINI_API_KEY` (chat + embedding) e `KIMI_API_KEY` (fallback) fornite
  dall'utente a inizio implementazione → `.env` locale (gitignored).
- Raggiungibilità verificata dalla sandbox il 2026-07-02: Gemini HTTP 403
  senza key, Moonshot HTTP 401 → nessun blocco di rete.
- Container nuovo: rieseguire `scripts/setup-prisma-engines.sh`,
  `scripts/dev-bootstrap.sh` e re-import del listino (PDF dal link in
  CLAUDE.md, da chiedere/usare secondo la regola file esterni).
