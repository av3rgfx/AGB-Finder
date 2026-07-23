# Visualizza nel listino — design

**Data:** 2026-07-23 · **Stato:** design approvato dall'utente · **Branch:** `claude/listino-viewer` (separato dalla vasistas/PR #20)

## Contesto

Ogni componente di un kit generato e ogni prodotto trovato in archivio/ricerca mostra
il proprio **codice AGB** (es. `A50111.15.13`). L'agente di vendita, per fugare dubbi
sulla correttezza di un codice, oggi deve cercarlo a mano nel PDF del listino. Vogliamo
un pulsante **«visualizza nel listino»** che apra il codice **direttamente** alla sua
pagina nel listino, evidenziandolo.

Fattibilità verificata: il parser `parse-listino.ts` **già separa il PDF per pagina
fisica** (marker form-feed `\f`), e i codici kit (`KitComponent.componentCode`) hanno lo
**stesso formato** dei codici prodotto (`Product.agbCode`, regex `CODE_TOKEN`). Quindi un
solo indice «codice → pagina» copre entrambe le superfici.

## Obiettivo

Un **viewer in-app** (PDF.js) che, premuto il pulsante su un codice, mostra la **pagina
del listino** dove quel codice è a prezzo ed **evidenzia** il codice. Responsive
mobile+desktop (regola inviolabile del progetto). Nessun LLM: l'indice è deterministico.

## Architettura

Quattro unità isolate: (1) indice codice→pagina, (2) serving del PDF, (3) viewer,
(4) innesti UI.

### 1. Indice codice → pagina (dato)

- **`parse-listino.ts`**: si traccia la pagina fisica corrente (contatore incrementato
  a ogni `\f`) e si aggiunge `page: number` a `ParsedRow`. La pagina registrata è quella
  della **riga di prezzo** (`PRODUCT_SIGNATURE`) = dove il codice è a listino col prezzo,
  la più utile per verificare. Modifica **behavior-preserving** sugli altri campi.
- **`prisma/schema.prisma`**: nuova colonna `Product.listinoPage Int? @map("listino_page")`.
  **Richiede una migrazione** (`add_listino_page`).
- **`import-catalog.ts` / `map-product.ts`**: mappano `row.page → Product.listinoPage`
  (import futuri lo popolano nativamente).
- **`scripts/backfill-listino-pages.ts`** (tsx idempotente): ri-parsa il PDF e fa
  `UPDATE products SET listino_page = ? WHERE agb_code = ?` — popola i 6.191 prodotti già
  su Neon **senza** re-import completo. Se un codice compare in più righe di prezzo, vince
  la prima. Codici non a catalogo: nessuna riga → nessuna pagina.

### 2. Serving del PDF (backend)

- **Hosting: Vercel Blob.** Il listino (linearizzato con `qpdf --linearize` per un
  range-loading veloce) è caricato una volta su Vercel Blob; l'URL sta in env
  `LISTINO_PDF_URL` (aggiunto a `src/env.ts` come **opzionale** — feature off se assente).
- **Route autenticata** `src/app/api/listino/route.ts` (GET): verifica la sessione Better
  Auth (AGENT/ADMIN); inoltra l'header `Range` della richiesta al fetch del blob e
  ritorna la risposta (`206 Partial Content` con `Content-Range`/`Content-Length`/
  `Accept-Ranges: bytes`, `Content-Type: application/pdf`). Così PDF.js scarica **solo i
  byte della pagina** e il listino resta dietro il login come il resto dell'app.
  - `maxDuration` coerente col cap Vercel (60s); una range-request di pagina è veloce.
  - Se `LISTINO_PDF_URL` è assente → `503` (viewer mostra errore gentile).
  - **URL del PDF configurabile** nel viewer: se il proxy desse problemi di range, si può
    puntare direttamente all'URL Blob pubblico senza toccare il viewer (mitigazione rischio).

### 3. Viewer in-app (frontend)

- Dipendenza **`react-pdf`** (wrapper su `pdfjs-dist`): dà `<Document>`/`<Page>` con
  text-layer e `customTextRenderer` per l'evidenziazione — molto meno codice del
  `pdfjs-dist` grezzo (riuso > custom). Caricato via `next/dynamic` (`ssr:false`) per
  tenerlo **fuori dal bundle iniziale**. Worker PDF.js configurato come asset locale.
- **`ListinoViewer`** (modale/overlay responsive): props `{ code, page }`. `<Document
  file="/api/listino" options={{ disableAutoFetch:true, disableStream:false }}>` +
  `<Page pageNumber={page} customTextRenderer={evidenzia(code)} />`. Controlli: chiusura
  (Esc/backdrop/pulsante), zoom, pagina ±1, indicatore «pag. N». Stato loading/errore.
- **`ListinoViewerProvider` + `useListinoViewer()`** (context): un solo viewer montato a
  livello di layout dashboard; qualunque pulsante lo apre con `open({code, page})`.
- **Evidenziazione**: nel text-layer, gli span il cui testo contiene il `code` (match
  esatto sui token del codice) ricevono un `<mark>`; auto-scroll alla prima occorrenza.

### 4. Innesti UI (dove appare il pulsante)

- **Kit generati** — `DistintaTable` (`src/components/kit/`): per ogni riga con pagina
  nota, un'azione icona «visualizza nel listino» accanto al codice mono.
- **Archivio/ricerca** — `product-card` + pagina dettaglio prodotto: stesso pulsante.
- Il pulsante appare **solo se** il codice ha `listinoPage` (dato presente).

**Modifiche query (backend):**
- `product.search` / `product.get`: includono `listinoPage` nel select.
- `kit.get`: per ogni componente, risolve la pagina joinando `Product` su
  `agbCode = componentCode` e la espone nella riga della distinta.

## Scope (minimale — YAGNI / ponytail)

- Rendering della **singola pagina** target col codice evidenziato + nav ±1 pagina + zoom.
- Copertura: componenti kit + prodotti archivio/ricerca.
- Riuso di `react-pdf` invece di reimplementare il rendering PDF.

## Non-goals

- Ricerca full-text nel listino, annotazioni, editing, offline, scroll continuo multi-pagina.
- Evidenziazione cross-pagina o di codici non a catalogo.
- Sostituire il link Drive del listino (resta la fonte per l'import).

## Testing / gate

- **Parser**: fixture con `\f` → le righe prodotto ricevono la pagina fisica corretta;
  i campi esistenti restano invariati (non-regressione sui test parser attuali).
- **Backfill**: unit sulla costruzione dell'indice (codice → prima pagina di prezzo).
- **Route `/api/listino`**: senza sessione → 401; `LISTINO_PDF_URL` assente → 503; con
  Range → inoltro e 206 (fetch mockato).
- **Helper viewer** (puri): costruzione props, matcher di evidenziazione codice.
- **`ListinoViewer`**: test componente con `react-pdf` **mockato** (il rendering PDF reale
  non è unit-testabile in jsdom) — il pulsante apre la modale e passa `{code, page}`;
  verifica reale del rendering/evidenziazione **nel browser** (Chromium, viewport ≤375px).
- Gate: `pnpm typecheck · lint · test · build`.

## Deploy / ops (fuori dai task di codice)

1. **Linearizzare** il listino (`qpdf --linearize listino.pdf listino-web.pdf`) e
   **caricarlo su Vercel Blob**; impostare `LISTINO_PDF_URL` su Vercel (+ `.env` locale).
2. **Migrazione** `add_listino_page` su Neon (via ops GitHub Actions).
3. **Backfill** `listino_page` su Neon (`scripts/backfill-listino-pages.ts` via ops).

## Rischi & mitigazioni

- **Range-loading PDF.js attraverso il proxy**: se il proxy non gestisse bene i 206,
  PDF.js scaricherebbe l'intero 41MB (lento). Mitigazione: PDF linearizzato + URL del
  viewer configurabile (fallback all'URL Blob diretto).
- **Peso `react-pdf`/`pdfjs-dist` nel bundle**: mitigato con `next/dynamic` (lazy, solo
  all'apertura del viewer).
- **Pagina fisica vs stampata**: il deep-link usa la pagina **fisica** del PDF (indice
  `\f`), che è ciò che il viewer indirizza; le pagine «stampate» a piè di pagina possono
  differire ma non ci riguardano. Da verificare che il conteggio `\f` combaci con le 959
  pagine reali (calibrazione in fase di test parser).

## Assunzioni

- Il listino su Blob è la **stessa** edizione importata (stesse pagine). Ad ogni
  aggiornamento del listino: re-upload + re-run del backfill (l'indice è rigenerato).
- Sensibilità del listino bassa (già condiviso via link Drive), ma per coerenza RBAC il
  PDF resta servito dietro autenticazione.
