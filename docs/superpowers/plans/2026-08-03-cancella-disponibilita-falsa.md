# Cancella la disponibilità falsa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Togliere dall'app ogni affermazione sulla disponibilità dei prodotti AGB, perché è falsa: `isAvailable` e `stockQuantity` sono scritti come costanti (`true` / `0`) all'import e poi mostrati all'agente in cinque canali diversi, incluso il payload passato a Gemini e un filtro «Solo disponibili» che non filtra nulla.

**Architecture:** Nessuna migrazione, nessun dato toccato. Le due colonne restano a schema con i loro default; si rimuovono **i consumatori**. L'ordine dei task va **dall'esterno verso la sorgente** (UI → tool AI → filtro → proiezioni SQL → mapper): così ogni task lascia `pnpm typecheck` e `pnpm build` verdi e può essere rivisto da solo.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · tRPC v11 · Prisma 6 · Vitest · Testing Library · Tailwind.

**Posizione nel progetto:** è il **passo 0** di `docs/superpowers/specs/2026-08-03-archivio-pronta-consegna-design.md` §11 — indipendente da tutto il resto, PR a sé. I passi 1-4 (modello dati e import listino · ricerca e scheda · upload pronta consegna · arricchimento da catalogo) avranno **ciascuno il proprio piano**, scritto quando arriva il suo turno: i loro dettagli dipendono da cosa produce il passo precedente, e un piano scritto in anticipo su cinque livelli di ipotesi è un piano che si riscrive.

## Global Constraints

- **TypeScript strict sempre.** Nessun `any`, nessun `@ts-ignore`.
- **Tutte le API via tRPC**; tutte le query via Prisma. **Raw SQL solo dentro `RAGEngine`.**
- **UI in italiano.** Codici prodotto in font monospace (JetBrains Mono).
- **Mobile-first:** ogni schermata toccata va verificata a **≤375px** *e* desktop prima di dirsi conclusa.
- **`jest-dom` NON è configurato**: i soli matcher disponibili sono `toBeTruthy()`, `toBeNull()`, `toBe()`, `toEqual()` e il confronto su `.textContent`. **Non usare `toBeInTheDocument()`.**
- **Idiom dei test componenti:** `@testing-library/react` + `userEvent`, nessun wrapper di provider (tRPC è mockata a livello di modulo).
- **Un commit per task**, messaggio in italiano, imperativo.
- **Gate prima di dichiarare finito:** `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- **Nessuna migrazione in questo piano.** Se un task sembra richiederne una, fermarsi: è un errore di lettura.

## Contesto: perché il difetto è sopravvissuto a 1.035 test

`src/server/catalog/map-product.ts` riga 11 dichiara `isAvailable: true` come **tipo letterale** e riga 75 lo scrive per ognuno dei 7.488 prodotti. Nessun altro punto del codice scrive quella colonna. Quindi in produzione `isAvailable === true` **sempre**, e `stockQuantity === 0` sempre.

I test erano verdi perché **testavano la finzione**: `product-card.test.tsx:41` renderizza `{ ...product, isAvailable: false }`, uno stato che non può esistere; `rag.test.ts:68` verifica che il filtro `inStockOnly` produca la sua condizione SQL, cioè che un no-op venga emesso correttamente. Quei test vanno **cancellati**, non adattati: sono la codifica del difetto, non la sua sentinella. (È lo stesso schema dei dieci test rimossi dalla PR #44.)

**I sei canali** (tutti verificati nel repo, non dedotti):

| # | Canale | Punti |
|---|---|---|
| 1 | UI archivio | `product-card.tsx:13,17-28,36` · `product-row.tsx:12` · `product-detail.tsx:80-81` |
| 2 | UI chat | `inline-products.tsx:60,63` · `chat-events.ts:23-24` · `chat/products.ts:11-12,23-24` |
| 3 | **Payload verso Gemini** | `chat/tools.ts:96` (`available`) · `:123-124` (`available`, `stock`) · `:41,64` (`inStockOnly` offerto al modello) |
| 4 | **Filtro «Solo disponibili»** | `product-filters.tsx:83-91` · `active-filter-chips.tsx:46-48` · `archivio-search-params.ts:6,31,48` · `product.ts:13` · `rag.ts:11,85` |
| 5 | Proiezioni SQL | `rag.ts:26-27,48,67-68,230` |
| 6 | Kit | `kit.ts:457` (selezionato, mai mostrato) |

Il canale 4 è il peggiore: l'agente **spunta una casella** che dice «Solo disponibili», vede il chip attivo, e riceve tutti e 7.488 i prodotti.

**Cosa NON si fa in questo piano:** non si rimuovono le colonne dallo schema (migrazione distruttiva senza guadagno), non si tocca `@@index([isAvailable])` (indice minuscolo su 7.488 righe; togliere un indice è una migrazione), non si introduce nulla di COLOMBO.

---

## File Structure

| File | Responsabilità dopo il lavoro |
|---|---|
| `src/components/product/product-card.tsx` | card + `ProductSummary` **senza** disponibilità; `AvailabilityDot` **eliminato** |
| `src/components/product/product-row.tsx` | riga senza pallino |
| `src/components/product/product-detail.tsx` | scheda senza riga «Disponibile» |
| `src/components/chat/inline-products.tsx` | card inline senza badge |
| `src/lib/chat/chat-events.ts` | `ChatProductSummary` senza i due campi |
| `src/server/chat/products.ts` | `CHAT_PRODUCT_SELECT` senza i due campi |
| `src/server/chat/tools.ts` | il modello non riceve più né `available` né `stock`, e non può più chiedere `inStockOnly` |
| `src/components/product/product-filters.tsx` | pannello filtri senza la casella «Solo disponibili» |
| `src/components/product/active-filter-chips.tsx` | nessun chip «Solo disponibili» |
| `src/lib/archivio-search-params.ts` | `ArchivioFilters` senza `inStockOnly`; il param `stock` non è più né letto né scritto |
| `src/server/api/routers/product.ts` | input di ricerca senza `inStockOnly` |
| `src/server/ai/rag.ts` | proiezioni e filtri senza le due colonne |
| `src/server/api/routers/kit.ts` | `select` della distinta senza `isAvailable` |
| `src/server/catalog/map-product.ts` | **la sorgente**: non scrive più le due costanti |

---

## Task 1: UI archivio — via il pallino verde

**Files:**
- Modify: `src/components/product/product-card.tsx`
- Modify: `src/components/product/product-row.tsx`
- Modify: `src/components/product/product-detail.tsx:78-83`
- Test: `src/components/product/product-card.test.tsx` · `src/components/product/product-row.test.tsx`

**Interfaces:**
- Consumes: niente (primo task)
- Produces: `ProductSummary` **senza** il campo `isAvailable` — i task successivi possono contare su questo. `AvailabilityDot` **non esiste più**: nessun task successivo deve importarla.

> Si parte da qui, e non dal mapper, perché `archivio-client.tsx:230,237` passa `hit` come **variabile** (`<ProductCard product={hit} />`): TypeScript non applica l'excess property check alle variabili, quindi togliere il campo dall'interfaccia **non rompe** il chiamante che ancora lo produce. Al contrario, togliere prima la sorgente romperebbe tutto in una volta.

- [ ] **Step 1: Aggiornare i test — cancellare quello che testa la finzione**

In `src/components/product/product-card.test.tsx`, **cancellare interamente** il test che renderizza `isAvailable: false` (riga ~41: `render(<ProductCard product={{ ...product, isAvailable: false }} />)` e le sue asserzioni) e togliere `isAvailable: true` dall'oggetto `product` di fixture (riga ~19).

Aggiungere in coda al file questo test, che è la sentinella del lavoro:

```tsx
it("non fa alcuna affermazione sulla disponibilità", () => {
  const { container } = render(<ProductCard product={product} />);
  expect(container.textContent?.includes("Disponibile")).toBe(false);
  expect(container.querySelector('[aria-label="Disponibile"]')).toBeNull();
  expect(container.querySelector('[aria-label="Non disponibile"]')).toBeNull();
});
```

In `src/components/product/product-row.test.tsx`: togliere `isAvailable: true` dalla fixture (riga ~19) e aggiungere lo stesso test con `<ProductRow product={product} />`.

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm vitest run src/components/product/product-card.test.tsx src/components/product/product-row.test.tsx`

Expected: FAIL. Errori attesi: TypeScript segnala `isAvailable` mancante nella fixture (`ProductSummary` lo richiede ancora), e il nuovo test fallisce perché `aria-label="Disponibile"` è presente.

- [ ] **Step 3: Togliere il campo e il componente**

In `src/components/product/product-card.tsx`: rimuovere `isAvailable: boolean;` da `ProductSummary`, **cancellare l'intera funzione `AvailabilityDot`** (righe 17-28) e la riga `<AvailabilityDot available={product.isAvailable} />`. Rimuovere l'import ora inutile di `cn` **solo se** non è più usato nel file (verificarlo: `grep -n "cn(" src/components/product/product-card.tsx`).

Il blocco riga 34-37 diventa:

```tsx
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-ink-subtle">{product.agbCode}</span>
      </div>
```

In `src/components/product/product-row.tsx`: togliere `AvailabilityDot` dall'import (resta `import { type ProductSummary } from "./product-card";`) e sostituire il blocco righe 11-14 con:

```tsx
      <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <span className="truncate font-mono">{product.agbCode}</span>
      </span>
```

In `src/components/product/product-detail.tsx`: togliere `AvailabilityDot` dall'import di riga 9 (resta `import { ProductCard } from "./product-card";`) e **cancellare** l'intero blocco righe 78-82:

```tsx
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
              <AvailabilityDot available={p.isAvailable} />
              {p.isAvailable ? "Disponibile" : "Non disponibile"}
            </span>
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/components/product/ && pnpm typecheck`

Expected: PASS su tutti i file di `src/components/product/`, typecheck pulito.

- [ ] **Step 5: Commit**

```bash
git add src/components/product/
git commit -m "fix(archivio): togli il pallino «Disponibile», che era sempre verde per costruzione"
```

---

## Task 2: UI chat — via il badge, e via i campi dal payload della UI

**Files:**
- Modify: `src/components/chat/inline-products.tsx:55-65`
- Modify: `src/lib/chat/chat-events.ts:23-24`
- Modify: `src/server/chat/products.ts:11-12,23-24`
- Test: `src/components/chat/inline-products.test.tsx` · `src/components/chat/message-turn.test.tsx`

**Interfaces:**
- Consumes: niente dal Task 1 (canale indipendente)
- Produces: `ChatProductSummary` **senza** `isAvailable` né `stockQuantity`; `CHAT_PRODUCT_SELECT` senza le due chiavi.

- [ ] **Step 1: Aggiornare i test**

In `src/components/chat/inline-products.test.tsx`: togliere `isAvailable: true,` e `stockQuantity: 4,` dalla fixture (righe ~33-34); **cancellare** il test di riga ~85 che renderizza `{ ...product, isAvailable: false }` con le sue asserzioni. Aggiungere:

```tsx
it("non mostra alcun badge di disponibilità", async () => {
  const user = userEvent.setup();
  const { container } = render(<InlineProducts products={[product]} />);
  await user.click(container.querySelector("button")!);
  expect(container.textContent?.includes("Disponibile")).toBe(false);
});
```

*(Il click apre l'elenco: nel componente le card sono dietro `expanded`.)*

In `src/components/chat/message-turn.test.tsx`: togliere `isAvailable: true,` e `stockQuantity: 4,` dalla fixture (righe ~29-30).

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm vitest run src/components/chat/inline-products.test.tsx src/components/chat/message-turn.test.tsx`

Expected: FAIL — il nuovo test trova ancora «Disponibile» nel DOM.

- [ ] **Step 3: Togliere il badge e i due campi**

In `src/components/chat/inline-products.tsx`, sostituire il blocco righe 55-65 con:

```tsx
                <div className="flex flex-wrap items-center gap-2">
                  <CopyCodeButton code={product.agbCode} />
                </div>
```

Rimuovere l'import di `cn` **solo se** non più usato nel file.

In `src/lib/chat/chat-events.ts`, togliere dalla interfaccia `ChatProductSummary`:

```ts
  isAvailable: boolean;
  stockQuantity: number;
```

In `src/server/chat/products.ts`, togliere `isAvailable: true,` e `stockQuantity: true,` da `CHAT_PRODUCT_SELECT` e le due righe corrispondenti dall'interfaccia `ChatProductSummary`.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/components/chat/ src/server/chat/ && pnpm typecheck`

Expected: PASS. Se `src/server/chat/service-stream.test.ts` o `src/server/api/routers/chat.test.ts` falliscono per via delle loro fixture, togliere i due campi anche lì — sono dati di prova, non asserzioni sul comportamento.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ src/lib/chat/ src/server/chat/products.ts
git commit -m "fix(chat): togli il badge «Disponibile» dalle card inline e i due campi dal payload UI"
```

---

## Task 3: il payload verso Gemini — l'assistente smette di dirlo a voce

**Files:**
- Modify: `src/server/chat/tools.ts:41,64,96,123-124`
- Test: `src/server/chat/tools.test.ts`

**Interfaces:**
- Consumes: `ChatProductSummary` senza i due campi (Task 2)
- Produces: l'output dei tool `search_products` e `get_product_by_code` **senza** le chiavi `available` e `stock`; lo schema JSON del tool **senza** `inStockOnly`.

> Questo è il canale più grave: `tools.ts` passa `available` e `stock` **al modello**, che può quindi affermarli in una frase a un cliente. E lo schema del tool (riga 41) *offre* a Gemini un filtro `inStockOnly` che non filtra.

- [ ] **Step 1: Scrivere il test che fallisce**

In `src/server/chat/tools.test.ts`, togliere `isAvailable: true,` e `stockQuantity: 0,` dalla fixture `hit` (righe ~20-21) e dalla fixture del prodotto usata da `get_product_by_code` (righe ~81-82). Poi aggiungere in coda al file:

```ts
describe("nessuna disponibilità verso il modello", () => {
  it("get_product_by_code non restituisce né available né stock", async () => {
    findUnique.mockResolvedValueOnce({
      id: "p1",
      agbCode: "E10073.10.16",
      name: "COMPACT DX",
      shortDescription: "Cerniere · ACCIAIO",
      basePrice: 51.59,
      priceUnit: "EUR",
      specifications: {},
      category: { name: "Cerniere" },
    });
    const result = await executeTool(db, "get_product_by_code", { agbCode: "E10073.10.16" });
    const output = result.output as Record<string, unknown>;
    expect("available" in output).toBe(false);
    expect("stock" in output).toBe(false);
  });

  it("search_products non restituisce available", async () => {
    queryRaw.mockResolvedValueOnce([hit]).mockResolvedValueOnce([{ total: 1 }]);
    const result = await executeTool(db, "search_products", { query: "cerniera" });
    const output = result.output as { results: Record<string, unknown>[] };
    expect("available" in output.results[0]!).toBe(false);
  });

  it("non offre al modello il filtro inStockOnly", () => {
    const tool = TOOL_DECLARATIONS.find((t) => t.name === "search_products")!;
    const props = tool.parameters.properties as Record<string, unknown>;
    expect("inStockOnly" in props).toBe(false);
  });
});
```

Il simbolo esportato è **`TOOL_DECLARATIONS`** (non `TOOL_DEFINITIONS`); i mock `queryRaw` / `findUnique` / `db` sono già in cima al file, riusarli.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/server/chat/tools.test.ts`

Expected: FAIL — `available` e `inStockOnly` sono ancora presenti.

- [ ] **Step 3: Togliere le tre cose**

In `src/server/chat/tools.ts`:

1. riga ~41 — cancellare la proprietà dallo schema JSON del tool:
   `inStockOnly: { type: "boolean", description: "Solo prodotti disponibili" },`
2. riga ~64 — cancellare `inStockOnly: z.boolean().optional(),` dallo zod `searchArgs`
3. riga ~96 — cancellare `available: hit.isAvailable,` dal `map` dei risultati
4. righe ~123-124 — cancellare `available: product.isAvailable,` e `stock: product.stockQuantity,`

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/server/chat/ && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/chat/tools.ts src/server/chat/tools.test.ts
git commit -m "fix(chat): l'assistente non riceve più disponibilità e giacenza, che erano costanti"
```

---

## Task 4: il filtro che mente — «Solo disponibili» sparisce

**Files:**
- Modify: `src/components/product/product-filters.tsx:83-91`
- Modify: `src/components/product/active-filter-chips.tsx:46-48`
- Modify: `src/lib/archivio-search-params.ts:6,31,48`
- Modify: `src/server/api/routers/product.ts:13`
- Modify: `src/server/ai/rag.ts:11,85`
- Test: `src/lib/archivio-search-params.test.ts` · `src/components/product/active-filter-chips.test.tsx` · `src/server/ai/rag.test.ts`

**Interfaces:**
- Consumes: niente dai task precedenti
- Produces: `ArchivioFilters` e `SearchFilters` **senza** `inStockOnly`. Il parametro URL `stock` non è più né letto né scritto.

> Un vecchio link salvato con `?stock=1` continua a funzionare: `parseSearchState` ignora i parametri che non conosce, quindi il degrado è pulito. Va **verificato con un test**, non assunto.

- [ ] **Step 1: Scrivere i test che falliscono**

In `src/lib/archivio-search-params.test.ts`: togliere `inStockOnly: true` dai due oggetti di fixture (righe ~15 e ~35) e l'asserzione di riga ~26. Aggiungere:

```ts
it("ignora il vecchio parametro stock=1 senza rompersi", () => {
  const s = parseSearchState(new URLSearchParams("q=maniglia&stock=1"));
  expect(s.query).toBe("maniglia");
  expect(Object.keys(s.filters).length).toBe(0);
});

it("non scrive mai il parametro stock", () => {
  const qs = buildSearchQueryString({ query: "x", filters: {}, page: 1 });
  expect(qs.includes("stock")).toBe(false);
});
```

In `src/components/product/active-filter-chips.test.tsx`: togliere `inStockOnly: true` dalla fixture di riga ~21 e ogni asserzione che cerchi il chip «Solo disponibili».

In `src/server/ai/rag.test.ts`: **NON cancellare** il test `"applica i filtri in modo parametrizzato (mai interpolati nella stringa)"` — verifica anche gli altri quattro filtri, che restano. Toglierne solo la riga `inStockOnly: true,` dall'input e l'asserzione `expect(query.sql).toContain("is_available");`. Il resto del test resta identico.

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm vitest run src/lib/archivio-search-params.test.ts src/components/product/active-filter-chips.test.tsx`

Expected: FAIL — `parseSearchState` popola ancora `filters.inStockOnly` da `stock=1`, quindi `Object.keys(...).length` è 1 e non 0.

- [ ] **Step 3: Togliere il filtro dai cinque punti**

1. `src/lib/archivio-search-params.ts`: togliere `inStockOnly?: boolean;` dall'interfaccia (riga 6), la riga 31 (`if (sp.get("stock") === "1") ...`) e la riga 48 (`if (f.inStockOnly) sp.set("stock", "1");`).
2. `src/components/product/product-filters.tsx`: **cancellare** l'intero `<label>` righe 83-91 (la casella «Solo disponibili»).
3. `src/components/product/active-filter-chips.tsx`: **cancellare** il blocco righe 46-48.
4. `src/server/api/routers/product.ts`: togliere `inStockOnly: z.boolean().optional(),` da `searchFiltersInput` (riga 13).
5. `src/server/ai/rag.ts`: togliere `inStockOnly?: boolean;` da `SearchFilters` (riga 11) e la riga 85 (`if (filters.inStockOnly) conditions.push(...)`).

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm vitest run && pnpm typecheck`

Expected: PASS su tutta la suite. Se altri test costruiscono filtri con `inStockOnly`, togliere il campo: è stato rimosso dal tipo, quindi il typecheck li segnala tutti.

- [ ] **Step 5: Commit**

```bash
git add src/lib/archivio-search-params.ts src/components/product/ src/server/api/routers/product.ts src/server/ai/rag.ts
git commit -m "fix(archivio): togli il filtro «Solo disponibili», che non filtrava nulla"
```

---

## Task 5: le proiezioni SQL — via le due colonne da `RAGEngine`

**Files:**
- Modify: `src/server/ai/rag.ts:26-27,48,67-68,230`
- Test: `src/server/ai/rag.test.ts`

**Interfaces:**
- Consumes: `SearchFilters` senza `inStockOnly` (Task 4); `ProductSummary` senza `isAvailable` (Task 1)
- Produces: `SearchHit` senza `isAvailable`/`stockQuantity`; `RelatedHit` senza `isAvailable`.

> Si arriva qui **dopo** aver tolto tutti i consumatori: adesso nessuno legge più quei campi, quindi rimuoverli dalle proiezioni non rompe niente. Il contrario avrebbe rotto sei file in una volta.

- [ ] **Step 1: Scrivere il test che fallisce**

In `src/server/ai/rag.test.ts`, togliere `isAvailable: true,` e `stockQuantity: 0,` dalla fixture `hit` (righe ~17-18) e aggiungere in coda:

```ts
describe("nessuna colonna di disponibilità nelle proiezioni", () => {
  it("search non seleziona is_available né stock_quantity", async () => {
    await new RAGEngine(db).search("cerniera");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).not.toContain("is_available");
    expect(query.sql).not.toContain("stock_quantity");
  });

  it("getRelated non seleziona is_available", async () => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValueOnce([]);
    await new RAGEngine(db).getRelated("p1");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).not.toContain("is_available");
  });
});
```

Gli helper `queryRaw`, `db` e `sqlOf` sono già in cima al file — riusarli. Nota: il `beforeEach` del file arma `queryRaw` con due `mockResolvedValueOnce` (righe e totale), che è ciò che serve a `search`; per `getRelated`, che fa **una** query sola, il test la ri-arma da sé.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/server/ai/rag.test.ts`

Expected: FAIL — `is_available` compare ancora in `HIT_PROJECTION`.

- [ ] **Step 3: Togliere le colonne dalle proiezioni**

In `src/server/ai/rag.ts`:

1. dall'interfaccia `SearchHit` (righe 26-27) togliere `isAvailable: boolean;` e `stockQuantity: number;`
2. dall'interfaccia `RelatedHit` (riga 48) togliere `isAvailable: boolean;`
3. in `HIT_PROJECTION` togliere le due righe:

```
  p.is_available        AS "isAvailable",
  p.stock_quantity      AS "stockQuantity",
```

4. in `getRelated` (riga 230) togliere `p.is_available       AS "isAvailable"` — **attenzione alla virgola**: la riga precedente (`c.name AS "categoryName",`) deve perdere la virgola finale e diventare l'ultima della `SELECT`.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/server/ai/ && pnpm typecheck && pnpm build`

Expected: PASS, typecheck pulito, build a 18 route.

- [ ] **Step 5: Commit**

```bash
git add src/server/ai/rag.ts src/server/ai/rag.test.ts
git commit -m "fix(rag): togli disponibilità e giacenza dalle proiezioni SQL"
```

---

## Task 6: la sorgente — il mapper smette di inventare, e il kit smette di selezionare

**Files:**
- Modify: `src/server/catalog/map-product.ts:11-12,75-76`
- Modify: `src/server/api/routers/kit.ts:457`
- Test: `src/server/catalog/map-product.test.ts`

**Interfaces:**
- Consumes: tutto quanto sopra (nessun consumatore residuo)
- Produces: `ProductUpsertData` senza `isAvailable` né `stockQuantity`.

> `import-catalog.ts:43` fa `const { categorySlug, specifications, ...fields } = toProductData(row)` e passa `...fields` a Prisma: togliendo i due campi, Prisma applica i **default di schema** (`stock_quantity = 0`, `is_available = true`). **Il dato a DB non cambia** — cambia che il codice non lo afferma più. Nessuna migrazione, nessun re-import necessario.

- [ ] **Step 1: Scrivere il test che fallisce**

In `src/server/catalog/map-product.test.ts`, togliere `isAvailable: true,` e `stockQuantity: 0,` dall'oggetto atteso (righe ~73-74) e aggiungere:

```ts
it("non inventa la disponibilità: il mapper non scrive quelle colonne", () => {
  const data = toProductData(rigaDiEsempio) as Record<string, unknown>;
  expect("isAvailable" in data).toBe(false);
  expect("stockQuantity" in data).toBe(false);
});
```

*(`rigaDiEsempio` è la fixture `ParsedRow` già presente nel file: riusarla.)*

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/server/catalog/map-product.test.ts`

Expected: FAIL — le due chiavi sono ancora nell'oggetto restituito.

- [ ] **Step 3: Togliere le due costanti**

In `src/server/catalog/map-product.ts`, dall'interfaccia `ProductUpsertData` togliere:

```ts
  isAvailable: true;
  stockQuantity: 0;
```

e dall'oggetto restituito da `toProductData` togliere:

```ts
    isAvailable: true,
    stockQuantity: 0,
```

In `src/server/api/routers/kit.ts` riga 457, togliere `isAvailable: true,` dal `select` annidato del prodotto (resta `id`, `agbCode`, `name`, `listinoPage`).

- [ ] **Step 4: Eseguire tutta la suite**

Run: `pnpm vitest run && pnpm typecheck`

Expected: PASS. `kit.test.ts` potrebbe avere fixture con `isAvailable`: toglierlo dove il typecheck lo segnala.

- [ ] **Step 5: Commit**

```bash
git add src/server/catalog/ src/server/api/routers/kit.ts
git commit -m "fix(catalogo): il mapper non scrive più disponibilità e giacenza costanti"
```

---

## Task 7: gate completo e verifica nel browser

**Files:** nessuno da modificare (salvo correzioni emerse).

**Interfaces:**
- Consumes: tutti i task precedenti
- Produces: la prova che l'app non afferma più nulla sulla disponibilità.

- [ ] **Step 1: I quattro gate**

Run, in quest'ordine:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: typecheck pulito · lint **senza warning** · suite verde (il totale scenderà: alcuni test sono stati cancellati perché testavano la finzione — è voluto, e va scritto nel messaggio della PR) · build a **18 route**.

- [ ] **Step 2: La prova che non è rimasto niente**

Run:

```bash
grep -rn "isAvailable\|stockQuantity\|inStockOnly\|AvailabilityDot" src --include=*.ts --include=*.tsx
```

Expected: **nessun risultato.** Se ne resta qualcuno, o è un consumatore dimenticato (va tolto) o è dentro `prisma/schema.prisma` (che non è in `src/` e va lasciato).

- [ ] **Step 3: Verifica nel browser, desktop e 375px**

Avviare l'app (`pnpm dev`, con Postgres attivo — vedi `handoff.md` §Ambiente) e con Chromium controllare, **guardando gli screenshot**, non solo i verdi:

1. `/archivio` desktop — nessun pallino sulle card, nessuna casella «Solo disponibili» nel pannello filtri
2. `/archivio` a **375px** — la griglia non si è rotta togliendo il pallino dalla riga
3. `/archivio/<id>` — la scheda non dice più «Disponibile»; il blocco intestazione non ha un vuoto strano dove stava
4. `/assistente` — una domanda che citi prodotti: le card inline non hanno il badge
5. `/richieste/<id>` — la distinta si apre (il `select` del kit è stato toccato)

- [ ] **Step 4: Commit finale ed apertura PR**

```bash
git add -A
git commit -m "docs: verifica browser della rimozione della disponibilità falsa"
git push -u origin claude/colombo-handles-catalog-3ado13
```

**Corpo della PR** — dire esplicitamente le due cose che un revisore deve sapere:

1. **Il numero dei test scende**, e non è una regressione: sono stati cancellati i test che verificavano uno stato irraggiungibile (`isAvailable: false`) e un filtro no-op. Elencarli.
2. **Nessuna migrazione, nessun re-import, nessuna azione ops.** Le colonne restano a schema coi loro default; cambia solo che nessuno le legge.

---

## Note per chi esegue

- **Se un task sembra richiedere una migrazione, fermarsi**: questo piano non ne ha nessuna. Le colonne restano.
- **Se il typecheck segnala un file non elencato qui**, è un consumatore che l'inventario ha mancato: toglierlo e **annotarlo nel messaggio di commit**, così l'inventario resta vero.
- **Non sostituire il pallino con un altro indicatore** («in arrivo», «n/d», un tooltip): il punto del lavoro è che l'app **non sa** se un prodotto è disponibile, e non deve fingere di saperlo in una forma nuova. La disponibilità vera arriva col dominio COLOMBO (spec `2026-08-03-archivio-pronta-consegna-design.md`), con la sua data accanto.
