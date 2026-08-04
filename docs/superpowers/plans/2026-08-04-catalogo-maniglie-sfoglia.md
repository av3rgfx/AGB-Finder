# «Sfoglia» — il catalogo maniglie senza digitare · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dare a `/maniglie` un percorso che elenchi il catalogo COLOMBO **senza digitare nulla**,
su tre livelli costruiti esclusivamente su parole scritte da COLOMBO nel listino.

**Architecture:** livello 1 = la **prima parola** della descrizione (114 valori, un `GROUP BY` raw SQL
dentro `search.ts`, l'unico modulo maniglie autorizzato); livello 2 = la **famiglia**, cioè il token
della descrizione che compare nel codice (funzione pura in TypeScript, **mai** raw SQL: è una regola
di dominio); livello 3 = i codici, che sono lo stesso componente dei risultati di ricerca. Zero
migrazioni, zero colonne nuove, nessun dato persistito: i gruppi si calcolano a lettura, quindi un
listino nuovo si colloca da solo.

**Tech Stack:** Next.js 15 App Router · tRPC v11 · Prisma 6 + Postgres · Tailwind 3 · Vitest.

## Global Constraints

- TypeScript strict. Tutte le API via tRPC. Tutte le query via Prisma, **tranne** il raw SQL confinato
  in `src/server/ai/rag.ts` e `src/server/maniglie/search.ts` — questo piano **non ne apre un terzo**.
- UI in italiano. Codici prodotto in `font-mono` (JetBrains Mono).
- **Mobile-first**: ogni schermata progettata e **verificata a ≤ 375px** prima di dirsi conclusa.
- **Nessuna disponibilità senza la data dell'ultimo import.** La fascia data è già in `StockDate`.
- **Niente regexp sul codice per dedurre categoria** (§9 della spec): la famiglia si trova
  intersecando descrizione e codice, entrambi scritti da COLOMBO.
- **Niente schermata «scegli la marca»** finché la marca è una.
- Le etichette sono **parole di COLOMBO verbatim**: nessuna fusione di `ROS.`/`ROSETTA`, nessun
  «Altro» che raccoglie ciò che non si è saputo classificare.
- Decisioni utente di questa sessione: livello 1 ordinato **per numero di codici**; i gruppi **senza
  famiglia saltano il livello 2**; **niente foto** in questo passo.

---

### Task 1: `taxonomy.ts` — le regole di raggruppamento in un modulo foglia

Oggi `firstWord`/`familyTokenIndex` vivono in `listino-measure.ts`, che è uno strumento di misura.
Diventano codice di produzione: vanno in un modulo foglia, così **esiste una sola definizione** di
«prima parola» e di «famiglia», usata dallo script di misura e dall'app.

**Files:**
- Create: `src/server/maniglie/taxonomy.ts`
- Create: `src/server/maniglie/taxonomy.test.ts`
- Modify: `src/server/maniglie/listino-measure.ts` (importa invece di definire; ri-esporta per non
  toccare lo script)
- Modify: `src/server/maniglie/listino-measure.test.ts` (i test delle tre funzioni si spostano)

**Interfaces:**
- Produces:
  - `firstWord(name: string): string`
  - `secondToken(name: string): string | null`
  - `familyTokenIndex(name: string, codeNorm: string): number | null`
  - `familyOf(name: string, codeNorm: string): string | null` — **nuova**: il token stesso, non l'indice
  - `SQL_FIRST_WORD: string` — il gemello SQL, come costante, così i due non possono divergere in silenzio

- [ ] **Step 1: creare `taxonomy.ts` spostando le tre funzioni e aggiungendo `familyOf` + `SQL_FIRST_WORD`**

```ts
import { normalizeArticleCode } from "./code-norm";

/** Il gemello SQL di `firstWord`, come costante: i due DEVONO restare la stessa regola. */
export const SQL_FIRST_WORD = `split_part(regexp_replace(upper(trim(name)), '\\s+', ' ', 'g'), ' ', 1)`;

export function firstWord(name: string): string { /* invariato da listino-measure.ts */ }
export function secondToken(name: string): string | null { /* invariato */ }
export function familyTokenIndex(name: string, codeNorm: string): number | null { /* invariato */ }

/** La famiglia come parola, non come indice: è ciò che serve al raggruppamento. */
export function familyOf(name: string, codeNorm: string): string | null {
  const i = familyTokenIndex(name, codeNorm);
  return i === null ? null : name.trim().toUpperCase().split(/\s+/)[i]!;
}
```

- [ ] **Step 2: test di `familyOf`**

```ts
it("restituisce la parola, non l'indice", () => {
  expect(familyOf("PLACCA PEGASO PL70 CROMAT", "0AM11PL70CM")).toBe("PL70");
});
it("è null quando nessun token aggancia il codice", () => {
  expect(familyOf("KIT MONTAGGIO", "0KITX")).toBeNull();
});
```

- [ ] **Step 3: `pnpm vitest run src/server/maniglie/` — tutto verde, `pnpm typecheck`**
- [ ] **Step 4: commit** — `refactor(maniglie): le regole di raggruppamento in un modulo foglia`

---

### Task 2: livello 1 — `browseFirstWords` (raw SQL, dentro `search.ts`)

**Files:**
- Modify: `src/server/maniglie/search.ts`
- Modify: `src/server/maniglie/search.integration.test.ts` (gated su `INTEGRATION_DATABASE_URL`)

**Interfaces:**
- Consumes: `SQL_FIRST_WORD`, `firstWord` (Task 1)
- Produces: `browseFirstWords(db, brand): Promise<{ word: string; count: number }[]>` — ordinato per
  `count DESC, word ASC`

- [ ] **Step 1: test di integrazione che LEGA il SQL alla funzione TS**

È il test che conta: se qualcuno cambia `firstWord` in TypeScript e non il SQL (o viceversa), il
numero misurato smette di essere il numero mostrato.

```ts
it("il GROUP BY SQL dà gli stessi gruppi di firstWord() in TypeScript", async () => {
  const sql = await browseFirstWords(db, "COLOMBO");
  const rows = await db.article.findMany({ where: { brand: "COLOMBO" }, select: { name: true } });
  const ts = new Map<string, number>();
  for (const r of rows) ts.set(firstWord(r.name), (ts.get(firstWord(r.name)) ?? 0) + 1);
  expect(sql.length).toBe(ts.size);
  for (const g of sql) expect(g.count).toBe(ts.get(g.word));
});
```

- [ ] **Step 2: eseguirlo e vederlo fallire** (`browseFirstWords` non esiste)
- [ ] **Step 3: implementare**

```ts
export async function browseFirstWords(db: PrismaClient, brand: string) {
  const rows = await db.$queryRaw<{ word: string; n: bigint }[]>`
    SELECT ${Prisma.raw(SQL_FIRST_WORD)} AS word, COUNT(*)::bigint AS n
    FROM articles a WHERE a.brand = ${brand}
    GROUP BY 1 ORDER BY n DESC, word ASC
  `;
  return rows.map((r) => ({ word: r.word, count: Number(r.n) }));
}
```

⚠️ `SQL_FIRST_WORD` usa `name`, non `a.name`: nella `SELECT` con alias `a` va qualificato. Verificare
che il test passi davvero prima di proseguire.

- [ ] **Step 4: `INTEGRATION_DATABASE_URL=… pnpm vitest run src/server/maniglie/search.integration.test.ts`** — verde
- [ ] **Step 5: commit** — `feat(maniglie): livello 1 dello sfoglio, legato al suo gemello SQL da un test`

---

### Task 3: livello 2 e 3 — famiglie e codici del gruppo

Il livello 2 **non** è raw SQL: la famiglia è una regola di dominio, e sta in TypeScript come la
disponibilità sta in `stock-status.ts`. Si leggono le righe del gruppo (al massimo 338: MANIGLIONE) e
si raggruppa in memoria con `familyOf`.

**Files:**
- Modify: `src/server/maniglie/search.ts` (aggiunge `articleIdsByFirstWord`)
- Create: `src/server/maniglie/browse.ts`
- Create: `src/server/maniglie/browse.test.ts`

**Interfaces:**
- Produces:
  - `articleIdsByFirstWord(db, brand, word): Promise<{ id, code, codeNorm, name }[]>` (raw SQL, ordinato per `code`)
  - `groupByFamily(rows): { family: string; count: number }[]` — puro; **esclude** i senza famiglia
  - `filterByFamily(rows, family): typeof rows` — puro

- [ ] **Step 1: test puri di `browse.ts`**

```ts
const R = (code: string, name: string) => ({ id: code, code, codeNorm: code.replace(/[^A-Z0-9]/g, ""), name });

it("raggruppa per famiglia, ordinando per numerosità", () => {
  const g = groupByFamily([R("0CB11R-CM", "LARA CB11R CROMAT"), R("0CB11R-OL", "LARA CB11R OROPLUS"), R("0CB12DK-CM", "LARA CB12DK CROMAT")]);
  expect(g).toEqual([{ family: "CB11R", count: 2 }, { family: "CB12DK", count: 1 }]);
});

it("i codici senza famiglia NON diventano un gruppo «Altro»", () => {
  expect(groupByFamily([R("0KIT1", "KIT MONTAGGIO PORTE")])).toEqual([]);
});

it("filtra per famiglia", () => {
  const rows = [R("0CB11R-CM", "LARA CB11R CROMAT"), R("0CB12DK-CM", "LARA CB12DK CROMAT")];
  expect(filterByFamily(rows, "CB11R").map((r) => r.code)).toEqual(["0CB11R-CM"]);
});
```

- [ ] **Step 2: eseguire, vedere fallire**
- [ ] **Step 3: implementare `browse.ts` (puro) e `articleIdsByFirstWord` (raw SQL con `SQL_FIRST_WORD`)**
- [ ] **Step 4: `pnpm vitest run src/server/maniglie/browse.test.ts`** — verde
- [ ] **Step 5: commit** — `feat(maniglie): livello 2, la famiglia dal listino e non dal codice`

---

### Task 4: il router — `browseGroups`, `browseFamilies`, e `search` che accetta `tipo`

**Files:**
- Modify: `src/server/api/routers/article.ts`
- Create: `src/server/api/routers/article-browse.test.ts`

**Interfaces:**
- Produces:
  - `article.browseGroups({ brand? })` → `{ groups: { word, count }[], importedAt: Date | null }`
  - `article.browseFamilies({ brand?, tipo })` → `{ families: { family, count }[], total: number }`
  - `article.search` input diventa `{ query?, tipo?, famiglia?, brand?, limit, offset }` con
    **almeno uno fra `query` e `tipo`**; l'output non cambia (stesso `ArticleSummary`).

- [ ] **Step 1: test dello schema di input**

```ts
it("rifiuta una ricerca senza né query né tipo", () => {
  expect(searchInputSchema.safeParse({}).success).toBe(false);
});
it("accetta il solo tipo: è lo sfoglio", () => {
  expect(searchInputSchema.safeParse({ tipo: "MANIGLIONE" }).success).toBe(true);
});
it("accetta la sola query: è la ricerca di sempre", () => {
  expect(searchInputSchema.safeParse({ query: "lara" }).success).toBe(true);
});
```

- [ ] **Step 2: eseguire, vedere fallire**
- [ ] **Step 3: implementare.** `search` smista: con `tipo` usa `articleIdsByFirstWord` +
  `filterByFamily` + `slice(offset, offset+limit)`; con `query` la strada di oggi. **`resolveStock` e
  `toSummary` restano condivisi** — la disponibilità e la data non si duplicano.
- [ ] **Step 4: `pnpm vitest run src/server/api/routers/` + `pnpm typecheck`** — verde
- [ ] **Step 5: commit** — `feat(maniglie): il router sa sfogliare, non solo cercare`

---

### Task 5: la UI di «Sfoglia» — livelli 1 e 2

**Files:**
- Create: `src/components/maniglie/sfoglia.tsx`
- Create: `src/components/maniglie/sfoglia.test.tsx`
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.tsx`
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

**Interfaces:**
- Consumes: `article.browseGroups`, `article.browseFamilies` (Task 4)
- Produces: `<Sfoglia />`, e in `maniglie-client.tsx` la lettura di `tipo`/`fam` dagli searchParams.

Regole di schermo (decisioni utente + `/impeccable`):
- righe da **44px**, una colonna, `TIPOLOGIA · n · chevron`;
- sopra l'elenco, in chiaro: *«raggruppato per la prima parola della descrizione del listino»* — la
  fonte dichiarata è ciò che impedisce all'etichetta di sembrare una nostra classificazione;
- ordine **per numero di codici**;
- un gruppo **senza famiglie** salta il livello 2 e apre direttamente i codici;
- filtri attivi come **chip con la ✕**, come nell'archivio serramenti.

- [ ] **Step 1: test — «Sfoglia» compare quando la casella è vuota, e sparisce quando si digita**
- [ ] **Step 2: test — un gruppo senza famiglie porta diritto ai codici** (`?tipo=KIT` → lista codici)
- [ ] **Step 3: eseguire, vedere fallire**
- [ ] **Step 4: implementare**
- [ ] **Step 5: `pnpm vitest run src/components/maniglie/ src/app/\(dashboard\)/maniglie/`** — verde
- [ ] **Step 6: commit** — `feat(maniglie): «Sfoglia», il catalogo senza digitare`

---

### Task 6: il debito `offset` — «Mostra altri»

Oggi il client manda `{query, limit: PAGE_SIZE}` e **mai** `offset`: con 3.456 articoli veri, cercare
«maniglione» mostra 20 righe su 338 e non esiste modo di vedere le altre. È un difetto **già in
produzione**, non un requisito dello sfoglio.

**Files:**
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.tsx`
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

- [ ] **Step 1: test — con `total > hits.length` compare «Mostra altri», e cliccarlo chiede la pagina successiva**
- [ ] **Step 2: eseguire, vedere fallire**
- [ ] **Step 3: implementare.** Accumulo per pagine con `offset` crescente; l'`offset` **si azzera**
  quando cambia query, `tipo` o `famiglia` (test dedicato: senza, la seconda ricerca parte da metà).
- [ ] **Step 4: verde**
- [ ] **Step 5: commit** — `fix(maniglie): l'offset era raccolto dal router e mai mandato dal client`

---

### Task 7: la fascia della data **sticky**

In una lista lunga il banner in cima esce dallo schermo dopo una passata di pollice, e restano
**pallini verdi senza data** — cioè un'affermazione di disponibilità senza la sua fonte.

**Files:**
- Modify: `src/components/maniglie/stock-date.tsx`
- Modify: `src/components/maniglie/stock-date.test.tsx`

- [ ] **Step 1: test — la fascia ha `position: sticky` e un `top` dichiarato**
- [ ] **Step 2: implementare** (`sticky top-0 z-10` + fondo opaco: senza sfondo pieno il testo si
  sovrappone alle righe che scorrono sotto)
- [ ] **Step 3: verde + commit** — `feat(maniglie): la data resta a schermo mentre si scorre`

---

### Task 8: il ripristino dello scorrimento, **riusando** `archivio-scroll.ts`

Per l'archivio serramenti è costato una sessione e **due bug trovati solo col browser vero** (il
salvataggio a 0 e il `rAF` annullato dalla cleanup). Non si reinventa.

**Files:**
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.tsx`
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

- [ ] **Step 1: test — la chiave di scorrimento cambia con query/tipo/famiglia/pagina**
- [ ] **Step 2: implementare** con `saveScroll`/`loadScroll`/`shouldRestoreScroll` da
  `@/lib/archivio-scroll`. Salvataggio su **`pointerdown` in cattura** + `pagehide`, **mai** su scroll
  o unmount (Next scrolla in cima aprendo la scheda: salverebbe 0).
- [ ] **Step 3: verde + commit** — `feat(maniglie): tornando dalla scheda si riprende da dov'eri`

---

### Task 9: verifica in browser sui dati veri, desktop **e 375px**

Il DB locale ha i **3.456 articoli veri** (importati in questa sessione). La pronta consegna si carica
da `/maniglie/import`, così il pallino verde è vero anche lui.

- [ ] **Step 1:** `pnpm dev` (⚠️ **mai** `pnpm build` mentre gira: condividono `.next` e il dev server
  serve 404 su tutti i chunk)
- [ ] **Step 2:** Chromium con `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`,
  **mai** `npx playwright install`
- [ ] **Step 3:** percorso completo a **375px**: `/maniglie` → «Sfoglia» → MANIGLIONE → una famiglia →
  un codice → indietro (lo scorrimento riprende) → «Mostra altri» → la data resta visibile scorrendo
- [ ] **Step 4:** lo stesso a desktop
- [ ] **Step 5:** screenshot guardati uno per uno, non solo raccolti
- [ ] **Step 6: commit** delle eventuali correzioni

---

## Fuori scope, dichiarato

- **Le foto** (decisione utente): il catalogo `ER MAN 2026` serve ora **solo** per quelle.
- **La marca come chip**: alla marca #2, `article.search` prende già `brand`.
- **Fondere `ROS.` con `ROSETTA`**: sarebbe indovinare; `ROBOTE` (1 codice) non si sa se sia `ROBOT` o
  `ROBOTRE`.
- **Il 20% senza famiglia** (699 codici) resta senza livello 2, ed è l'assenza del dato che si vede.
