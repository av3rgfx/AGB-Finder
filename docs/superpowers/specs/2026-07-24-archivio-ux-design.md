# Spec — UX Archivio: persistenza, ritorno-alla-lista, cronologia ricerche

**Data:** 2026-07-24
**Fase:** miglioramento UX Archivio (post Fase 1i + immagini prodotto)
**Workflow seguito:** `/using-superpowers` → brainstorming → `/llm-council` (dubbi tecnici) →
`/impeccable` (UI, mobile ≤375px + desktop) → *questa spec* → `/writing-plans` → TDD.

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

### Extra approvati (questa iterazione)
4. **Thumbnail prodotto** su card e righe (riuso immagini già estratte).
5. **Chip dei filtri attivi + "azzera"** sopra i risultati.
6. **Empty-state con suggerimenti** (ospita le ricerche recenti + suggerimenti cliccabili).

### Fuori scope (annotato per il futuro, non implementato)
- Pulsante "copia link" (la ricerca diventa comunque un **URL condivisibile** come byproduct).
- "Prodotti visti di recente", ricerche salvate/preferite, "ricerche popolari", pulizia del
  logging as-you-type + KPI dashboard (ticket separato — vedi §6).

---

## 2. Diagnosi (perché oggi si perde tutto)

`archivio-client.tsx` è un client component che tiene **tutto** lo stato in `useState`
(`query`, `filters`, `view`, `offset`). Navigare a `/archivio/[id]` via `<Link>` **smonta**
l'albero dell'Archivio → lo stato React sparisce. Al ritorno (o a un refresh) rimonta vuoto:
la ricerca è azzerata e non c'è nulla su cui ripristinare lo scroll.

**La scroll restoration nativa dell'App Router NON basta** (verdetto LLM Council, Contrarian +
Executor): sul Back il componente rimonta, la cache react-query si risolve al *microtask*
successivo (altezza `0 → piena`), e il browser ripristina lo scroll **contro un documento ancora
corto → si atterra in cima**. È l'esito di default quando l'altezza è asincrona (sempre, qui).

---

## 3. Architettura — tre meccanismi separati, uno per scopo

Il principio (First Principles + Contrarian): non risolvere tre problemi diversi con un martello
solo. Ogni concern usa il meccanismo che gli calza.

| Concern | Meccanismo | Sopravvive a |
|---|---|---|
| **A. Durevole + condivisibile** — `query`, `filtri`, `pagina` | **URL searchParams** (`?q=&cat=&pmin=&pmax=&mat=&stock=&p=`) via `window.history.replaceState` integrato da Next 15 | refresh · back · link condiviso |
| **B. Preferenza-dispositivo** — `vista` lista/griglia | **`localStorage`** (`archivio:view`) | refresh · back (stesso device) |
| **C. Ripristino scroll (Back)** — posizione + lista | **snapshot `scrollY` in `sessionStorage`** keyed sulla search-key, ripristinato dopo il paint dei dati in cache | back · refresh (stesso tab) |
| **D. Cronologia** — ricerche recenti 7gg | **tRPC read-side** su `ActivityLog.PRODUCT_SEARCHED` (nessuna tabella nuova, nessuna modifica al logging) | — |

### 3.1 Perché l'URL e non `nuqs`
Una sola pagina, ~pochi parametri: `history.replaceState` nativo (che Next 15 intercetta e
sincronizza con `useSearchParams`) evita il **refetch RSC** ad ogni tasto e non aggiunge dipendenze.
`nuqs` guadagnerebbe solo con molti parametri tipizzati su molte pagine → YAGNI.

### 3.2 Perché snapshot esplicito e non "non smontare" (route intercettata/overlay)
First Principles proponeva di non smontare l'Archivio (detail come overlay). Scartato: la scheda
dettaglio è ricca e **deep-linkabile** (immagine, specifiche, correlati, pulsante listino);
trasformarla in overlay con route intercettate è più "Next-magic", cambia la UX e si testa peggio.
Lo snapshot esplicito è incrementale, testabile, non ristruttura il routing.

---

## 4. Componenti e moduli (con confini netti)

### 4.1 Moduli puri (unit-testabili, nessuna dipendenza React)

**`src/lib/archivio-search-params.ts`**
```ts
export interface ArchivioFilters {          // spostato qui (single source), product-filters lo importa
  categoryId?: string; priceMin?: number; priceMax?: number;
  material?: string; inStockOnly?: boolean;
}
export interface ArchivioSearchState { query: string; filters: ArchivioFilters; page: number /*1-based*/ }

export function parseSearchState(sp: URLSearchParams): ArchivioSearchState;
export function buildSearchQueryString(state: ArchivioSearchState): string; // OMETTE i default (URL pulito)
export function searchScrollKey(state: ArchivioSearchState, view: "list" | "grid"): string;
```
- Mappa URL ⇄ stato. Param corti e stabili: `q, cat, pmin, pmax, mat, stock (=1), p (1-based, default 1 omesso)`.
- `parse` è tollerante: valori assenti/malformati → default (query "", nessun filtro, pagina 1).
- Reset pagina: è responsabilità del **setter** (vedi hook), non del parser.
- `searchScrollKey` include `view` (lista e griglia hanno altezze diverse).

**`src/lib/archivio-scroll.ts`**
```ts
export function saveScroll(key: string, y: number): void;
export function loadScroll(key: string): number | null;
```
- Store `sessionStorage` con **mappa cappata** (ultime ~5 chiavi, FIFO) → robusto anche con
  back/forward tra ricerche/pagine diverse (mappa cappata FIFO). SSR-safe (`typeof window` guard), fail-soft su quota/JSON.
  **Nota scroll container**: verificare in browser se scrolla `window` o un contenitore interno
  (TopBar/`main`); il salvataggio/ripristino usa l'elemento corretto (default `window`).

**`src/lib/recent-searches.ts`**
```ts
export function deriveRecentSearches(
  rows: { metadata: unknown }[],
  opts?: { limit?: number },   // default 8
): string[];
```
Regole (Outsider): da ogni riga legge `metadata.query` (string) e `metadata.results` (number);
**scarta** query vuote e ricerche a **0 risultati** (`results === 0`); normalizza (trim + collassa
spazi interni); **dedup case-insensitive** tenendo l'occorrenza più recente; **collassa i prefissi**
(scarta una query che è prefisso stretto, case-insensitive, di una già tenuta più recente); tronca a `limit`.
Le righe arrivano già ordinate `createdAt desc` dal resolver.

### 4.2 Hook di stato

**`src/lib/use-archivio-search.ts`** (client) — incapsula A + B + C, espone un'API pulita:
```ts
const {
  queryInput, setQueryInput,     // mirror locale per digitazione snella (seed dall'URL una volta)
  debouncedQuery,                // 300ms → guida sia la ricerca sia la scrittura URL
  filters, setFilters, clearFilter, clearAllFilters,
  view, setView,                 // localStorage
  page, setPage, offset,         // offset = (page-1)*PAGE_SIZE (derivato)
  scrollKey,                     // per il ripristino
} = useArchivioSearch();
```
- **Sorgente di verità = URL** per query committata/filtri/pagina; `queryInput` è solo il mirror
  dell'input. Su cambio `debouncedQuery` → scrive URL e **azzera pagina** se la query è cambiata.
- Ogni setter (filtri, chip ✕, azzera, vista, pagina) scrive **subito** l'URL via
  `history.replaceState` → l'URL resta autoritativo (evita il bug "il chip cancella il filtro ma
  l'URL no → il Back lo resuscita").
- `setView` scrive URL? **No** — solo `localStorage` (la vista non fa parte della ricerca; un link
  condiviso non deve trascinarla).
- **Ripristino scroll**: `useEffect` che salva `window.scrollY` sotto `scrollKey` (a) in cleanup
  all'unmount (copre il Back verso il dettaglio) e (b) su `pagehide` (copre refresh/chiusura tab).
  Un `useLayoutEffect`/`useEffect` che, **quando i dati per la chiave corrente sono presenti**,
  esegue `window.scrollTo(0, loadScroll(scrollKey))` una sola volta (poi consuma il valore).

### 4.3 react-query
Sulla query `product.search`: `staleTime` alto (5 min) **e** `gcTime` alto (30 min). Motivo
(peer-review): `gcTime` di default (5 min) **sfratta** la pagina in cache mentre l'agente legge il
dettaglio → lettore lento torna indietro dopo 6 min → refetch → lista vuota → cima. `staleTime`
governa il *refetch*, `gcTime` la *ritenzione*: servono **entrambi** alti. Mantiene anche
`placeholderData: keepPreviousData` (paginazione senza flicker) e evita il doppio-log al ritorno.

### 4.4 Componenti UI (nuovi/modificati)

**`src/components/product/product-thumb.tsx`** (NUOVO — distinto da `ProductImage` che ritorna `null`)
- Riserva **sempre** il box (dimensioni fisse) → niente layout-shift → **protegge lo scroll restore**.
- `<img loading="lazy" object-contain>` su bg bianco; su 404/errore mostra un **placeholder**
  nello stesso box (icona `Package`/`ImageOff`, `text-ink-subtle` su `bg-surface-sunken`), non `null`.
- Varianti: `row` (40×40, `size-10 rounded border`), `card` (larghezza piena, altezza fissa ~`h-28`).

**`src/components/product/active-filter-chips.tsx`** (NUOVO)
- Riga wrap sopra il conteggio risultati; un chip per filtro attivo: `Etichetta: valore ✕`.
  Es. `Categoria: Cerniere ✕` · `Prezzo: 10–50 € ✕` · `Materiale: acciaio ✕` · `Solo disponibili ✕`.
  Risolve il nome categoria via `api.product.listCategories` (cache). Materiale in testo normale.
- `Azzera tutto` (ghost) quando ≥1 filtro attivo. Ogni ✕ chiama `clearFilter(key)` (URL-autoritativo).
- **Mobile**: i chip sono l'unica prova visibile dei filtri attivi (la sidebar filtri è impilata in
  cima e facile da perdere di vista) → alto valore ≤375px. Wrap, nessun overflow orizzontale.

**`src/components/product/recent-searches.tsx`** (NUOVO — usato nell'empty-state)
- Sezione "Ricerche recenti" (chip cliccabili → `setQueryInput(q)`), mostrata solo se ce ne sono.
- Sezione "Prova a cercare" con 2–3 suggerimenti statici (es. `cerniera anta ribalta`, `maniglia`,
  e un codice esempio in **mono** es. `B00590`).
- Chip = `<button>` con focus-ring; codici in `font-mono`. Nessuna card-grid (anti-reference PRODUCT.md).

**`src/components/product/product-card.tsx`** / **`product-row.tsx`** (MODIFICATI)
- Card: `ProductThumb size="card"` in testa (box fisso), poi codice/nome/categoria/prezzo come oggi.
- Row: `ProductThumb size="row"` come colonna leading `auto`; nome `truncate` resta leggibile prima
  che la foto carichi (Outsider: "cerco per codice, la riga dev'essere leggibile subito").

**`archivio-client.tsx`** (RIFATTORIZZATO)
- Usa `useArchivioSearch()`; rendering pressoché invariato salvo: `ActiveFilterChips` sopra i
  risultati e `RecentSearches` dentro l'empty-state. La logica di scroll/URL/localStorage vive
  nell'hook, non nel componente.

### 4.5 Backend — tRPC

**`product.recentSearches`** (`agentProcedure`, in `src/server/api/routers/product.ts`)
```ts
recentSearches: agentProcedure
  .input(z.object({ limit: z.number().int().min(1).max(20).default(8) }).optional())
  .query(async ({ ctx, input }) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await ctx.db.activityLog.findMany({
      where: { userId: ctx.session.user.id, type: "PRODUCT_SEARCHED", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,                       // bounded: dedup/collasso avviene in memoria
      select: { metadata: true },
    });
    return deriveRecentSearches(rows, { limit: input?.limit ?? 8 });
  }),
```
- Read-side puro: **nessuna** modifica al percorso di ricerca né al KPI dashboard.
- Client: `api.product.recentSearches.useQuery` abilitata quando la query è vuota (empty-state),
  invalidata/refetch quando l'utente torna a query vuota dopo una ricerca.

---

## 5. Flusso dati (Back dal dettaglio — il caso #1)

1. In `/archivio?q=cerniera&p=2` l'agente scrolla, poi apre un prodotto → l'Archivio **si smonta**;
   il cleanup dell'effetto salva `window.scrollY` sotto `scrollKey` in `sessionStorage`.
2. `<Link href="/archivio/[id]">` naviga; la cache react-query per quella search-key **resta**
   (gcTime alto).
3. **Back** → l'Archivio rimonta con l'URL `?q=cerniera&p=2` (history) → `parseSearchState` deriva
   query/filtri/pagina; `view` da `localStorage`.
4. `product.search` con la stessa query-key restituisce **subito** i dati in cache → la lista
   ridipinge **a piena altezza** al primo commit (altezze thumbnail riservate ⇒ altezza deterministica).
5. L'effetto di ripristino vede dati presenti + `scrollKey` combaciante → `window.scrollTo(0, y)`
   **prima del paint** → l'agente è esattamente dov'era.

Refresh: identico, ma passo 4 è un refetch a freddo; il ripristino scatta **dopo** l'arrivo dei
dati (righe), corretto perché l'altezza non dipende dalle immagini (riservate).

---

## 6. Decisione A — qualità cronologia (verdetto council)

**Scelta: Opzione A (sola lettura).** Le "ricerche recenti" sono un problema di lettura; non si
tocca il percorso di ricerca caldo. La pulizia si ottiene a valle: scarto 0-risultati, dedup,
collasso prefissi. Il rumore del logging as-you-type e il KPI "prodotti cercati" che conta i
keystroke restano un **ticket separato** (data-hygiene pre-esistente), non scope-creep di questa feature.

---

## 7. Error handling / edge cases

- `product.recentSearches`: se `metadata` non è un oggetto o manca `query` → riga ignorata (no throw).
  Errore query → l'empty-state mostra solo i suggerimenti statici (nessun banner rumoroso).
- `ProductThumb`: 404/errore rete → placeholder nel box (mai `null`, mai layout-shift).
- `sessionStorage`/`localStorage` non disponibili (private mode/quota) → funzioni fail-soft
  (try/catch, no-op) → la feature degrada, l'app non si rompe.
- `parseSearchState`: input ostile nell'URL (es. `p=abc`, `pmin=-5`) → default sicuri; i filtri
  numerici negativi/NaN vengono scartati (coerente con lo schema zod di `product.search`).
- Nessun risultato in cache al Back dopo `gcTime` scaduto → refetch (spinner breve) e ripristino
  scroll post-dati; degradazione accettabile, non un crash.

---

## 8. Testing (TDD)

### Unit (Vitest, puri — scritti prima)
- `archivio-search-params.test.ts`: round-trip parse↔build; default su input mancante/ostile;
  omissione default nell'URL; `searchScrollKey` distingue list/grid e pagine.
- `recent-searches.test.ts`: scarta 0-risultati e query vuote; dedup case/spazi; collasso prefissi
  ("cer"→"cerniera"; refinement "cerniera"→"cerniera argento"); cap a `limit`; metadata malformato.
- `archivio-scroll.test.ts`: save/load per chiave; mappa cappoata (FIFO); fail-soft senza `window`.

### Router (Vitest, db mockato)
- `product.recentSearches`: `agentProcedure` nega il pubblico; costruisce il `where` a 7 giorni,
  `take:100`, `orderBy desc`; delega a `deriveRecentSearches`; ritorna la lista attesa.

### Componenti (Vitest + Testing Library)
- `active-filter-chips`: render dei chip attivi; ✕ chiama `clearFilter`; "Azzera tutto" chiama
  `clearAllFilters`; nessun chip se nessun filtro.
- `recent-searches`: mostra recenti + suggerimenti; click su un chip imposta la query; solo
  suggerimenti se nessuna recente.
- `product-thumb`: riserva il box; mostra placeholder su `onError` (niente `null`).

### Verifica browser (Chromium, **≤375px + desktop**) — l'unico pezzo non-unit
- **#1 Back-con-scroll**: cerca → scrolla → apri prodotto → Back → **stessa posizione**. (E in griglia.)
- Refresh mantiene query/filtri/vista/pagina/scroll.
- Chip filtri: rimozione singola aggiorna URL e risultati; il Back non resuscita un filtro rimosso.
- Thumbnail: lazy, nessun layout-shift, placeholder sui codici senza foto.
- Nessun overflow orizzontale a 375px; empty-state e chip leggibili.

---

## 9. File toccati (riepilogo)

**Nuovi**
- `src/lib/archivio-search-params.ts` (+ `.test.ts`)
- `src/lib/archivio-scroll.ts` (+ `.test.ts`)
- `src/lib/recent-searches.ts` (+ `.test.ts`)
- `src/lib/use-archivio-search.ts`
- `src/components/product/product-thumb.tsx` (+ `.test.tsx`)
- `src/components/product/active-filter-chips.tsx` (+ `.test.tsx`)
- `src/components/product/recent-searches.tsx` (+ `.test.tsx`)

**Modificati**
- `src/app/(dashboard)/archivio/archivio-client.tsx` (usa l'hook, aggiunge chip + empty-state)
- `src/components/product/product-card.tsx`, `product-row.tsx` (thumbnail)
- `src/components/product/product-filters.tsx` (importa `ArchivioFilters` dal modulo lib)
- `src/server/api/routers/product.ts` (`recentSearches`) (+ test)

**Nessuna migrazione DB. Nessuna dipendenza nuova. Nessuna AZIONE OPS al deploy.**

---

## 10. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Scroll restore "a volte non funziona" | Ripristino **esplicito** post-dati + altezze thumbnail **riservate** + `gcTime` alto (le tre cause note dal council) |
| `history.replaceState` desync con Next | Uso l'API nativa **integrata da Next 15**; scrivo solo la query **stabile** (debounced), mai a metà digitazione |
| URL rumoroso | `buildSearchQueryString` **omette i default** |
| Cronologia con "typo"/prefissi | `deriveRecentSearches`: scarto 0-risultati, dedup, collasso prefissi |
| Thumbnail lente su mobile | `loading="lazy"`, box riservato, testo leggibile prima dell'immagine |
| Volume log su 7gg | `take:100` + dedup in memoria (indici su `userId/type/createdAt` già presenti) |
