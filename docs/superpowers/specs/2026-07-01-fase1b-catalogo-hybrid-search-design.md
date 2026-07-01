# Fase 1b — Catalogo AGB + Hybrid Search — Design

**Status:** approvato (scope) — in attesa di review dello spec.
**Data:** 2026-07-01

## Goal

Importare il listino AGB 2026 nel database, esporre ricerca prodotti (ibrida
full-text + vector-ready) via tRPC, e fornire l'UI Archivio + dettaglio
prodotto. Un agente cerca "cerniere ARTECH" o un codice e trova i prodotti in
< 1s.

## Contesto empirico (dal PDF reale)

Il `LISTINO 2026` AGB è un PDF di **959 pagine / 39 MB**. Estratto con
`pdftotext -layout` (poppler): 41.092 righe. Struttura pagina-prodotto:

```
SERRATURE                                   LISTINO 2026   ← categoria (header MAIUSCOLO)
Incontri - Sicurezza                                       ← sottocategoria
   Mod.120 Ala, lame in asse...                            ← titolo gruppo
   ACCIAIO                                                 ← materiale
   LUNGHEZZA   FINITURA          CODICE          € CS      ← intestazioni colonna
   238 mm      Ottonato lucido   B00590.15.03 25 250 1,23 A2   ← 1 riga = 1 prodotto
               Nichelato lucido  B00590.15.06 25 250 1,35 A2
```

- **Anchor riga-prodotto:** `[A-Z]\d{5}\.\d{2}\.\d{2}` (codice) + confezione
  (2 interi) + prezzo € (formato IT `1.234,56`) + classe sconto `[A-Z]\d`.
- Empirico: **~6.300 codici AGB distinti** (l'app avrà ~6.3k prodotti, non 20k);
  8.217 righe matchano la firma rigida. Categorie derivabili dagli header.
- I moduli d'ordine / front matter (es. software AGB 4K, pag. 30) NON hanno la
  firma → si filtrano.

## Regole di progetto rispettate

- **Nessun LLM** per l'estrazione (parser deterministico) — regola #1.
- **Raw SQL solo per pgvector**, incapsulato in un unico modulo `RAGEngine`
  (`$queryRaw`/`$executeRaw`). Eccezione sanzionata (l'ARCHITETTURA la usa);
  nessun raw SQL sparso altrove — tutto il resto via Prisma.
- Codici prodotto in **monospace** nell'UI; UI in **italiano**.
- Embedding = **AI**: interfaccia astratta, generazione reale differita dietro
  `GEMINI_API_KEY` + coda (regola "AI via BullMQ").

## Architettura & componenti

### 1. Parser deterministico — `src/server/catalog/parse-listino.ts`
Funzione **pura** `parseListino(text: string): ParseResult`:

```ts
interface ParsedRow {
  agbCode: string;          // B00590.15.03
  priceCents: number;       // 123  (da "1,23"; interi in centesimi per precisione)
  category: string;         // "SERRATURE" (header normalizzato)
  subcategory: string | null;
  groupTitle: string | null;   // "Mod.120 Ala, lame in asse..."
  material: string | null;     // "ACCIAIO"
  finish: string | null;       // "Ottonato lucido"
  dimension: string | null;    // "238 mm" / "ø 14"
  hand: "DX" | "SX" | null;    // MANO
  packBox: number | null;      // primo intero confezione
  packCarton: number | null;   // secondo intero
  discountClass: string | null;// "A2"
  rawLine: string;
}
interface ParseResult { rows: ParsedRow[]; stats: { pages: number; codeLines: number; parsed: number; skipped: number }; }
```

Algoritmo (state machine su righe, con marker di pagina `\f`):
- Mantiene stato: `currentCategory` (header MAIUSCOLO in cima pagina, ripulito
  da "LISTINO 2026" e spazi), `currentSubcategory`, `currentGroupTitle`,
  `currentMaterial`, `currentDimension` (per ereditarietà quando la riga non la
  ripete).
- Righe-header di colonna (`FINITURA|CODICE|LUNGHEZZA|ALTEZZA|MANO|€|CS`) e
  righe materiale (`ACCIAIO|OTTONE|ALLUMINIO|ZAMA|…`) aggiornano lo stato ma non
  emettono prodotti.
- Riga che matcha la firma → emette `ParsedRow`: codice, prezzo (comma→centesimi),
  confezione, CS; testo prima del codice → finish/hand/dimension (con ereditarietà).
- `stats` per il report di copertura. Righe-codice che non completano la firma →
  `skipped` (loggate, non bloccano).

**Testabile al 100%** su blocchi di testo campione reali (serrature, cerniere,
profili) senza PDF né poppler.

### 2. Estrazione PDF — `src/server/catalog/extract-pdf.ts`
Thin wrapper: `extractPdfText(pdfPath): Promise<string>` → esegue
`pdftotext -layout <pdf> -` (poppler-utils, prerequisito documentato come per gli
engine Prisma). Isolato dal parser così i test non dipendono dal binario.

### 3. Import script — `scripts/import-agb.ts` (`pnpm import:agb <pdf>`)
`extractPdfText` → `parseListino` → per categoria: upsert `ProductCategory`
(slug da header: `SERRATURE`→`serrature`); per riga: upsert `Product` by
`agbCode` (dedup automatico) in batch (`createMany`/`upsert` a blocchi di ~500).
Mapping → §"Data model". Idempotente. Stampa report copertura (parsed/skipped/
categorie/prodotti). Il **PDF non è committato** (gitignored); l'import gira in
locale/admin.

### 4. Seed catalogo sintetico — `prisma/seed-catalog.ts` (committato)
~40-60 prodotti AGB **reali** (codici/prezzi estratti dal PDF, hard-coded) su
categorie base, per test deterministici e dev senza il PDF da 39 MB. Invocato da
`pnpm db:seed` (esteso) o separato. Niente embedding (colonna null).

### 5. EmbeddingService — `src/server/ai/embedding.ts`
```ts
export interface EmbeddingService { generate(text: string): Promise<number[]>; }  // len === EMBEDDING_DIM
```
- `EMBEDDING_DIM = 768` (già definito).
- **Assenza = tsvector-only:** in Fase 1b non esiste alcun `EmbeddingService` in
  produzione (nessuna key); `RAGEngine` è costruito **senza** embeddings → ramo
  solo-tsvector. Non serve un servizio "null".
- `GeminiEmbeddingService` (differito, costruito ma non cablato nel runtime di
  default): `gemini-embedding-001`, `outputDimensionality: 768`, **L2-normalizzato**,
  `taskType` RETRIEVAL_DOCUMENT/QUERY. Attivo solo con `GEMINI_API_KEY`.
  (Verificare prima la raggiungibilità dell'API dalla sandbox.)
- Nei **test**, un `FakeEmbeddingService` deterministico (vettore fisso a 768
  dim) esercita il ramo vettoriale del RAGEngine.
- Generazione batch reale degli embedding = **fuori scope 1b** (arriva con la
  coda BullMQ); la colonna resta null e la ricerca degrada a tsvector.

### 6. RAGEngine — `src/server/ai/rag.ts` (UNICO punto di raw SQL)
```ts
class RAGEngine {
  constructor(db, embeddings?: EmbeddingService);
  search(query, filters?, opts?): Promise<SearchHit[]>;
  getRelated(productId, limit): Promise<RelatedHit[]>;
}
```
- **Degradazione graceful**: se non c'è `EmbeddingService` (o l'embedding query è
  null), usa SOLO il ramo tsvector (`ts_rank` + `plainto_tsquery('italian', …)`);
  se disponibile, aggiunge il ramo vettoriale (`<=> ::vector`, cosine) e combina
  con pesi 0.4/0.6 (CTE come ARCHITETTURA §4.2).
- Filtri (categoria/prezzo/materiale/inStock) applicati in SQL in modo
  parametrizzato (mai interpolazione stringa).
- Ritorna righe già proiettate + `textScore`/`vectorScore` + `queryTimeMs`.

### 7. Product router — `src/server/api/routers/product.ts`
`agentProcedure` (RBAC): `search(query, filters, limit, offset)` → RAGEngine;
`getById(id)`; `getByCode(agbCode)`; `listCategories(parentId?)`
(`publicProcedure`); `getRelated(productId, limit)`. I/O tipizzati con zod
(schemi in §3.5 doc). Registrato in `appRouter`. Log attività `PRODUCT_SEARCHED`.

### 8. UI (→ **impeccable**) — `src/app/(dashboard)/archivio/`
- **Archivio** (`page.tsx`, wireframe §5): barra ricerca (query → `product.search`),
  toggle griglia/lista, sidebar filtri (categoria, prezzo, materiale, disponibilità),
  `ProductCard`/`ProductRow` (codice in **monospace**, prezzo, categoria, badge
  disponibilità), stati empty/loading (skeleton)/error, paginazione.
- **Dettaglio** (`archivio/[id]/page.tsx`): specifiche (JSON → tabella), prezzo,
  disponibilità, prodotti correlati (`getRelated`), codice monospace con copy.
- Componenti in `src/components/product/`. Tutto client-safe via tRPC (`api.product.*`).

## Data model (mapping ParsedRow → Product)

| Product | da |
|---|---|
| `agbCode` | `agbCode` |
| `sku` | `agbCode` (unico) |
| `name` | compose: `${groupTitle} ${finish} ${dimension}`.trim() (fallback categoria+codice) |
| `basePrice` | `priceCents/100` (Decimal(12,2)) |
| `categoryId` | upsert da `category` (slug) |
| `specifications` (JSON) | `{ finitura, materiale, dimensione, mano, confezione:{scatola,cartone}, classeSconto, sottocategoria, gruppo }` |
| `priceUnit` | `"EUR"` · `isAvailable` `true` · `stockQuantity` `0` · `embedding` `null` |

`search_vector` popolato dal trigger tsvector esistente (name/description/code).

## Data flow

`pdf → extractPdfText → parseListino → upsert(categorie, prodotti)` (offline).
Runtime: `Archivio → api.product.search → RAGEngine.search → $queryRaw (tsvector
[+vector]) → hits → UI`.

## Error handling
- Parser: righe anomale → `skipped` + log, mai crash; report finale.
- Import: batch in transazione per blocco; un blocco fallito loggato, prosegue.
- Search: query vuota → validazione zod; nessun risultato → empty state UI;
  errore → toast IT.
- Embedding assente → ramo tsvector (nessun errore).

## Testing
- **Unit `parseListino`** su blocchi reali (serrature/cerniere/profili): estrae
  codici/prezzi/finiture/categorie attesi; conta parsed/skipped; gestisce
  ereditarietà dimensione e MANO dx/sx.
- **Unit mapping** ParsedRow→Product (name compose, specifications, priceCents).
- **product router** su seed sintetico: search per termine trova prodotto atteso;
  getByCode; listCategories; RBAC (non-agent → UNAUTHORIZED).
- **RAGEngine degradation**: senza EmbeddingService usa solo tsvector (integrazione
  su DB dockerizzato con seed).
- **UI**: render ProductCard (codice monospace), stati empty/loading.

## Scope / Out of scope
**In scope 1b:** parser, extract wrapper, import script (tutto il catalogo ~6.3k),
seed sintetico, EmbeddingService (interfaccia + null/gemini-deferred), RAGEngine
(tsvector now, vector-ready), product router, UI Archivio + dettaglio, test.

**Fuori scope (fasi successive):** generazione batch reale degli embedding via
BullMQ (1c/2d), chat AI/tool `search_products` (1c), kit engine (1d), catalogo
pubblico (Fase 2). La colonna `embedding` resta null finché la coda non gira.
