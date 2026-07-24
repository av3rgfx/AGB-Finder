# Listino viewer — Opzione B (pagine singole) — Implementation Plan

> **⚠ AGGIORNAMENTO 2026-07-24 (store PRIVATO).** Il Blob store è privato → lo split usa
> `access:"private"` e la route legge via `@vercel/blob` `get(pathname,{access:"private",token})`.
> Env: **`BLOB_READ_WRITE_TOKEN`** + `LISTINO_TOTAL_PAGES` (niente `LISTINO_PAGE_URL_TEMPLATE`);
> `@vercel/blob` in **dependencies**; rimosso l'helper `pageUrlTemplateFromUrl`. Vedi la nota nel design.

**Goal:** Servire il listino come **pagine singole** su Vercel Blob; il viewer carica solo la
paginetta target (scaricata per intero → immagini complete) invece dell'intero PDF via Range.

**Architecture:** vedi `docs/superpowers/specs/2026-07-23-listino-page-split-design.md`. L'indice
codice→pagina (`Product.listinoPage`) e gli innesti UI **non cambiano**. Cambiano: split+upload
(script + ops), route `?page=N`, env, viewer a pagina singola, layout (passa `totalPages`).

**Global constraints:** TS strict; UI in italiano, codici mono; **mobile-first ≤375px**
(inviolabile); deterministico (MAI LLM); niente Range sull'intero file; anti-SSRF sul param
`page`. Gate finali: `pnpm typecheck · lint · test · build`. Prima dei comandi prisma/tsx:
`set -a; source .env; set +a`.

---

### Task 1 — env: page-template + total-pages (TDD via route/parse)

- Modify `src/env.ts`: **rimuovi** `LISTINO_PDF_URL`; aggiungi
  `LISTINO_PAGE_URL_TEMPLATE: z.string().url().optional().refine(v => v.includes("{page}"), "manca {page}")`
  e `LISTINO_TOTAL_PAGES: z.coerce.number().int().positive().optional()`.
- Modify `.env.example`: sostituisci la voce listino con le due nuove (commentate, feature-off di default).
- Verifica `new URL(...)` accetta `{page}` (se `.url()` fosse troppo restrittivo, `z.string()` + refine).
- Gate: `pnpm typecheck`.

### Task 2 — helper puro `parsePageParam` + route `?page=N` (TDD)

- Create `src/app/api/listino/page-param.ts`: `parsePageParam(raw: string | null, total: number): number | null`
  — accetta solo `/^[1-9]\d*$/`, `Number.isSafeInteger`, `1 <= n <= total`; altrimenti `null`.
- Create/replace test `src/app/api/listino/page-param.test.ts`: validi (`1`, `418`, `total`),
  invalidi (`null`, `""`, `0`, `01`, `-1`, `1.5`, `1e3`, ` 1`, `1 `, `total+1`, `abc`).
- Rewrite `src/app/api/listino/route.ts` (single-page, no Range): 401 → 503 (env off) → 400
  (param) → fetch template risolto → 200 `application/pdf` (Content-Length inoltrato,
  `Cache-Control: private, max-age=86400`); upstream non-ok → 502.
- Rewrite `src/app/api/listino/route.test.ts`: 401; 503 (no template); 400 (page invalida);
  200 (fetch URL risolto, **nessun** header Range).
- Gate: `pnpm test -- listino`, `pnpm typecheck`.

### Task 3 — split+upload script (TDD helper) + ops workflow

- `pnpm add -D @vercel/blob`.
- Create `src/server/catalog/listino-blob.ts` (puro, testabile): `pageUrlTemplateFromUrl(page1Url): string`
  = `page1Url.replace(/page-1\.pdf(\?.*)?$/, "page-{page}.pdf")` (+ guardia se non matcha).
- Test `src/server/catalog/listino-blob.test.ts`.
- Create `scripts/split-listino.ts` (tsx): `pdfseparate` → upload paginette (`addRandomSuffix:false`,
  `allowOverwrite:true`, retry(2)); assert count; stampa `LISTINO_TOTAL_PAGES`,
  `LISTINO_PAGE_URL_TEMPLATE` (da `page-1`), URL di esempio pagina 418.
- `package.json`: script `"split:listino": "tsx --env-file-if-exists=.env scripts/split-listino.ts"`.
- Create `.github/workflows/ops-split-listino.yml` (`workflow_dispatch`, secret `BLOB_READ_WRITE_TOKEN`).
- Gate: `pnpm typecheck`, `pnpm test -- listino-blob`.

### Task 4 — viewer a pagina singola + provider + layout (TDD)

- Rewrite `src/components/listino/listino-viewer.tsx`:
  - prop `totalPages: number | null`; `file={`/api/listino?page=${current}`}`; `<Page pageNumber={1}>`.
  - rimuovi `numPages`/`onLoadSuccess`; footer `pag. {current} / {totalPages ?? "…"}`.
  - prev `disabled={current<=1}`; next `disabled={totalPages==null || current>=totalPages}`.
  - **width responsive:** `ref` sullo scroll container + `ResizeObserver` → `width={Math.min(720, misurato)}`.
- Modify `listino-viewer-provider.tsx`: prop `totalPages` → passato al viewer.
- Modify `(dashboard)/layout.tsx`: `import { env }`; `<ListinoViewerProvider totalPages={env.LISTINO_TOTAL_PAGES ?? null}>`.
- Create test `src/components/listino/listino-viewer.test.tsx` (mock `react-pdf` + TextLayer.css +
  stub `ResizeObserver`): `file` contiene `?page=418`; next → `?page=419`; `pageNumber===1`;
  footer mostra `/ {total}`; next disabilitato a `current===total`.
- Gate: `pnpm test -- listino-viewer`, `pnpm typecheck`.

### Task 5 — gate finali + docs + review

- `pnpm typecheck` · `pnpm lint` · `pnpm test` · `set -a; source .env; set +a; pnpm build`.
- Aggiorna `handoff.md` + `CLAUDE.md` (STATO).
- Review adversarial (workflow) → fix.
- Commit per task; push `-u origin claude/listino-page-split-n8ofuk`.

## Verifica end-to-end (browser, dopo ops) — mobile ≤375px + desktop

Kit/archivio → «visualizza nel listino» → pagina giusta, **immagini complete**, codice
evidenziato, nessun overflow orizzontale a 375px, prev/next fluidi.

## Ops (AZIONI UTENTE — dopo il merge)

1. Secret `BLOB_READ_WRITE_TOKEN`. 2. Run `Ops — Split listino`. 3. Su Vercel:
`LISTINO_PAGE_URL_TEMPLATE` + `LISTINO_TOTAL_PAGES` (dai log), rimuovi `LISTINO_PDF_URL`, redeploy.
4. (Opz.) elimina il vecchio `listino.pdf` dal Blob. 5. Verifica browser.
