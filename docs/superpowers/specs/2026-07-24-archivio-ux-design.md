# Spec — UX Archivio: persistenza, ritorno-alla-lista, cronologia ricerche

**Data:** 2026-07-24
**Fase:** miglioramento UX Archivio (post Fase 1i + immagini prodotto)
**Workflow seguito:** `/using-superpowers` → brainstorming → `/llm-council` (dubbi tecnici) →
`/impeccable` (UI, mobile ≤375px + desktop) → *questa spec* → critica adversariale 3-lenti
(recepita, §12) → `/writing-plans` → TDD.

---

## 1. Obiettivo

Migliorare la UX della pagina **Archivio** (`/archivio`) su tre assi richiesti dall'utente,
più tre miglioramenti UX approvati, senza violare i vincoli di progetto (TypeScript strict,
API via tRPC/Prisma, UI in italiano, codici in mono, **mobile-first** verificato ≤375px,
minimalismo/YAGNI, nessuna dipendenza nuova).

### Richieste core
1. **Persistenza** di vista (lista/griglia), query, filtri e pagina → sopravvivono al **refresh**.
2. **(Priorità #1) Ritorno alla lista dopo il dettaglio**: aprire un prodotto e poi tornare
   indietro deve riportare alla **stessa lista** con la **stessa posizione di scroll** — oggi si
   azzera perché `archivio-client.tsx` tiene lo stato in `useState` e si **smonta** alla navigazione.
3. **Cronologia ricerche settimanale** per utente (finestra ~7 giorni), riusabile con un tap.

### Extra approvati (questa iterazione) — additivi, NON prerequisiti del fix #2
4. **Thumbnail prodotto** su card e righe (riuso immagini già estratte).
5. **Chip dei filtri attivi + "azzera"** sopra i risultati.
6. **Empty-state con suggerimenti** (ospita le ricerche recenti + suggerimenti cliccabili).

### Fuori scope (annotato per il futuro, non implementato)
- Pulsante "copia link" (la ricerca diventa comunque un **URL condivisibile** come byproduct).
- "Prodotti visti di recente", ricerche salvate/preferite, "ricerche popolari".
- **Ticket «log-hygiene» (§6):** loggare solo le ricerche *committate* invece che ad ogni keystroke,
  così **KPI dashboard** «prodotti cercati» e cronologia diventano puliti alla sorgente. Deferrito.

---

## 2. Diagnosi (perché oggi si perde tutto)

`archivio-client.tsx` è un client component che tiene **tutto** lo stato in `useState`
(`query`, `filters`, `view`, `offset`). Navigare a `/archivio/[id]` via `<Link>` **smonta**
l'albero dell'Archivio → lo stato React sparisce. Al ritorno (o a un refresh) rimonta vuoto:
la ricerca è azzerata e non c'è nulla su cui ripristinare lo scroll.

**La scroll restoration nativa (App Router/browser) NON basta e va anzi *neutralizzata*** (verdetto
LLM Council + critica): sul Back il componente rimonta, la cache react-query si risolve al *microtask*
successivo (altezza `0 → piena`), e il ripristino nativo scatta **contro un documento ancora corto →
si atterra in cima**. Peggio: il ripristino nativo e un nostro `scrollTo` esplicito sono **due
scrittori indipendenti di `window.scrollY`** → race. Soluzione: **un solo proprietario** dello scroll
sul Back (il nostro), che scrive **dopo** il passaggio nativo (via `requestAnimationFrame`).

---

## 3. Architettura — tre meccanismi separati, uno per scopo

Il principio (First Principles + Contrarian): non risolvere tre problemi diversi con un martello solo.

| Concern | Meccanismo | Sopravvive a |
|---|---|---|
| **A. Durevole + condivisibile** — `query`, `filtri`, `pagina` | **URL searchParams** (`?q=&cat=&pmin=&pmax=&mat=&stock=&p=`): lettura via `useSearchParams` (sotto `<Suspense>`), scrittura via `router.replace(url,{scroll:false})` | refresh · back · link condiviso |
| **B. Preferenza-dispositivo** — `vista` lista/griglia | **`localStorage`** (`archivio:view`), idratato **post-mount** | refresh · back (stesso device) |
| **C. Ripristino scroll (Back)** — posizione | **snapshot `scrollY` in `sessionStorage`** per-chiave, ripristinato **una volta** dopo il paint dei dati in cache, **dopo** il passaggio di scroll nativo (rAF) | back · refresh (stesso tab) |
| **D. Cronologia** — ricerche recenti 7gg | **tRPC read-side** su `ActivityLog.PRODUCT_SEARCHED` (nessuna tabella, nessuna modifica al logging) | — |

### 3.1 Sorgente di verità = URL via `useSearchParams` + `<Suspense>` (decisione, risolve il blocker)
- **Lettura**: la pagina Archivio legge lo **stato committato** da `useSearchParams()`. In Next 15
  questo **richiede** un confine `<Suspense>` sopra il componente che lo chiama, altrimenti il build
  fallisce con *missing-suspense-with-csr-bailout* (il gate `pnpm build`). Questo repo l'ha **già**
  incontrato: `login-form.tsx:16` usa `useSearchParams()` e `login/page.tsx:49` lo avvolge in
  `<Suspense>`. → **`archivio/page.tsx` avvolge `<ArchivioClient/>` in `<Suspense fallback>`**
  (skeleton lista) e va in §9 *Modificati*. `useSearchParams` è hydration-safe (Next gestisce
  SSR→CSR), quindi **niente mismatch** e lo **stato committato è disponibile in modo sincrono al
  primo render** dopo il Back → cache-hit immediato (indispensabile per il ripristino scroll).
- **Scrittura**: `router.replace(pathname + "?" + qs, { scroll: false })`. Le scritture sono
  **poco frequenti** (solo sulla query *committata*/debounced e sui click discreti: filtri, chip,
  paginazione, non a ogni tasto) → il round-trip RSC è trascurabile e la reattività di
  `useSearchParams` è **garantita** (è il router). `scroll:false` evita il salto in cima.
  *(Ottimizzazione possibile ma non necessaria: `window.history.replaceState` integrato — evita
  l'RSC ma dipende dall'integrazione Next; si adotta solo se un profiling mostrasse latenza.)*
- Scartato `nuqs` (una sola pagina, pochi parametri → YAGNI).

### 3.2 Regole anti-race (obbligatorie)
1. **La ricerca legge SOLO lo stato committato dall'URL** (`committed.query`, `committed.filters`,
   `offset` derivato), **mai** `queryInput`/`debouncedQuery` diretti. Così non esiste un render con
   `(newQuery, oldOffset)` → niente doppia fetch né log fantasma di transito.
2. **Scrittura atomica**: committare una nuova query = **una sola** `router.replace` che imposta `q`
   **e omette `p`** (pagina→1). Idem al cambio filtri.
3. **Reset pagina a 1** su cambio query **e** su `setFilters`/`clearFilter`/`clearAllFilters`
   (preserva il comportamento attuale `setFilters → setOffset(0)`).

### 3.3 Perché snapshot esplicito e non "non smontare" (route intercettata/overlay)
First Principles proponeva l'overlay. Scartato: la scheda dettaglio è ricca e **deep-linkabile**
(immagine, specifiche, correlati, pulsante listino); l'overlay con route intercettate è più
"Next-magic", cambia la UX e si testa peggio. Lo snapshot esplicito è incrementale e testabile.

---

## 4. Componenti e moduli (con confini netti)

### 4.1 Moduli puri (unit-testabili, nessuna dipendenza React)

**`src/lib/archivio-search-params.ts`**
```ts
export interface ArchivioFilters {          // single source; product-filters lo importa
  categoryId?: string; priceMin?: number; priceMax?: number;
  material?: string; inStockOnly?: boolean;
}
export interface ArchivioSearchState { query: string; filters: ArchivioFilters; page: number /*1-based*/ }

export function parseSearchState(sp: URLSearchParams): ArchivioSearchState;
export function buildSearchQueryString(state: ArchivioSearchState): string; // OMETTE i default (URL pulito)
export function searchScrollKey(state: ArchivioSearchState): string;        // ⚠️ SENZA view (vedi §4.2)
```
- Param corti/stabili: `q, cat, pmin, pmax, mat, stock (=1), p (1-based, default 1 omesso)`.
- `parse` tollerante: assenti/malformati → default (query "", nessun filtro, pagina 1); numerici
  `NaN`/negativi scartati (coerente con lo schema zod di `product.search`).
- `searchScrollKey` **NON** include `view` (vedi §4.2: `view` è default al primo render → chiave sbagliata).

**`src/lib/archivio-scroll.ts`** — store `sessionStorage` **per-chiave** (niente mappa/FIFO — YAGNI)
```ts
export function saveScroll(key: string, y: number): void;   // setItem("archivio:scroll:"+key, String(y))
export function loadScroll(key: string): number | null;     // getItem → Number, null se assente/NaN
export function clearScroll(key: string): void;             // consuma dopo il ripristino
```
- SSR-safe (`typeof window` guard), fail-soft su quota/JSON (try/catch → no-op).
- Le voci sono numeri minuscoli, chiave = search-key: nessun rischio quota realistico → nessun cap.

**`src/lib/recent-searches.ts`**
```ts
export function deriveRecentSearches(rows: { metadata: unknown }[], opts?: { limit?: number }): string[];
```
- Da ogni riga: `metadata.query` (string) + `metadata.results` (number). **Scarta** query vuote e
  ricerche a **0 risultati** (`results === 0`; `undefined` = sconosciuto → si tiene). Normalizza
  (trim + collassa spazi). **Dedup case-insensitive** tenendo la più recente. **Collassa i prefissi**
  (scarta una query prefisso stretto, case-insensitive, di una già tenuta più recente). Tronca a `limit` (8).
  Righe già ordinate `createdAt desc` dal resolver.
- Commento in testa al file: il prefix-collapse è un **rimedio read-side** al logging as-you-type;
  **rimuovibile** quando il ticket §6 (log solo committati) sarà fatto.

### 4.2 Hook di stato — `src/lib/use-archivio-search.ts` (client, wire-up sottile)

La logica non-banale vive nei moduli puri; l'hook è cablaggio (e ha i suoi test mirati, §8).
```ts
const {
  queryInput, setQueryInput,     // mirror LOCALE per la digitazione (seed da committed.query iniziale)
  committed,                     // {query, filters, page} da useSearchParams (SORGENTE della ricerca)
  offset,                        // (committed.page - 1) * PAGE_SIZE
  setFilters, clearFilter, clearAllFilters,   // scrivono URL (router.replace) + reset pagina
  setPage,                       // scrive URL
  view, setView, viewLoaded,     // localStorage post-mount
  scrollKey,                     // searchScrollKey(committed)
  registerRestore,               // (search) => void: aggancia il ripristino scroll
} = useArchivioSearch();
```
- **Query**: `queryInput` (locale) è il valore del campo; `useDebouncedValue(queryInput.trim(),300)` →
  `useEffect` che, se differisce da `committed.query`, esegue **una** `router.replace` con `q` nuovo e
  **senza `p`** (§3.2). La **ricerca** usa `committed.query`, mai `queryInput`.
- **Vista**: `useState<"list"|"grid">("list")` (default SSR deterministico); `useEffect` di mount legge
  `localStorage` → `setView` + `setViewLoaded(true)` (pattern `login-form.tsx:29`, evita mismatch/flash);
  `setView` scrive `localStorage`. **`view` NON va nell'URL** (un link condiviso non la trascina).
- **Salvataggio scroll** (robusto, no dipendenza dall'ordine di unmount): listener `scroll` **throttled**
  (~150ms) → `saveScroll(scrollKey, window.scrollY)`; più `pagehide` (refresh/chiusura). *(Nota scroll
  container: verificato dal layout che scrolla `window`; ri-verificare in browser.)*
- **Ripristino scroll** (un solo proprietario, dopo il passaggio nativo):
  `useEffect` (NON `useLayoutEffect`, per evitare warning SSR su rotta dinamica) guardato da un
  `restoredRef` (**una volta per mount**), che scatta quando **tutte** valgono:
  `search.data && !search.isPlaceholderData && viewLoaded && (categoriesReady se filtro categoria attivo)`;
  legge `loadScroll(scrollKey)`; se presente → `requestAnimationFrame(() => window.scrollTo(0, y))`
  (rAF così vince sul ripristino nativo), poi `clearScroll` + `restoredRef=true`. **Se assente → non fa
  nulla** (mai `scrollTo(0)`; così un toggle vista o una ricerca nuova non saltano in cima).

### 4.3 react-query (config per query, NON globale)
- **`product.search`**: `staleTime: 5min` **e** `gcTime: 30min` (peer-review: il `gcTime` default 5min
  **sfratta** la pagina in cache mentre l'agente legge il dettaglio → Back lento → refetch → lista vuota
  → cima; `staleTime` governa il refetch, `gcTime` la *ritenzione*, servono **entrambi**). Mantiene
  `placeholderData: keepPreviousData` (paginazione fluida). *(Il ripristino esclude i placeholder, §4.2.)*
- **`product.recentSearches`**: `staleTime: 0` + `refetchOnMount` (**NON** la config alta di `search`),
  abilitata quando `committed.query` è vuota → tornando a query vuota la lista si aggiorna con l'ultima
  ricerca appena fatta. (Nessuna invalidazione dal path di ricerca: resta read-only.)
- **Correzione all'affermazione «niente doppio-log»**: il `gcTime` alto evita il refetch (e quindi il
  re-log) **solo sul Back a cache calda**. Su **refresh** o Back dopo `gcTime` scaduto, la query URL-durevole
  **ri-fetcha e ri-logga** un `PRODUCT_SEARCHED` che l'utente non ha digitato (§6/§7).

### 4.4 Componenti UI (nuovi/modificati)

**`src/components/product/product-image.tsx`** (MODIFICATO — evita un componente duplicato)
- Aggiunge props opzionali: `fallback?: React.ReactNode` e `alt?: string`.
  `if (failed) return fallback ?? null;` — un solo `img+onError`, riusato.

**`src/components/product/product-thumb.tsx`** (NUOVO — wrapper sottile su `ProductImage`)
- Riserva **sempre** il box (dimensioni fisse) → niente layout-shift → **protegge lo scroll restore**.
- `<ProductImage code alt="" loading="lazy" object-contain>` su bg bianco; `fallback` = placeholder
  **quieto** nello stesso box (icona `Package` `aria-hidden`, `text-ink-subtle`/`bg-surface-sunken`).
  `alt=""` (decorativo: codice+nome già etichettano l'item → niente doppio annuncio screen-reader).
- Varianti: `row` (40×40, `size-10 rounded border`), `card` (larghezza piena, altezza fissa ~`h-28`).

**`src/components/product/product-row.tsx`** (MODIFICATO — griglia ridefinita)
- Nuovi template espliciti: mobile `grid-cols-[auto_auto_1fr_auto]` (thumb · codice · nome-truncate ·
  prezzo; `AvailabilityDot` inline accanto al codice), desktop `sm:grid-cols-[40px_140px_1fr_auto_auto_auto]`.
  Verifica ≤375px: prezzo resta in riga, nome tronca, nessun overflow.

**`src/components/product/product-card.tsx`** (MODIFICATO)
- `ProductThumb size="card"` in testa (box fisso), poi codice/nome/categoria/prezzo come oggi.

**`src/components/product/active-filter-chips.tsx`** (NUOVO)
- Riga wrap sopra il conteggio; un chip per filtro attivo: `Etichetta: valore` + `✕`.
  Es. `Categoria: Cerniere` · `Prezzo: 10–50 €` · `Materiale: acciaio` · `Solo disponibili`.
  Nome categoria via `api.product.listCategories` (cache). `Azzera tutto` (ghost) se ≥1 filtro.
- Ogni `✕` = `<button>` con **`aria-label="Rimuovi filtro <etichetta> <valore>"`**, focus-ring,
  chiama `clearFilter(key)` (URL-autoritativo → il Back non resuscita un filtro rimosso).
- **Mobile**: unica prova visibile dei filtri attivi (la sidebar è impilata in cima). Wrap, no overflow.

**`src/components/product/recent-searches.tsx`** (NUOVO — nell'empty-state)
- "Ricerche recenti" (chip cliccabili) se presenti + "Prova a cercare" con 2–3 suggerimenti statici
  (es. `cerniera anta ribalta`, `maniglia`, un codice in **mono** es. `B00590`).
- Chip = `<button>` con focus-ring; codici `font-mono`. Al click: `setQueryInput(q)` **e sposta il focus**
  sul campo di ricerca (l'empty-state si smonta → il focus non deve cadere su `<body>`); il conteggio
  `aria-live` esistente annuncia i risultati. Nessuna card-grid (anti-reference PRODUCT.md).
- Errore `recentSearches` → mostra solo i suggerimenti statici (nessun banner rumoroso).

**`archivio-client.tsx`** (RIFATTORIZZATO)
- Usa `useArchivioSearch()`; rendering pressoché invariato salvo `ActiveFilterChips` sopra i risultati e
  `RecentSearches` nell'empty-state. Su risultati vuoti con `offset>0` (es. `p` fuori range da URL
  condiviso/drift) → reset a pagina 1 riscrivendo l'URL (evita un falso "Nessun risultato").

### 4.5 Backend — tRPC `product.recentSearches` (`agentProcedure`, in `product.ts`)
```ts
recentSearches: agentProcedure
  .input(z.object({ limit: z.number().int().min(1).max(20).default(8) }).optional())
  .query(async ({ ctx, input }) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await ctx.db.activityLog.findMany({
      where: { userId: ctx.session.user.id, type: "PRODUCT_SEARCHED", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" }, take: 100, select: { metadata: true },
    });
    return deriveRecentSearches(rows, { limit: input?.limit ?? 8 });
  }),
```
Read-side puro: **nessuna** modifica al percorso di ricerca né al KPI. Indici `userId/type/createdAt` già presenti.

---

## 5. Flusso dati (Back dal dettaglio — il caso #1)

1. In `/archivio?q=cerniera&p=2` l'agente scrolla; un listener throttled ha salvato `window.scrollY`
   sotto `searchScrollKey(committed)` in `sessionStorage`. Apre un prodotto → l'Archivio si smonta;
   la cache react-query per quella query-key **resta** (gcTime alto).
2. **Back** → l'Archivio rimonta; `useSearchParams` (sotto `<Suspense>`) fornisce **subito**
   `?q=cerniera&p=2` → `committed` = query/filtri/pagina; `view` idratata da `localStorage` (post-mount).
3. `product.search` con la stessa query-key restituisce **subito** i dati in cache → lista a piena
   altezza al primo render (altezze thumbnail riservate ⇒ altezza deterministica).
4. Quando `data && !isPlaceholderData && viewLoaded` (e categorie pronte se serve), l'effetto di
   ripristino (una volta) legge lo `scrollY` salvato e fa `rAF(() => window.scrollTo(0, y))` — **dopo**
   il passaggio di scroll nativo → l'agente è dov'era.

Refresh: identico, ma passo 3 è un refetch a freddo; il ripristino scatta **dopo** l'arrivo dei dati
(altezza indipendente dalle immagini, riservate). Micro-flash "cima→posizione" accettato (rAF); da
verificare in browser.

---

## 6. Decisione A — qualità cronologia + ticket log-hygiene (deferrito)

**Scelta: Opzione A (sola lettura)** (verdetto council). La pulizia si ottiene a valle: scarto
0-risultati, dedup, collasso prefissi. **Non** si tocca il path di ricerca caldo.

**Ticket separato (deferrito), da §1:** il logging as-you-type scrive un `PRODUCT_SEARCHED` a ogni
debounce (prefissi) e ora, con la query URL-durevole, **anche** a ogni refresh/Back-freddo (§4.3).
Conseguenze: (a) **cronologia** — benigno: sono ri-date di query **già** fatte dall'utente (il dedup le
collassa, nessuna voce distinta nuova; e solo query dell'utente stesso finiscono nell'URL, non esiste
ancora "copia link"); (b) **KPI dashboard** «prodotti cercati» — gonfiato (già lo era per l'as-you-type).
Il fix corretto (loggare solo le ricerche committate) pulisce **entrambi** alla sorgente ed è il
contenuto di questo ticket. Non è scope di questa iterazione.

---

## 7. Error handling / edge cases

- `recentSearches`: `metadata` non-oggetto o senza `query` → riga ignorata (no throw). Errore query →
  empty-state con soli suggerimenti statici.
- `ProductThumb`: 404/errore → placeholder nel box (mai `null`, mai layout-shift).
- `sessionStorage`/`localStorage` assenti (private mode/quota) → fail-soft (try/catch, no-op) → feature
  degrada, app intatta.
- `parseSearchState`: URL ostile (`p=abc`, `pmin=-5`) → default sicuri.
- **`p` valido ma fuori range** (URL condiviso/drift): `product.search` con offset oltre il totale → 0
  hit. `archivio-client` rileva `hits.length===0 && offset>0` → reset a pagina 1 + riscrittura URL
  (niente falso "Nessun risultato").
- **Log fantasma** su refresh/Back-freddo: benigno per la cronologia (dedup), inciso nel ticket §6 per il KPI.
- Back dopo `gcTime` scaduto → refetch (skeleton breve) + ripristino post-dati. Degradazione, non crash.

---

## 8. Testing (TDD)

### Unit (Vitest, puri — scritti prima)
- `archivio-search-params.test.ts`: round-trip parse↔build; default su input mancante/ostile; omissione
  default; `searchScrollKey` distingue query/filtri/pagina (**non** dipende da view).
- `recent-searches.test.ts`: scarta 0-risultati/vuote; dedup case/spazi; collasso prefissi ("cer"→"cerniera";
  refinement "cerniera"→"cerniera argento"); cap `limit`; metadata malformato.
- `archivio-scroll.test.ts`: save/load/clear per chiave; fail-soft senza `window`; `null` su assente/NaN.

### Router (Vitest, db mockato)
- `product.recentSearches`: `agentProcedure` nega il pubblico; `where` a 7 giorni, `take:100`,
  `orderBy desc`; delega a `deriveRecentSearches`; ritorna la lista attesa.

### Hook (Vitest + Testing Library, render harness con `useSearchParams` mockato)
- `use-archivio-search`: (a) committare una nuova query **resetta pagina a 1** (una sola scrittura URL,
  `p` omesso, nessun render `(newQuery, oldOffset)`); (b) il ripristino scroll scatta **una sola volta**
  quando i dati in cache per la chiave corrente sono presenti (e non su placeholder); (c) `setFilters`/
  `clearFilter`/`clearAllFilters` resettano pagina.

### Componenti (Vitest + Testing Library)
- `active-filter-chips`: render chip attivi; `✕` (con `aria-label`) chiama `clearFilter`; "Azzera tutto";
  nessun chip se nessun filtro.
- `recent-searches`: recenti + suggerimenti; click imposta la query e **sposta il focus** al campo; solo
  suggerimenti se nessuna recente.
- `product-image`: con `fallback` mostra il fallback su `onError` (non `null`); senza `fallback` → `null`
  (comportamento attuale invariato).
- `product-thumb`: riserva il box; placeholder su errore.

### Verifica browser (Chromium, **≤375px + desktop**) — l'unico pezzo non-unit
- **#1 Back-con-scroll**: cerca → scrolla → apri prodotto → Back → **stessa posizione** (lista *e* griglia).
- Refresh mantiene query/filtri/vista/pagina/scroll.
- Chip filtri: rimozione singola aggiorna URL+risultati; il Back non resuscita un filtro rimosso.
- Thumbnail: lazy, nessun layout-shift, placeholder sui codici senza foto; **product-row** non va a capo a 375px.
- `pnpm build` verde (confine `<Suspense>` presente).

---

## 9. File toccati (riepilogo)

**Nuovi**
- `src/lib/archivio-search-params.ts` (+ `.test.ts`)
- `src/lib/archivio-scroll.ts` (+ `.test.ts`)
- `src/lib/recent-searches.ts` (+ `.test.ts`)
- `src/lib/use-archivio-search.ts` (+ `.test.tsx`)
- `src/components/product/product-thumb.tsx` (+ `.test.tsx`)
- `src/components/product/active-filter-chips.tsx` (+ `.test.tsx`)
- `src/components/product/recent-searches.tsx` (+ `.test.tsx`)

**Modificati**
- `src/app/(dashboard)/archivio/page.tsx` — **`<Suspense>`** attorno a `<ArchivioClient/>`
- `src/app/(dashboard)/archivio/archivio-client.tsx` — usa l'hook, chip + empty-state, reset p fuori-range
- `src/components/product/product-image.tsx` — prop `fallback`/`alt`
- `src/components/product/product-card.tsx`, `product-row.tsx` — thumbnail + griglia
- `src/components/product/product-filters.tsx` — importa `ArchivioFilters` dal modulo lib
- `src/server/api/routers/product.ts` — `recentSearches` (+ test)

**Nessuna migrazione DB. Nessuna dipendenza nuova. Nessuna AZIONE OPS al deploy.**

### Ordine di build (il fix #2 non dipende dagli extra)
1. Moduli puri + test (params, scroll, recent-searches). 2. `recentSearches` tRPC + test.
3. Hook + `<Suspense>` + rifattorizzazione `archivio-client` (persistenza + ripristino scroll) → **core #1/#2/#3**.
4. Extra: `product-image` fallback → `ProductThumb` → thumbnail su card/row; `ActiveFilterChips`; `RecentSearches`.
5. Verifica browser ≤375px + desktop.

---

## 10. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Race col ripristino nativo | Un solo proprietario dello scroll; nostro restore **dopo** il passaggio nativo (rAF), una volta, gated su dati non-placeholder + viewLoaded |
| Scroll "a volte non funziona" | Restore esplicito post-dati + altezze thumbnail **riservate** + `gcTime` alto |
| `useSearchParams` senza Suspense → build rotto | `<Suspense>` in `archivio/page.tsx` (come `login/page.tsx`) |
| Flash `list→grid` da localStorage | `view` idratata **post-mount** (default SSR deterministico) |
| Chiave scroll sbagliata (grid) | `searchScrollKey` **senza view**; restore atteso a `viewLoaded` |
| Doppia fetch/log al cambio query | Ricerca legge **solo** stato committato; scrittura URL **atomica** (q + reset p) |
| Riga chip cresce dopo il restore | Restore atteso anche a categorie risolte se filtro categoria attivo |
| Log fantasma su refresh | Benigno per cronologia (dedup); KPI nel ticket §6 |
| Over-engineering | `sessionStorage` per-chiave (no FIFO); `ProductImage` esteso (no componente doppio); thumbnail decouplate dal fix |

---

## 11. Byproduct gratis
Con lo stato in URL, la ricerca è già un **link condivisibile/segnalibile** (indirizzo copiabile).
Un pulsante "copia link" esplicito è fuori scope (non richiesto) ma quasi gratuito come follow-up.

---

## 12. Revisione critica recepita (3 lenti adversariali)
- **Blocker** `<Suspense>` mancante per `useSearchParams` → aggiunto in `page.tsx` (§3.1, §9).
- **Race** ripristino nativo vs manuale → un solo proprietario, rAF dopo il nativo (§2, §4.2).
- **Chiave scroll con view** (default al primo render) → `view` esclusa dalla chiave; restore atteso a
  `viewLoaded` (§4.1, §4.2).
- **Reset pagina** solo su query → esteso a filtri/chip/azzera; scrittura atomica (§3.2).
- **Ripristino** su primo commit + esclusione placeholder → gating esplicito (§4.2).
- **`recentSearches`** senza meccanismo di refresh → `staleTime:0`+`refetchOnMount` (§4.3).
- **product-row** senza template griglia per la thumb → template espliciti (§4.4).
- **Flash view / hydration** → idratazione post-mount (§4.2).
- **Log fantasma** su refresh → corretta l'affermazione «niente doppio-log»; inciso nel ticket §6 (§4.3, §6).
- **a11y** chip `✕` senza nome, focus perso al click chip, alt thumbnail → `aria-label`, focus al campo,
  `alt=""` decorativo (§4.4).
- **`p` fuori range** → reset a pagina 1 (§7).
- **YAGNI**: mappa FIFO → per-chiave; `ProductThumb` duplicato → estensione `ProductImage`; thumbnail
  **decouplate** dal fix core; hook con test mirati (§4.1, §4.2, §4.4, §8).
- **Salvataggio scroll** in cleanup di unmount fragile → listener throttled + `pagehide` (§4.2).
