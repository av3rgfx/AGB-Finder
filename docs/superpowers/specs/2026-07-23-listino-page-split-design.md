# Listino viewer — Opzione B (pre-split in pagine singole) — design

**Data:** 2026-07-23 · **Stato:** design approvato (utente) + validato da council · **Branch:** `claude/listino-page-split-n8ofuk` (fresco da `origin/main` dopo il merge #20–#24)

> **⚠ AGGIORNAMENTO 2026-07-24 (store PRIVATO).** Al primo run ops lo split ha rivelato che
> il Blob store dell'utente è **privato** (`Cannot use public access on a private store`).
> Pivot dal template-URL pubblico a una lettura **server-side col token**: lo split carica con
> `access:"private"` e la route legge la paginetta con `@vercel/blob` `get(pathname,{access:"private",token})`.
> Conseguenze (sostituiscono i dettagli «pubblici» qui sotto): **env** = `BLOB_READ_WRITE_TOKEN`
> (al posto di `LISTINO_PAGE_URL_TEMPLATE`) + `LISTINO_TOTAL_PAGES`; `@vercel/blob` passa a
> **dependencies** (la route lo importa a runtime); il listino non è **mai** raggiungibile
> pubblicamente (risolve del tutto il finding low sull'enumerabilità); l'helper
> `pageUrlTemplateFromUrl` è rimosso (non serve più un URL pubblico). Il resto del design
> (split per pagina, viewer a pagina singola, mobile-first, anti-SSRF sul param) è invariato.

## Contesto e problema

La feature «visualizza nel listino» (PR #21, LIVE) apre un viewer `react-pdf` alla
pagina del listino di un codice AGB, evidenziandolo. Il PDF (unico, ~41 MB linearizzato)
è servito da Vercel Blob dietro auth (`/api/listino`, con Range). **Problema aperto:** le
immagini dei prodotti si vedono solo in parte. Causa: con le range-request PDF.js disegna
la pagina prima che tutti gli XObject immagine (grossi) siano arrivati e **non ri-disegna**;
in più le molte richieste-range concorrenti verso la route proxy possono non completare.

## Obiettivo — Opzione B (decisa dall'utente)

Pre-**split** del listino in **pagine singole**: ogni pagina diventa un file minuscolo
(~100–300 KB) con **tutte** le sue immagini. Il viewer carica solo la paginetta target →
scaricata **per intero** (niente range) → immagini complete, veloce, ottimo su mobile.
Evidenziazione del codice preservata (text-layer intatto). Deterministico, MAI LLM.

## Architettura (4 unità, invariata la parte «dato»)

L'indice codice→pagina (`Product.listinoPage`, parser page-aware, backfill) **non cambia**:
`listinoPage` è già la **pagina fisica 1-based** del PDF. Cambiano solo (2) serving e (3) viewer.
Gli innesti UI (`ListinoButton`, distinta kit, product-card) **non cambiano**: continuano a
passare `{code, page}`.

### 1. Split + upload (nuovo — ops)

- **`scripts/split-listino.ts`** (tsx, idempotente): `pdfseparate listino.pdf page-%d.pdf`
  (poppler, già in ops) → per ogni `page-N.pdf` upload su **Vercel Blob** con
  `@vercel/blob` `put("listino/page-N.pdf", buf, { access:"public", addRandomSuffix:false,
  allowOverwrite:true, contentType:"application/pdf", token })`. Naming **prevedibile** e
  ri-eseguibile (overwrite). Retry per-put (429/rete). Alla fine **stampa**:
  `LISTINO_TOTAL_PAGES=<N>`, il `LISTINO_PAGE_URL_TEMPLATE` derivato dall'URL di `page-1`
  (`…/listino/page-1.pdf` → `…/listino/page-{page}.pdf`), e un URL di esempio per la
  pagina 418 (verifica vasistas).
  - **Numerazione:** `%d` **senza zero-pad** (`page-418.pdf`, non `page-0418.pdf`) — deve
    combaciare con `listinoPage` (intero) e con `String(n)` del template.
  - **Sorgente:** lo **stesso** PDF che ha prodotto `listinoPage` (stesso link registrato).
    **Niente linearizzazione** (serviva solo a range-streammare il monolite: Opzione B la
    rimuove; la linearizzazione non cambia numero/ordine pagine ma è un passo inutile).
  - **Verifica (nel job):** asserire che il numero di file == `pdfinfo` pagine; spot-check
    che `page-418.pdf` contenga il codice vasistas prima di considerare il set valido.
- **`.github/workflows/ops-split-listino.yml`** (`workflow_dispatch`): checkout → pnpm →
  poppler → download listino (stesso default di `ops-neon`) → `pnpm split:listino listino.pdf`.
  Secret nuovo: **`BLOB_READ_WRITE_TOKEN`**. Nessuna operazione DB (workflow separato).

### 2. Serving — route `/api/listino?page=N` (auth)

- **`src/app/api/listino/route.ts`**: verifica sessione Better Auth → 401 se assente. Se
  `LISTINO_PAGE_URL_TEMPLATE`/`LISTINO_TOTAL_PAGES` assenti → **503** (feature off). **Valida**
  `page` (anti-SSRF): solo `/^[1-9]\d*$/` + intero in `[1, LISTINO_TOTAL_PAGES]`, altrimenti
  **400**. Costruisce l'URL `template.replace("{page}", String(n))`, `fetch`, streamma **200
  `application/pdf`** (Content-Length inoltrato, `Cache-Control: private, max-age` — le pagine
  sono immutabili). **Niente Range** (la paginetta è piccola → download intero → tutte le
  immagini; è il punto di Opzione B). Upstream non-ok → 502.
- **env** (`src/env.ts`): rimuovi `LISTINO_PDF_URL`; aggiungi
  `LISTINO_PAGE_URL_TEMPLATE: z.string().url().optional().refine(has "{page}")` e
  `LISTINO_TOTAL_PAGES: z.coerce.number().int().positive().optional()`. Entrambe **server-only**
  (mai `NEXT_PUBLIC`: il client passa solo da `/api/listino`).

### 3. Viewer — documento a pagina singola

- **`listino-viewer.tsx`**: `<Document file={`/api/listino?page=${current}`}>` +
  **`<Page pageNumber={1}>`** (ogni file ha 1 pagina). **Rimuovi** `onLoadSuccess`/`numPages`
  (sarebbe sempre 1). `totalPages` arriva come **prop**. Footer: `pag. {current} / {totalPages}`.
  prev `disabled={current<=1}`, next `disabled={totalPages==null || current>=totalPages}`.
  prev/next cambiano `current` → cambia l'URL `file` → react-pdf ricarica la paginetta
  (v10.4.1 distrugge il `loadingTask` precedente e ignora le risoluzioni stale: click rapidi
  sicuri). Mantieni `customTextRenderer={highlight}`, `renderAnnotationLayer={false}`,
  `PDF_OPTIONS` come **const a livello di modulo** (identità stabile), worker config invariata.
- **Mobile-first (regola inviolabile) — fix del bug esistente `width={720}`:** un canvas 720px
  overflowa a 375px (un canvas non si può ridimensionare via CSS senza sfocare). Misura il
  contenitore di scroll con `ref` + `ResizeObserver` e passa `width={Math.min(720, misurato)}`.
  Da **ri-verificare a ≤375px**.
- **`totalPages` (nessun tRPC):** il **layout server** (`(dashboard)/layout.tsx`, già server
  component) legge `env.LISTINO_TOTAL_PAGES` e lo passa a `<ListinoViewerProvider totalPages>`
  → `<ListinoViewer totalPages>`. È una costante di deploy: una query tRPC sarebbe over-engineering.

## Scope (minimale — ponytail/YAGNI)

- Split+upload paginette; route per-pagina; viewer a pagina singola con width responsive.
- Innesti UI, indice codice→pagina, evidenziazione: **invariati**.

## Non-goals

- Ricerca full-text nel listino, scroll continuo multi-pagina, prefetch vicini, pruning
  automatico dei blob vecchi, blob privati/firmati (il listino è già condiviso via Drive).

## Testing / gate

- **Route** (`route.test.ts` riscritto): 401 senza sessione; 503 se env non configurate;
  **400** su page non valida/out-of-range (`0`, `01`, `-1`, `1.5`, `1e3`, spazi, `>total`);
  **200** su page valida → fetch dell'URL risolto dal template, **nessun header Range** inviato.
- **`parsePageParam`** (helper puro): tabella dei casi validi/invalidi (SSRF).
- **`pageUrlTemplateFromUrl`** (helper puro dello script): `…/page-1.pdf` → `…/page-{page}.pdf`.
- **`ListinoViewer`** (react-pdf **mockato**, jsdom): `file` contiene `?page=N`; prev/next
  aggiornano l'URL; `pageNumber===1`; footer `pag. N / total`; next disabilitato all'ultima.
- **Rendering reale** (canvas/worker non testabili in jsdom): verifica **browser** Chromium a
  **≤375px** e desktop, dopo gli step ops.
- Gate: `pnpm typecheck · lint · test · build`.

## Deploy / ops (fuori dai task di codice) — AZIONI UTENTE

1. **Secret** `BLOB_READ_WRITE_TOKEN` (GitHub Actions) — token Read/Write del Blob store.
2. Lanciare **`Ops — Split listino`** (`ops-split-listino.yml`): split + upload delle ~959
   paginette. Leggere dal log **`LISTINO_TOTAL_PAGES`** e **`LISTINO_PAGE_URL_TEMPLATE`**.
3. Impostare su **Vercel (Production)** `LISTINO_PAGE_URL_TEMPLATE` e `LISTINO_TOTAL_PAGES`;
   **rimuovere** `LISTINO_PDF_URL` (non più letto). Redeploy.
4. (Opzionale) cancellare dal Blob il vecchio `listino.pdf` monolitico (storage).
5. Verifica browser (≤375px + desktop): un codice → pagina giusta, **immagini complete**,
   codice evidenziato.
6. A ogni **nuova edizione** del listino: re-run del backfill (`ops-neon`) **e** del
   `ops-split-listino` (indice + paginette rigenerati in lockstep).

## Rischi & mitigazioni (dal council)

- **Off-by-one costoso:** split su un PDF diverso da quello del backfill → ogni deep-link
  sbagliato. Mitigazione: stessa sorgente, no linearize, assert count==pdfinfo, spot-check 418.
- **Flicker di navigazione:** cambiare `file` rimonta `<Page>` (mostra il `loading`). Accettato
  (file minuscoli + cache immutabile). **Non** usare `key={current}` (rimonta più pesante).
- **Blob pubblico enumerabile** (`…/page-N.pdf`): già vero oggi per il monolite; l'auth della
  route non è un vero confine ma evita di esporre l'host. Template **server-only**.
- **Env a metà** (solo una delle due impostata): il pulsante appare (dato in DB) ma il viewer
  erra. Gate: feature «on» solo con **entrambe** presenti; next-disable tratta `totalPages` nullo.
- **429 durante 959 put:** retry per-put + `allowOverwrite` per re-run puliti.
