# Immagini prodotto dal listino — design

**Data:** 2026-07-24 · **Stato:** approvato dall'utente · **Branch:** `claude/listino-page-split-n8ofuk` (fresco da `origin/main` dopo #26)

## Contesto e causa radice

Il viewer PDF «visualizza nel listino» (Opzione B, pagine singole) mostrava le **foto
prodotto vuote** anche dopo il fix delle range-request e dello split. **Causa vera scoperta
ispezionando il PDF reale:** le foto del listino sono **JPEG2000 (`jpx`)** — 1503 su ~1790
foto «prodotto». **PDF.js non decodifica bene il JPEG2000**, quindi le immagini non
compaiono nel viewer. Non era il range né lo split: era il *formato*.

**Decisione utente:** invece di combattere PDF.js, **estrarre le foto dal PDF e mostrarle
direttamente sulla scheda prodotto** del sito. poppler (openjpeg) decodifica il JPEG2000 →
le esportiamo in **PNG** e le serviamo come `<img>` native → il browser le mostra sempre.

## Fattibilità (verificata sul PDF reale, 959 pagine)

- **2884 immagini** su 781 pagine; filtrando il decorativo (strisce 1px, loghi) restano
  **~2028 foto «vere»** (≥250px).
- `pdfimages`/`pdftohtml` (poppler) le estraggono pulite in PNG (~10-40 KB l'una).
- **Mappatura immagine→codice deterministica:** `pdftohtml -xml -fmt png` dà in un colpo solo
  i **PNG a risoluzione nativa** + le **bounding-box** di immagini e codici. Sul layout tipico
  (foto a sinistra, codici a destra sulla stessa **banda verticale**) ogni foto si assegna ai
  codici della sua banda. Verificato: pag. 300 → 3 foto mappate correttamente a famiglie di codici.

## Architettura

### 1. Estrazione (ops, deterministica — MAI LLM)

- **`src/server/catalog/listino-images.ts`** (puro, testato): `parsePdftohtmlXml` (image/code
  bbox), `filterProductImages` (soglia dimensione), `mapImagesToCodes` (banda verticale +
  fallback «foto più vicina» entro N punti). Nessuna dipendenza esterna.
- **`scripts/extract-listino-images.ts`** (tsx, idempotente): per ogni pagina `pdftohtml -xml
  -fmt png` → parse → filtro → mappa → legge la PNG (filtro larghezza ≥200px) → **upsert
  `ProductImage`** per ogni `agbCode` **a catalogo** (batch in transazione). Env di test:
  `IMG_FROM`/`IMG_TO`/`IMG_DRY`.
- **`.github/workflows/ops-extract-images.yml`** (`workflow_dispatch`): migrate deploy (crea la
  tabella) → download listino → `pnpm extract:images`. Usa `NEON_DIRECT_URL`.

### 2. Storage

- **`ProductImage`** (Prisma, tabella **separata** da `Product`): `agbCode` PK, `data Bytes`,
  `mimeType`, `createdAt`. Separata di proposito → i byte non finiscono nelle query di
  catalogo/dettaglio (`product.getById` fa `include:{category}`, tutti i campi scalari). Una
  foto per codice. Migrazione `20260724100000_add_product_images`.
- **Tradeoff noto:** i codici di una stessa famiglia condividono la foto ma la salvano ciascuno
  (duplicazione dei byte). Totale stimato ~50-120 MB su Neon — accettabile. Se un domani diventa
  un problema, si deduplica per hash contenuto (tabella immagini distinte + puntatore). YAGNI ora.

### 3. Serving

- **`/api/product-image?code=<agbCode>`** (route Node, auth Better Auth): valida il codice
  (regex ancorata anti-injection), `db.productImage.findUnique` → streamma i byte con `mimeType`
  + `Cache-Control` lunga; 404 se assente. Immagine come `<img>` → **niente PDF.js**.

### 4. UI

- **`ProductImage`** (client): `<img src="/api/product-image?code=…" onError=hide>` — si
  nasconde se il codice non ha foto. Innestata nell'header di **`ProductDetail`** (scheda
  dettaglio archivio), responsive: foto sopra su mobile, a fianco su desktop; `bg-white` per
  contrasto in dark mode. Le thumbnail nelle card di ricerca sono un follow-up.

## Scope (MVP, ponytail)

- Estrazione + mappatura per posizione + storage DB + serving + foto sulla **scheda dettaglio**.
- Il **viewer PDF resta invariato** (utile per «trova il codice»; le foto jpx lì non le rendiamo).

## Non-goals

- Thumbnail nelle card di ricerca (follow-up), dedup per hash, ritaglio/resize, OCR,
  mappatura perfetta su layout atipici (fallback «foto più vicina» + `onError` gestiscono i buchi).

## Testing / gate

- **Helper** (`listino-images.test.ts`): parse XML, filtro, mappatura banda + fallback + non-map.
- **Route** (`product-image/route.test.ts`): 401 · 400 (codice invalido, no DB) · 404 · 200 (byte+mime).
- **Componente** (`product-image.test.tsx`): src col codice; si nasconde su `onError`.
- Estrazione validata in **dry-run** sul PDF reale (pagg. 298-305 → 107 mappature corrette).
- Gate: `typecheck · lint · test · build`.

## Ops (AZIONI UTENTE, dopo il merge)

1. Lanciare **`Ops — Estrai immagini prodotto`** (applica la migrazione + popola `product_images`).
2. Nessuna env nuova, nessun Blob. La feature è attiva appena la tabella è popolata.
3. Verifica: aprire una scheda prodotto con foto (es. codici di pag. ~100/300) → la foto compare.
