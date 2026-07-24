# Chat Assistente professionale — streaming + mobile-first (v1) — Design

> **Data:** 2026-07-24 · **Stato:** approvato dall'utente (design), pronto per `/impeccable` (UI) + `/writing-plans`.
> **Fase:** riscrittura della chat AI (supera la bozza Fase 1c).
> **Workflow seguito:** `/using-superpowers` → brainstorming → **2× `/llm-council`** (streaming + rimozione Kimi) → `/impeccable` (UI) → `/writing-plans` → TDD.

---

## 1. Obiettivo

Trasformare la chat dell'assistente (oggi bozza grezza, `assistente-client.tsx`) in un prodotto
professionale vicino a Gemini: **streaming** delle risposte con **STOP** e stati durante i tool,
**mobile-first** (≤375px) reale, **gestione conversazioni** completa, **azioni messaggio**,
**rendering ricco**, **persistenza** in URL.

## 2. Decisioni architetturali (autoritative)

| # | Decisione | Fonte |
|---|-----------|-------|
| D1 | **Streaming = Opzione B**: Next Route Handler dedicato `/api/chat/stream` che ritorna un SSE `ReadableStream`, autenticato con Better Auth. Unica **deroga** alla regola "no fetch diretto dal client", incapsulata nel solo hook `useChatStream`. Tutto il resto resta tRPC. | LLM Council (streaming) |
| D2 | **Gemini-only**: rimozione totale del fallback/provider **Kimi/Moonshot** (già dormiente, nessuna key in prod, ruolo "kit gen" superato dall'engine deterministico, nessun consumatore residuo). | LLM Council (Kimi) — supera la decisione CLAUDE.md "Gemini + Kimi" |
| D3 | **Gateway → generatore**: `AIGateway.chatStream(): AsyncGenerator<…>` accanto (poi al posto) di `chat()`, mantenendo rate-limit, circuit breaker per-Gemini, timeout, retry, rotazione key cifrata. Si butta **solo** l'array provider + fallback loop. | Entrambi i council |
| D4 | **Rendering markdown = `react-markdown` + `remark-gfm`** (libreria matura, no `innerHTML`/XSS, gestisce liste/tabelle/code-block). | Utente |
| D5 | **Scope v1 = solo core** (vedi §9). Feedback 👍/👎, pin, modifica-e-reinvia, resume stream → v2. **Zero migrazioni, zero azioni ops DB.** | Utente |
| D6 | **Rimozione procedure non-streaming** `chat.send`/`chat.retry`: tutto il turno passa dal route handler. | Utente |
| D7 | **Trattamento messaggi = A1** (AI a **tutta larghezza**, niente bolla/side-stripe; utente = pill a destra) — aggiorna la voce "Chat Message" di DESIGN.md. **Prodotti citati = B1** (card **inline** sotto la risposta che le cita, via chip espandibile «N prodotti», dai `referencedProductIds` per-messaggio). Nessun pannello laterale / bottom-sheet. | Utente (anteprima) |

## 3. Architettura

```
Client
  useChatStream (hook)  ── unica deroga "no fetch", isolata qui
   │  POST /api/chat/stream { conversationId, content, mode: 'send'|'regenerate' }
   │  body = fetch ReadableStream; parsing SSE con eventsource-parser
   ▼
Route Handler  src/app/api/chat/stream/route.ts   (maxDuration = 60)
   │  auth.api.getSession({ headers })  → 401 se assente
   │  header: Content-Type: text/event-stream · Cache-Control: no-cache, no-transform · X-Accel-Buffering: no
   │  ownership della conversazione (agentId)
   ▼
ChatService.generateStream(conversationId, agentId, signal)  → AsyncGenerator<ChatEvent>
   │  tool-loop (cap 3 round nello streaming) + persistenza TOOL + ASSISTANT (finally)
   ▼
AIGateway.chatStream(messages, tools, { userId, signal })  → AsyncGenerator<ProviderChunk>
   │  rate-limit Redis · breaker per-Gemini · timeout · (retry solo pre-primo-chunk)
   ▼
GeminiChatProvider.chatStream(messages, tools, signal)  → AsyncGenerator<ProviderChunk>
   │  POST …:streamGenerateContent?alt=sse
   │  eventsource-parser (frame buffering) + parsing JSON Gemini (parts → text-delta | tool-call | usage)
```

### 3.1 Modello eventi

**`ProviderChunk`** (provider → gateway → service, interno):
```ts
type ProviderChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; call: ToolCall }      // accumulata: functionCall arriva intera in un part
  | { type: 'usage'; tokens: number }
```

**`ChatEvent`** (service → route → client, wire SSE; una `data:` JSON per evento):
```ts
type ChatEvent =
  | { type: 'tool'; phase: 'start' | 'end'; tool: string; label: string; count?: number }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string; products: ChatProductSummary[]; tokens: number }
  | { type: 'error'; recoverable: boolean; retryAfter?: number; message: string }
```
`label` in italiano, es. `«Sto cercando nel catalogo…»` per `search_products`.

### 3.2 Sequenza di un turno

1. Route persiste il messaggio **USER** (mode `send`) oppure cancella l'ultimo **ASSISTANT** (mode `regenerate`), poi apre lo stream.
2. `generateStream` costruisce il transcript (system + storia) e cicla i round (cap 3):
   - chiama `gateway.chatStream(useTools ? TOOL_DECLARATIONS : [])`;
   - inoltra i `text-delta` come `ChatEvent{delta}` **appena arrivano** (time-to-first-token);
   - accumula le `tool-call` e i token;
   - **fine round:** se ci sono tool-call **e** `useTools` → emette `ChatEvent{tool,start}`, esegue i tool (accumula `productIds`), persiste le righe TOOL, emette `ChatEvent{tool,end}`, continua; **altrimenti** → è la risposta finale: emette `done`.
3. In `finally`: persiste la riga **ASSISTANT** col testo accumulato (`SENT` se c'è testo, `ERROR` se nulla), `referencedProductIds`, tokens, latency; **tocca `conversation.updatedAt`** (per l'ordinamento lista); auto-titola dal primo messaggio se il titolo è ancora quello di default.

> **Nota edge (documentata):** Gemini può restituire testo *e* functionCall nello stesso round. Con il system-prompt che vieta gli annunci, i round-tool hanno testo ~vuoto; l'eventuale preambolo streammato resta visibile come "ragionamento". Accettato in v1.

## 4. Policy di resilienza

- **Fallback:** nessuno (Gemini-only, D2). Il `for provider of …` sparisce.
- **Errore/429/breaker-open PRIMA del primo `delta`** → `ChatEvent{error, recoverable:true, retryAfter}`. UI: banner «Assistente momentaneamente occupato», **auto-retry con countdown** che rispetta `Retry-After` (cap ~2 tentativi), poi «Riprova» manuale.
- **Errore/STOP DOPO il primo `delta`** → si **tiene il parziale**, stop pulito, azione «Rigenera». (`recoverable:false` o semplice chiusura stream.)
- **STOP:** `AbortController` nel hook → `signal` del `fetch` → `request.signal` del route → passato a `generateStream` → `gateway.chatStream` → `signal` del `fetch` provider. Check `signal.aborted` **tra un round e l'altro** e propagazione al `fetch` in corso.
- **Retry gateway:** l'1-retry-jitter su 429/5xx si applica **solo prima** che lo stream produca il primo chunk (connessione/HTTP status). Dopo il primo chunk, nessun retry (eviterebbe token duplicati).
- **Cap 60s Vercel:** round tool **cap a 3** (non 5) nel path streaming, budget wall-clock ~50s con taglio graceful; gli eventi `tool` tra i round producono byte in continuazione (niente idle-timeout). `maxDuration = 60` sul route.
- **Persistenza (v1 semplice):** **nessuna riga `STREAMING` up-front** → nessuno sweeper. Rischio residuo: SIGKILL a 60s ⇒ `finally` non garantito ⇒ nessuna riga ASSISTANT (il messaggio USER resta, l'utente può «Rigenera»). Mitigato dal cap round + budget. Lo sweeper lazy + riga STREAMING sono **v2**.

## 5. Backend — modifiche per file

### 5.1 Streaming (nuovi/refactor)
- **`src/server/ai/providers/types.ts`**: aggiungo `ProviderChunk` e `chatStream(messages, tools, signal): AsyncGenerator<ProviderChunk>` a `ChatProvider`. `chat()` resta (test/usi non-stream).
- **`src/server/ai/providers/gemini.ts`**: implemento `chatStream` su `:streamGenerateContent?alt=sse` con `eventsource-parser` (frame buffering) + parsing dei `parts` (text/functionCall/usageMetadata). Riuso `toGeminiRequest` invariato.
- **`src/server/ai/gateway.ts`**: `chatStream()` con le stesse guardie (rate-limit utente, breaker per-Gemini, timeout via `AbortSignal` combinato col signal client). **Rimuovo** il provider-array/fallback loop; `buildGateway` costruisce **solo** Gemini.
- **`src/server/chat/service.ts`**: `generateStream()` (loop + emissione `ChatEvent` + persistenza in `finally`); `SYSTEM_PROMPT` **riscritto** (vedi §5.3). Cap round = 3 nel path streaming. I metodi pubblici `send`/`retry` **spariscono**; la loro logica (persist-USER, delete-last-ASSISTANT per `regenerate`) diventa un piccolo helper chiamato dal route prima di aprire lo stream.
- **`src/app/api/chat/stream/route.ts`** (nuovo): auth, ownership, header anti-buffering, serializza `ChatEvent`→SSE, `maxDuration = 60`, `runtime = 'nodejs'`.

### 5.2 Router conversazioni (tRPC, no-stream) — `src/server/api/routers/chat.ts`
- **Tolgo** `send`, `retry`.
- **Aggiungo** `rename({conversationId, title})` (`title` trim, 1–80) e `delete({conversationId})` (soft → `status: DELETED`).
- **`list`**: aggiungo `search?: string` (Prisma `contains`, case-insensitive, su `title`) e restituisco `updatedAt` (già presente) per il raggruppo-per-data lato client.
- `create`, `get`, `archive` restano. **`get` (per B1 = card inline):** restituisce i messaggi con i prodotti **risolti per-messaggio** — ogni ASSISTANT porta `products: ChatProductSummary[]` dai propri `referencedProductIds` (non più una lista piatta deduplicata a livello conversazione). `PRODUCT_SUMMARY` += `listinoPage` (per il pulsante listino). Il `done` dello stream porta gli stessi `products` del turno appena concluso, così la card compare senza refetch.
- Tutte `agentProcedure` + `ownConversation()` riusato.

### 5.3 System prompt (abilita markdown)
Sostituire l'ultima regola (`Scrivi in testo semplice senza markdown…`) con: **usare markdown conciso** (elenchi puntati/numerati, **grassetto** per evidenziare, tabelle solo se utili), **sempre** citare il codice AGB, **sempre** usare i tool, non inventare. Restano invariate le regole tool/0-risultati/fuori-catalogo.

### 5.4 Rimozione Kimi (commit isolato, PRIMO)
Superficie (grep `kimi|Kimi|MOONSHOT|moonshot|KIMI`):
- **Eliminare:** `src/server/ai/providers/kimi.ts` + `kimi.test.ts`.
- **`src/server/ai/gateway.ts`** + `gateway.test.ts`: via `KimiChatProvider`, array provider, fallback.
- **`src/env.ts`** + `.env.example`: via `KIMI_MODEL` / `MOONSHOT_API_KEY` (+ eventuale default in `vitest.config.ts`/`scripts/dev-macos.sh`).
- **`src/server/settings/service.ts`** + `service.test.ts`: rimuovere l'opzione provider `"kimi"` da `resolveApiKey`/tipi.
- **`src/server/api/routers/settings.ts`** + **`impostazioni-client.tsx`**: rimuovere il campo key Kimi dal pannello cifrato.
- **`src/server/ai/test-connection.ts`** + `test-connection.test.ts`: rimuovere il ramo Kimi.
- **Doc:** aggiornare CLAUDE.md (riga provider) e handoff.md (verdetto council che supera "Gemini + Kimi").

## 6. Frontend — struttura (dettaglio in `/impeccable`)

> La UI/UX di dettaglio (gerarchia, stati, motion, copy, token, verifica ≤375px) è prodotta dal passo `/impeccable`. Qui i vincoli e i componenti.

### 6.1 Layout & mobile-first (≤375px + desktop) — **A1 + B1: due sole zone (conversazioni + chat)**
- Chat a **tutta altezza** (`100dvh` + `env(safe-area-inset-*)`), **niente** `hidden lg:block` che nasconde funzioni.
- **Desktop (≥1024px):** *rail conversazioni* ~280px **collassabile** (default aperta, toggle) + *colonna chat* centrata (larghezza leggibile ~720–760px), composer sticky in basso. Nessuna terza colonna prodotti (B1).
- **Mobile (≤1023px):** chat a tutta larghezza; conversazioni in **drawer overlay** (riuso `topbar.tsx`); header compatto ☰ · titolo troncato · ＋ nuova.
- **Composer sticky** in basso: textarea **auto-grow** (min 1 riga, max ~6), **Invio** invia / **Shift+Invio** a capo (già), pulsante **Invia** che diventa **STOP** durante lo stream, contatore caratteri (appare oltre ~3500/4000). Gestione tastiera mobile (dvh dinamico).
- **Conversazioni (rail/drawer):** **ricerca** (input filtro live), **raggruppo per data** (Oggi / Ieri / Ultimi 7 giorni / Più vecchie), voce attiva evidenziata (`brand-light`), **menu ⋯** per **rinomina** (inline edit) / **archivia** / **elimina** (conferma inline, no modal) — dropdown `position:fixed` anti-clipping da `utenti-client.tsx`, «＋ Nuova conversazione».

### 6.2 Rendering messaggi — **A1 (tutta larghezza)**
- **AI = blocco a tutta larghezza** (niente bolla, niente side-stripe): segno assistente (pallino brand + «Assistente»), contenuto markdown che scorre sul fondo pagina, divisore sottile tra i turni. **Utente = pill compatta a destra** su `surface-sunken`.
- **`react-markdown` + `remark-gfm`**; renderer custom: **code-block** con pulsante **copia** (pattern `CopyCodeButton`), `inline code` mono, tabelle/liste GFM (a tutta larghezza → niente scroll forzato). **Nessun** `rehype-raw` (no HTML grezzo → no XSS).
- Codici AGB in **mono** (mantengo la regex attuale come segmentazione dentro i nodi testo del renderer).
- **Card prodotto inline (B1):** sotto la risposta AI, chip espandibile «**N prodotti**» → lista compatta di card, ciascuna: **thumbnail** (`ProductThumb code`), codice **mono** + copia (`CopyCodeButton`), nome (link `/archivio/[id]`), **prezzo**, badge disponibilità, **pulsante listino** (`ListinoButton code page`). Alimentate dai `products` per-messaggio (`get`) e dal `done` del turno.
- Stati: **stream in corso** (cursore typing ▍), **stati tool** («Sto cercando nel catalogo…» → «Trovati N risultati»), **errore recoverable** (banner + countdown + Riprova), **errore fatale** (banner + Rigenera).

### 6.3 Azioni messaggio
- Su risposta ASSISTANT completata: **Copia** (testo markdown, feedback 2s) e **Rigenera** (`mode:'regenerate'`).

### 6.4 Persistenza & scroll
- **`?c=<id>`** in URL (`useSearchParams` + `router.replace(...,{scroll:false})`, sotto `<Suspense>`) → refresh/back tornano alla stessa chat (riuso lezione archivio).
- **Scroll intelligente**: autoscroll solo se l'utente è vicino al fondo; pulsante «scorri in fondo» quando è staccato; append token **batch-`rAF`** per non thrashare su mobile.
- **Empty-state** accogliente con prompt d'esempio (già presenti).

## 7. Dati (nessuna migrazione)
Riuso campi esistenti (`prisma/schema.prisma`): `Conversation.title/status(ACTIVE|ARCHIVED|DELETED)/updatedAt`, `Message.role/content/status(include STREAMING)/referencedProductIds`/tool fields. `delete` = `status:DELETED` (soft); `ownConversation` già esclude `DELETED`. **Nessuna colonna nuova** in v1.

## 8. Dipendenze nuove (minime)
`react-markdown`, `remark-gfm`, `eventsource-parser`. Nient'altro. (Ponytail: riuso di librerie mature per il parsing markdown/SSE, il resto hand-rolled coi pattern esistenti.)

## 9. Scope

**IN (v1 core):** streaming token-by-token + STOP + stati tool · Gemini-only (rimozione Kimi) · mobile-first (drawer conversazioni, sheet prodotti, composer) · conversazioni (lista/ricerca/rinomina/elimina/archivia/raggruppo per data) · rendering ricco (markdown + copia code-block + card prodotto + mono) · azioni messaggio (copia, rigenera) · persistenza URL · scroll intelligente.

**OUT (v2):** feedback 👍/👎 (migrazione) · pin conversazioni (migrazione) · modifica-e-reinvia · resume/reconnect stream · riga STREAMING + sweeper lazy · alert 429 · piano Gemini a pagamento.

## 10. Piano di test (TDD)
- **Parser SSE Gemini** (fixture registrate `alt=sse`; frame spezzato a metà `data:`; multibyte UTF-8 a cavallo di due chunk; sentinel di fine).
- **`GeminiChatProvider.chatStream`**: text-delta in ordine, tool-call accumulata, usage finale, errore HTTP → throw.
- **`AIGateway.chatStream`**: rate-limit utente supera → errore; breaker-open → errore; costruisce **solo** Gemini (post-rimozione Kimi).
- **`ChatService.generateStream`**: round-tool → `tool start/end` + `delta` + `done`; abort a metà → parziale persistito `SENT`; errore pre-primo-token → `error` recoverable; errore post-primo-token → parziale + stop; cap 3 round.
- **Router**: `rename` (validazione title), `delete` (→DELETED, escluso da `get`/`list`), `list` con `search`.
- **Helper puri UI**: raggruppo-per-data conversazioni; logica "vicino al fondo" per l'autoscroll.
- **Rimozione Kimi**: nessun riferimento residuo (`grep`), suite verde.

## 11. Azioni OPS
- **Nessuna migrazione DB. Nessun seed.**
- **Env Vercel (non bloccante):** rimuovere, se presenti, `KIMI_MODEL` / `MOONSHOT_API_KEY`. La key Gemini resta.
- Deploy standard al merge.

## 12. Rischio noto (documentato)
**Concentrazione vendor app-wide:** un 429-storm / outage Gemini degrada **chat E ricerca semantica** (embedding query live su `gemini-embedding-001`, stessa key/quota). Restano attivi: ricerca **testuale** (degrado del RAG al ramo testuale, già previsto) e **kit** (deterministico). Il fix strutturale dei 429 ricorrenti è il **piano Gemini a pagamento**, non un secondo vendor (fuori scope v1). Tripwire futuro: alert sul tasso di 429.

## 13. Gate di fine lavoro
`pnpm typecheck` · `pnpm lint` · `pnpm test` (Vitest) · `pnpm build` **verdi** + **verifica browser Chromium desktop e mobile ≤375px** + PR (ok utente prima di aprire/mergiare) + aggiornamento `.md`.
