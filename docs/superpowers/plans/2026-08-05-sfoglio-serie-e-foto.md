# Sfoglio a serie, tendine e foto di anteprima — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lo sfoglio del catalogo maniglie mostra le foto, raggruppa il 98,2% dei codici in «serie» apribili a tendina più d'una alla volta, e non ha più etichette doppie al primo livello.

**Architecture:** Tutto si calcola **a lettura**. La regola delle serie è TypeScript puro in `browse.ts` (regola di dominio, come la disponibilità in `stock-status.ts`); il raw SQL resta confinato a `search.ts` e riceve al massimo una lista di id già decisa. La classificazione avviene sempre sull'**insieme intero** del gruppo, e i filtri si applicano dopo. Il livello 2 diventa una tendina `<details>` nativa il cui stato vive nell'URL.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · tRPC v11 · Prisma 6 + PostgreSQL · Tailwind 3 · Vitest.

## Global Constraints

- TypeScript strict. Tutte le API via tRPC. Tutte le query via Prisma; il raw SQL resta nei due moduli nominati (`src/server/ai/rag.ts`, `src/server/maniglie/search.ts`) e **non contiene regole di dominio**.
- UI **in italiano**; codici prodotto in **font monospace**.
- **Mobile-first**: ogni schermata va progettata e verificata a **≤375px** oltre che a desktop.
- **Nessuna migrazione del database, nessun run ops, nessuna dipendenza nuova.** Se un task sembra richiederne una, fermarsi e segnalarlo.
- Il repo è **pubblico**: nessun dato di listino, giacenza o foto del fornitore nei file versionati. Nei `.md` solo numeri aggregati.
- Denominatore di tutte le percentuali di copertura: **3.393** codici sfogliabili (3.456 meno i 63 esclusi dalla curatela).
- Un commit per task, messaggio in italiano.

---

## File Structure

| File | Responsabilità | Stato |
|---|---|---|
| `src/server/maniglie/taxonomy.ts` | prima parola, secondo token, famiglia dalla descrizione | invariato |
| `src/server/maniglie/curatela.ts` | etichette di sfoglio **per marca**: fusioni, esclusioni, divisioni, risoluzione di un'etichetta vecchia | modificato (T1, T2) |
| `src/server/maniglie/browse.ts` | **la regola delle serie a tre gradini**, la divisione del gruppo, la scelta della foto rappresentativa | riscritto (T3, T4, T5) |
| `src/server/maniglie/foto-archivio.ts` | abbinamento foto↔articolo; **nuovo**: quali etichette COLOMBO fotografa come modello | modificato (T1, T6) |
| `src/server/maniglie/search.ts` | raw SQL: ricerca testuale + `GROUP BY` di livello 1 | modificato (T1) |
| `src/server/api/routers/article.ts` | orchestrazione, filtri, proiezione | modificato (T5, T6, T9) |
| `src/components/maniglie/sfoglia.tsx` | tessere di livello 1, tendine di livello 2, chip, filtri | riscritto (T7, T8, T10) |
| `src/app/(dashboard)/maniglie/maniglie-client.tsx` | stato in URL, orchestrazione delle query, ripristino scroll | modificato (T8, T9) |

---

## Task 1: La curatela diventa per marca, e accoglie le fusioni nuove

**Files:**
- Modify: `src/server/maniglie/curatela.ts`
- Modify: `src/server/maniglie/search.ts` (chiamate a `browseLabel`/`foldBrowseGroups`/`sourceFirstWords`)
- Modify: `src/server/maniglie/foto-archivio.ts` (`abbinaFoto` chiama `browseLabel`)
- Modify: `scripts/foto-colombo.ts` (passa la marca ad `abbinaFoto`)
- Test: `src/server/maniglie/curatela.test.ts`

**Interfaces:**
- Consumes: `firstWord`, `secondToken` da `taxonomy.ts` (invariati)
- Produces:
  - `browseLabel(brand: string, name: string): string | null`
  - `foldBrowseGroups(brand: string, rows: TokenCount[]): { word: string; count: number }[]`
  - `sourceFirstWords(brand: string, label: string): string[]`
  - `vociCuratela(brand: string): string[]` — tutte le prime parole citate dalle tabelle di quella marca, per il gate anti-marciume
  - `abbinaFoto(brand: string, articoli: ArticoloDaAbbinare[], foto: FotoArchivio[]): Map<string, string>`

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/server/maniglie/curatela.test.ts`, aggiungi in fondo:

```ts
describe("browseLabel — le fusioni nuove (misurate sul listino LP 02-26)", () => {
  test.each([
    // Tutte e quattro le etichette «maniglia» dicono INCASSO: misurato 56/57,
    // 4/4, 28/28, 1/1. Chiamare la voce «MANIGLIA» prometterebbe tutte le
    // maniglie e ne conterebbe 90, mentre le 129 di ROBOT stanno altrove.
    ["MANIG. INCASSO CB111CF CROMAT", "MANIGLIA INCASSO"],
    ["MANIG.INCASSO CD511 BRONZO AN.", "MANIGLIA INCASSO"],
    ["MANIGLIA INCASSO ID411", "MANIGLIA INCASSO"],
    ["MANIGLIE INCASSO Q PER A/S", "MANIGLIA INCASSO"],
    ["MANIGLIONI AM213Y ACC.A/S CRMT", "MANIGLIONE"],
    ["PL.OTT. 85mm. + SOTTOPL.NYLON", "PL."],
    ["PL.OTT.YALE 93mm+SOTTOPL.NYLON", "PL."],
    ["RG ADAPTOR PER DUMMY", "DUMMY"],
  ])("«%s» si elenca sotto %s", (name, atteso) => {
    expect(browseLabel("COLOMBO", name)).toBe(atteso);
  });

  test("RONDELLE non si sfoglia più: la pagina dichiarava il falso", () => {
    // A schermo c'è scritto «viti, dadi, chiavi e rondelle non si sfogliano»,
    // ma solo RONDELLA era esclusa: RONDELLE (2 codici) compariva nell'elenco.
    expect(browseLabel("COLOMBO", "RONDELLE BENZING")).toBe(null);
  });

  test("MANIG.CD213 NON entra fra le maniglie da incasso: è uno scorrevole", () => {
    expect(browseLabel("COLOMBO", "MANIG.CD213 SCOR.COMPLAN. CM")).toBe("MANIG.CD213");
  });

  test("LUNDCREM resta fuori da LUND", () => {
    // Fonderlo farebbe ereditare a una cremonese la foto della maniglia LUND:
    // `abbinaFoto` assegna le foto di modello per etichetta di sfoglio, e LUND
    // ha un archivio fotografico. Una foto che esiste, si vede benissimo, ed è
    // di un altro prodotto.
    expect(browseLabel("COLOMBO", "LUNDCREM SE12 GRAFITE MAT")).toBe("LUNDCREM");
  });

  test("PLACCA non si fonde con PL.: stessa parola, due prodotti", () => {
    // PL.* sono placche in ottone `PB02*`; PLACCA è la placca dei maniglioni
    // `0AM113PL*`.
    expect(browseLabel("COLOMBO", "PLACCA AM113 CROMAT")).toBe("PLACCA");
  });
});

describe("la curatela è per marca", () => {
  test("una marca sconosciuta non riceve le correzioni di COLOMBO", () => {
    // Il giorno di HOPPE, `ROS.` di HOPPE non deve diventare ROSETTA per una
    // regola scritta guardando il listino di un altro fornitore.
    expect(browseLabel("HOPPE", "ROS. OTT. + SOTTOR. NYLON + 5")).toBe("ROS.");
    expect(browseLabel("HOPPE", "VITE M4X30 TESTA SVASATA")).toBe("VITE");
  });

  test("vociCuratela elenca le prime parole citate dalle tabelle di quella marca", () => {
    expect(vociCuratela("COLOMBO")).toContain("BOCCEHTTA");
    expect(vociCuratela("COLOMBO")).toContain("RONDELLE");
    expect(vociCuratela("HOPPE")).toEqual([]);
  });
});
```

Aggiorna l'`import` in cima al file:

```ts
import { browseLabel, foldBrowseGroups, sourceFirstWords, vociCuratela } from "./curatela";
```

e aggiungi `"COLOMBO"` come primo argomento a **tutte** le chiamate a `browseLabel`, `foldBrowseGroups` e `sourceFirstWords` già presenti nel file.

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm vitest run src/server/maniglie/curatela.test.ts`
Expected: FAIL — `vociCuratela is not exported`, e gli altri per numero di argomenti.

- [ ] **Step 3: Riscrivi `curatela.ts` con le tabelle per marca**

Sostituisci le tre costanti e le quattro funzioni con:

```ts
/**
 * Le tabelle sono PER MARCA. `browseLabel` non aveva `brand`, e con HOPPE,
 * OLIVARI, DND e GHIDINI in arrivo le correzioni scritte guardando il listino
 * COLOMBO si sarebbero applicate in silenzio alle loro etichette: nessun
 * conteggio sarebbe andato a zero, e nessuno se ne sarebbe accorto. Costa un
 * parametro oggi.
 */
interface Curatela {
  fusioni: Record<string, string>;
  escluse: ReadonlySet<string>;
  divise: ReadonlySet<string>;
}

const CURATELE: Record<string, Curatela> = {
  COLOMBO: {
    fusioni: {
      BOCCEHTTA: "BOCCHETTA", //          2 codici — refuso del fornitore
      NOTTOLIN: "NOTTOLINO", //           1
      KITPORTE: "KIT", //                 1 — «KIT PORTE» è scritto attaccato
      "DUMMY/C": "DUMMY", //              3
      "MOV.GRATZ": "MOVIMENTO", //        1 ┐ Andrea ha detto «Mov.»: sono due
      "MOV.MARTELLINA": "MOVIMENTO", //   2 ┘ etichette
      "ROS.": "ROSETTA", //              58
      ROBOCINQUQ: "ROBOCINQUE", //        1 — il codice `ID61RSB` è del base
      ROBOTE: "ROBOTRE", //               1 — il codice `CD92DK` è di Robotre

      // ── 2026-08-05, chieste dal titolare e misurate ─────────────────────
      // Le quattro etichette «maniglia» dicono tutte INCASSO (56/57, 4/4,
      // 28/28, 1/1): la voce fusa lo dice, o prometterebbe tutte le maniglie
      // e ne conterebbe 90 mentre le 129 di ROBOT stanno in un'altra voce.
      "MANIG.": "MANIGLIA INCASSO", //   57
      "MANIG.INCASSO": "MANIGLIA INCASSO", // 4
      MANIGLIA: "MANIGLIA INCASSO", //   28
      MANIGLIE: "MANIGLIA INCASSO", //    1
      MANIGLIONI: "MANIGLIONE", //        8 — plurale
      "PL.OTT.": "PL.", //                1 ┐ stesso prodotto: placca ottone
      "PL.OTT.YALE": "PL.", //           11 ┘ + sottoplacca nylon, codici PB02*
      RG: "DUMMY", //                     1 — «RG ADAPTOR PER DUMMY»
    },
    // `RONDELLE` (2 codici) entra qui il 2026-08-05: la pagina dichiarava già
    // «viti, dadi, chiavi e rondelle non si sfogliano», ma esclusa era solo
    // RONDELLA. Era una frase falsa a schermo, non una svista di tassonomia.
    escluse: new Set(["VITE", "VITI", "RONDELLA", "RONDELLE", "DADO", "CHIAVE"]),
    divise: new Set(["ROBOCINQUE", "ROBOQUATTRO"]),
  },
};

const VUOTA: Curatela = { fusioni: {}, escluse: new Set(), divise: new Set() };
const curatelaDi = (brand: string): Curatela => CURATELE[brand] ?? VUOTA;

const MARCATORE_S = /^S'?$|^S'/;

export function browseLabel(brand: string, name: string): string | null {
  return labelFromTokens(brand, firstWord(name), secondToken(name));
}

function labelFromTokens(brand: string, first: string, second: string | null): string | null {
  const c = curatelaDi(brand);
  if (c.escluse.has(first)) return null;
  if (c.divise.has(first) && MARCATORE_S.test(second ?? "")) return `${first} S`;
  return c.fusioni[first] ?? first;
}

export function foldBrowseGroups(
  brand: string,
  rows: TokenCount[],
): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = labelFromTokens(brand, r.first, r.second || null);
    if (label === null) continue;
    counts.set(label, (counts.get(label) ?? 0) + r.count);
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => a.word.localeCompare(b.word, "it"));
}

export function sourceFirstWords(brand: string, label: string): string[] {
  const c = curatelaDi(brand);
  if (c.escluse.has(label)) return [];
  const base = label.endsWith(" S") ? label.slice(0, -2) : label;
  if (label.endsWith(" S")) return c.divise.has(base) ? [base] : [];
  const words = new Set<string>();
  if (!(base in c.fusioni)) words.add(base);
  for (const [storta, giusta] of Object.entries(c.fusioni)) {
    if (giusta === label) words.add(storta);
  }
  return [...words].sort();
}

/**
 * Tutte le prime parole citate dalle tabelle di una marca. Serve al gate che
 * impedisce alla curatela di marcire: il test esistente verifica solo che le
 * etichette storte NON compaiano, e passerebbe identico il giorno in cui
 * COLOMBO corregge `BOCCEHTTA` e la voce diventa morta.
 */
export function vociCuratela(brand: string): string[] {
  const c = curatelaDi(brand);
  return [...Object.keys(c.fusioni), ...c.escluse, ...c.divise].sort();
}
```

⚠️ `sourceFirstWords` ora **non aggiunge `base` se `base` è a sua volta una chiave di fusione**: senza, `sourceFirstWords("COLOMBO", "PL.")` restituirebbe `PL.` insieme a `PL.OTT.` e `PL.OTT.YALE`, il che è giusto (`PL.` è anche una parola vera), ma `sourceFirstWords("COLOMBO", "MANIGLIA INCASSO")` non deve contenere `MANIGLIA INCASSO`, che nessuna riga scrive. La condizione copre entrambi i casi: `PL.` non è una chiave di `fusioni`, quindi resta; `MANIGLIA INCASSO` non è una chiave e non è nemmeno la prima parola di nessuna riga, quindi il `WHERE` non troverebbe nulla — per questo il ramo che lo aggiunge va tolto solo per le etichette **coniate** dalla fusione. Implementazione corretta: aggiungi `base` sempre **tranne** quando nessuna riga potrebbe averlo come prima parola, cioè quando `base` contiene uno spazio (`MANIGLIA INCASSO`) o è il valore di una fusione senza esserne chiave. Sostituisci quel blocco con:

```ts
  const words = new Set<string>();
  const coniata = base.includes(" ") || Object.values(c.fusioni).includes(base) && !(base in c.fusioni);
  if (!coniata) words.add(base);
```

- [ ] **Step 4: Aggiorna i chiamanti**

In `src/server/maniglie/search.ts`, `browseFirstWords` e `articleIdsByFirstWord` hanno già `brand` come parametro: passalo.

```ts
  return foldBrowseGroups(
    brand,
    rows.map((r) => ({ first: r.w1, second: r.w2, count: Number(r.n) })),
  );
```

```ts
  const words = sourceFirstWords(brand, label);
```

```ts
  return rows.filter((r) => browseLabel(brand, r.name) === label);
```

In `src/server/maniglie/foto-archivio.ts`, `abbinaFoto` prende la marca come primo parametro:

```ts
export function abbinaFoto(
  brand: string,
  articoli: ArticoloDaAbbinare[],
  foto: FotoArchivio[],
): Map<string, string> {
```

e dentro il ciclo:

```ts
    const etichetta = browseLabel(brand, a.name);
```

In `scripts/foto-colombo.ts`:

```ts
  const perArticolo = abbinaFoto(MARCA, articoli, foto);
```

Aggiorna le chiamate ad `abbinaFoto` in `foto-archivio.test.ts` e `foto-archivio.integration.test.ts` aggiungendo `"COLOMBO"` come primo argomento.

- [ ] **Step 5: Esegui i test**

Run: `pnpm vitest run src/server/maniglie/`
Expected: PASS.

- [ ] **Step 6: Il gate anti-marciume, sul catalogo vero**

In `src/server/maniglie/search.integration.test.ts`, sostituisci la lista letterale (oggi alle righe ~313) con una derivata, e aggiungi il gate:

```ts
  it("le etichette doppie del fornitore non compaiono più: sono fuse", async () => {
    const words = (await browseFirstWords(db, "COLOMBO")).map((g) => g.word);
    for (const storta of vociCuratela("COLOMBO")) {
      if (storta === "ROBOCINQUE" || storta === "ROBOQUATTRO") continue; // divise: la base resta
      expect(words).not.toContain(storta);
    }
    expect(words).toContain("ROSETTA");
    expect(words).toContain("BOCCHETTA");
    expect(words).toContain("MANIGLIA INCASSO");
  });

  /**
   * Il test qui sopra verifica solo che le etichette storte NON compaiano:
   * passerebbe identico il giorno in cui COLOMBO corregge `BOCCEHTTA` e la voce
   * diventa morta. Una voce morta non si vede a schermo, perché nessun
   * conteggio va a zero. Misurato il 2026-08-05: 16 voci su 16 agganciano.
   */
  it("ogni voce della curatela aggancia ancora una riga del listino", async () => {
    const rows = await db.article.findMany({
      where: { brand: "COLOMBO" },
      select: { name: true },
    });
    const prime = new Set(rows.map((r) => firstWord(r.name)));
    for (const voce of vociCuratela("COLOMBO")) {
      expect(prime.has(voce), `voce morta nella curatela: «${voce}»`).toBe(true);
    }
  });
```

Aggiungi gli import necessari (`vociCuratela` da `./curatela`, `firstWord` da `./taxonomy`).

- [ ] **Step 7: Esegui i gate**

Run: `pnpm vitest run src/server/maniglie/curatela.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS.

Con Postgres avviato e il listino vero importato:
Run: `set -a; source .env; set +a; INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm vitest run src/server/maniglie/search.integration.test.ts`
Expected: PASS, incluso il gate anti-marciume.

- [ ] **Step 8: Commit**

```bash
git add src/server/maniglie scripts/foto-colombo.ts
git commit -m "feat(maniglie): la curatela dello sfoglio diventa per marca, e accoglie sette fusioni misurate"
```

---

## Task 2: Un'etichetta vecchia nell'URL si risolve invece di aprire un gruppo vuoto

**Files:**
- Modify: `src/server/maniglie/curatela.ts`
- Modify: `src/server/api/routers/article.ts` (`browseFamilies`, `search`)
- Test: `src/server/maniglie/curatela.test.ts`

**Interfaces:**
- Produces: `resolveLabel(brand: string, tipo: string): string | null`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
describe("resolveLabel — gli URL già condivisi non muoiono", () => {
  test("una prima parola fusa risolve sull'etichetta corrente", () => {
    // Un `?tipo=MANIG.` mandato a un collega prima della fusione aprirebbe un
    // gruppo VUOTO: il WHERE lo trova, e il filtro post-query lo scarta perché
    // ora quelle righe si chiamano MANIGLIA INCASSO.
    expect(resolveLabel("COLOMBO", "MANIG.")).toBe("MANIGLIA INCASSO");
    expect(resolveLabel("COLOMBO", "ROS.")).toBe("ROSETTA");
  });

  test("un'etichetta corrente resta se stessa", () => {
    expect(resolveLabel("COLOMBO", "ROSETTA")).toBe("ROSETTA");
    expect(resolveLabel("COLOMBO", "ROBOCINQUE S")).toBe("ROBOCINQUE S");
  });

  test("un'etichetta esclusa non apre nulla", () => {
    expect(resolveLabel("COLOMBO", "RONDELLE")).toBe(null);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `pnpm vitest run src/server/maniglie/curatela.test.ts -t resolveLabel`
Expected: FAIL — `resolveLabel is not exported`.

- [ ] **Step 3: Implementa**

In `curatela.ts`:

```ts
/**
 * L'etichetta corrente per un `tipo` che arriva dall'URL. Un link condiviso
 * prima di una fusione porta la parola VECCHIA: senza questa risoluzione il
 * gruppo si aprirebbe vuoto, perché `articleIdsByFirstWord` rifiltra con
 * `browseLabel` e nessuna riga risponde più a quel nome.
 * `null` = quella parola non si sfoglia.
 */
export function resolveLabel(brand: string, tipo: string): string | null {
  const c = curatelaDi(brand);
  if (c.escluse.has(tipo)) return null;
  return c.fusioni[tipo] ?? tipo;
}
```

- [ ] **Step 4: Usalo nel router**

In `src/server/api/routers/article.ts`, all'inizio di `browseFamilies` e di `browseSlice`:

```ts
      const tipo = resolveLabel(input.brand, input.tipo);
      if (tipo === null) return { serie: [], senzaSerie: [], total: 0 };
```

(per `browseSlice`, che sparisce nel Task 9, è sufficiente non toccarlo: il Task 9 lo rimuove.)

- [ ] **Step 5: Esegui i test**

Run: `pnpm vitest run src/server/maniglie/ && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/maniglie/curatela.ts src/server/maniglie/curatela.test.ts src/server/api/routers/article.ts
git commit -m "fix(maniglie): un ?tipo= già condiviso risolve sull'etichetta fusa invece di aprire un gruppo vuoto"
```

---

## Task 3: `splitGroup` classifica sull'insieme intero e mostra il sottoinsieme

**Files:**
- Modify: `src/server/maniglie/browse.ts`
- Test: `src/server/maniglie/browse.test.ts`

**Interfaces:**
- Produces:
  - `interface BrowseRow { id: string; code: string; codeNorm: string; name: string; imageUrl?: string | null }`
  - `interface SerieGroup { serie: string; rows: BrowseRow[]; count: number }`
  - `splitGroup(all: BrowseRow[], groupWord: string, visible?: ReadonlySet<string>): { serie: SerieGroup[]; senzaSerie: BrowseRow[] }`

**Nota sul nome:** `families`/`family` diventano `serie`. È la parola di COLOMBO per questa cosa (il suo indice stampa «130 round ID25») ed è già il nome del campo in `foto-archivio.ts`. Il parametro URL resta `fam`.

- [ ] **Step 1: Scrivi i test che falliscono**

Sostituisci il contenuto di `src/server/maniglie/browse.test.ts` mantenendo l'helper `R` e i dati `LARA`, e aggiungi:

```ts
describe("splitGroup — la classificazione NON dipende dal filtro", () => {
  /**
   * Il difetto che questo test rende impossibile, misurato il 2026-08-05:
   * classificando DOPO aver filtrato, 27 articoli su 3.393 cambiavano serie
   * solo perché «solo pronta consegna» era acceso — e un URL
   * `?tipo=X&fam=Y&pronta=1` puntava a una tendina che non esisteva più.
   */
  it("un articolo sta nella stessa serie con e senza filtro", () => {
    const tutte = splitGroup(LARA, "LARA");
    const filtrate = splitGroup(LARA, "LARA", new Set(["0CB71R-CM"]));
    expect(serieDi(filtrate, "0CB71R-CM")).toBe(serieDi(tutte, "0CB71R-CM"));
  });

  it("una serie senza righe visibili non compare, ma non ridefinisce le altre", () => {
    const filtrate = splitGroup(LARA, "LARA", new Set(["0CB72DK-CM"]));
    expect(filtrate.serie.map((s) => s.serie)).toEqual(["CB72DK"]);
  });

  it("senza il terzo argomento si vede tutto", () => {
    expect(splitGroup(LARA, "LARA").serie.map((s) => s.serie)).toEqual(["CB71R", "CB72DK"]);
  });
});

/** La serie di un id dentro un risultato di `splitGroup`, o `null`. */
function serieDi(
  r: ReturnType<typeof splitGroup>,
  id: string,
): string | null {
  return r.serie.find((s) => s.rows.some((x) => x.id === id))?.serie ?? null;
}
```

Aggiorna i test esistenti di `splitGroup` da `.families` / `family` a `.serie` / `serie`, e da `.loose` a `.senzaSerie`.

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `pnpm vitest run src/server/maniglie/browse.test.ts`
Expected: FAIL — `serie` non esiste sul risultato.

- [ ] **Step 3: Implementa**

Sostituisci `browse.ts` con:

```ts
import { familyOf } from "./taxonomy";

/**
 * SFOGLIO, livello 2: le SERIE dentro un gruppo di primo livello.
 *
 * TypeScript puro, non raw SQL: «qual è la serie» è una REGOLA DI DOMINIO, e
 * nel reparto maniglie le regole di dominio stanno fuori dalle query — come la
 * disponibilità, che vive in `stock-status.ts` tutta in Prisma.
 *
 * ⚠️ LA CLASSIFICAZIONE AVVIENE SULL'INSIEME INTERO DEL GRUPPO. I filtri
 * («solo pronta consegna», finitura) restringono ciò che si MOSTRA, mai ciò che
 * si è deciso: la regola dei gradini 2 e 3 dipende dall'insieme, e classificare
 * dopo il filtro spostava 27 articoli su 3.393 in una serie diversa — con un
 * URL condiviso che puntava a una tendina inesistente.
 */

export interface BrowseRow {
  id: string;
  code: string;
  codeNorm: string;
  name: string;
  /** Chiave Blob della foto, o `null`. Serve alla foto rappresentativa. */
  imageUrl?: string | null;
}

export interface SerieGroup {
  serie: string;
  /** Le righe VISIBILI di quella serie, nell'ordine ricevuto. */
  rows: BrowseRow[];
  count: number;
}

const norm = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();

/** Un nome di serie sotto i due caratteri aggancerebbe per puro caso. */
const MIN_SERIE = 2;

/**
 * La RADICE del codice: senza lo zero di testa (marcatore COLOMBO) e senza la
 * coda dopo l'ultimo trattino.
 *
 * ⚠️ NON è `nucleo()` di `foto-archivio.ts`, e le due non vanno unificate:
 * quella toglie la coda UFFICIALE (le 31 finiture pubblicate) e pretende almeno
 * 5 caratteri, perché risponde a un'altra domanda — quale foto ritrae questo
 * codice. Qui la coda si toglie qualunque essa sia, perché le code vere del
 * listino sono 57 e le 26 non pubblicate sono bicolori (`CR8`, `GLS`): usando
 * l'elenco ufficiale, MILLA e ALBA finivano 28 su 28 e 21 su 21 in serie da un
 * codice solo.
 */
export function radiceCodice(code: string): string {
  const i = code.lastIndexOf("-");
  return norm(i > 0 ? code.slice(0, i) : code).replace(/^0/, "");
}

/**
 * id → serie, per tutte le righe del gruppo. Chi non ce l'ha non compare.
 * Tre gradini in ordine di forza; vedi la spec 2026-08-05 §3.2.
 */
export function serieDelGruppo(all: BrowseRow[], groupWord: string): Map<string, string> {
  const out = new Map<string, string>();
  const senza: BrowseRow[] = [];

  // 1. Il token della descrizione che compare ANCHE nel codice: due campi
  //    scritti entrambi da COLOMBO. Copre il 77,8%.
  //    Scartata la serie degenere (uguale alla parola del gruppo): «KIT › KIT»
  //    ripete l'etichetta di sopra e fa sembrare classificato ciò che non lo è.
  for (const r of all) {
    const fam = familyOf(r.name, r.codeNorm);
    if (fam !== null && fam !== groupWord) out.set(r.id, fam);
    else senza.push(r);
  }

  // 2. Assorbimento in una serie GIÀ ESISTENTE del gruppo. Non inventa niente:
  //    quella serie esiste perché COLOMBO l'ha scritta nella descrizione di
  //    un'altra riga.
  //    a) IDENTITÀ (+17): la radice è la stessa stringa del nome della serie.
  //       Non è un'inferenza. È il caso di `0ID51RSB-NM`, che la descrizione
  //       lascia fuori scrivendo `S'ID51RSB` attaccato.
  //    b) PREFISSO UNICO (+276): la radice comincia con UNA SOLA serie
  //       esistente. È il caso portato dal titolare: `0ID51RSMY` → `ID51R`.
  //    Con più candidate e nessuna identica (forma `AC11`/`AC11R`/`AC11RSM`)
  //    NON si assorbe: sceglierne una sarebbe una nostra decisione mai
  //    dichiarata. Cade al gradino 3, dove i cinque `0AC11RSMY-*` di FEDRA
  //    formano la loro serie da soli.
  const esistenti = [...new Set(out.values())].filter((s) => norm(s).length >= MIN_SERIE);
  const restano: BrowseRow[] = [];
  for (const r of senza) {
    const radice = radiceCodice(r.code);
    const cand = esistenti.filter((s) => radice.startsWith(norm(s)));
    const identica = cand.find((s) => norm(s) === radice);
    if (identica !== undefined) out.set(r.id, identica);
    else if (cand.length === 1) out.set(r.id, cand[0]!);
    else restano.push(r);
  }

  // 3. Radici condivise da ALMENO DUE codici. La soglia non è un numero
  //    arbitrario: una tendina che contiene una riga sola è un involucro
  //    attorno a una riga, non una categoria. +379 codici in 53 voci.
  const perRadice = new Map<string, BrowseRow[]>();
  for (const r of restano) {
    const k = radiceCodice(r.code);
    if (k.length < MIN_SERIE) continue;
    if (!perRadice.has(k)) perRadice.set(k, []);
    perRadice.get(k)!.push(r);
  }
  for (const [k, righe] of perRadice) {
    if (righe.length < 2 || k === norm(groupWord)) continue;
    for (const r of righe) out.set(r.id, k);
  }

  return out;
}

/**
 * Il gruppo diviso: le serie con le loro righe visibili, e i codici che una
 * serie non ce l'hanno.
 *
 * `visible` è l'insieme degli id che i filtri lasciano passare. `undefined` =
 * nessun filtro. La classificazione usa SEMPRE `all`.
 */
export function splitGroup(
  all: BrowseRow[],
  groupWord: string,
  visible?: ReadonlySet<string>,
): { serie: SerieGroup[]; senzaSerie: BrowseRow[] } {
  const mappa = serieDelGruppo(all, groupWord);
  const per = new Map<string, BrowseRow[]>();
  const senzaSerie: BrowseRow[] = [];

  for (const r of all) {
    if (visible !== undefined && !visible.has(r.id)) continue;
    const s = mappa.get(r.id);
    if (s === undefined) {
      senzaSerie.push(r);
      continue;
    }
    if (!per.has(s)) per.set(s, []);
    per.get(s)!.push(r);
  }

  const serie = [...per.entries()]
    .map(([nome, rows]) => ({ serie: nome, rows, count: rows.length }))
    .sort((a, b) => b.count - a.count || a.serie.localeCompare(b.serie));

  return { serie, senzaSerie };
}
```

`filterByFamily` si cancella: il Task 9 rimuove il suo unico chiamante, e le righe di una serie arrivano già dentro `SerieGroup`.

- [ ] **Step 4: Esegui i test**

Run: `pnpm vitest run src/server/maniglie/browse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/browse.ts src/server/maniglie/browse.test.ts
git commit -m "feat(maniglie): splitGroup classifica sull'insieme intero e mostra il sottoinsieme visibile"
```

---

## Task 4: I golden delle serie sui gruppi veri

**Files:**
- Test: `src/server/maniglie/browse.test.ts`

**Interfaces:**
- Consumes: `splitGroup`, `serieDelGruppo` dal Task 3

- [ ] **Step 1: Scrivi i golden**

Aggiungi a `browse.test.ts`:

```ts
/**
 * Il caso portato dal titolare il 2026-08-05. La sua diagnosi («lo zero
 * iniziale del codice») era sbagliata: `0ID51R-CM` ha lo stesso zero e la
 * serie la prende. La causa vera è che COLOMBO scrive nella descrizione un
 * codice diverso da quello dell'articolo — `ID51RY` contro `ID51RSMY`.
 * La destinazione che aveva indicato è però esatta, e si raggiunge senza
 * indovinare: `ID51R` è l'unica serie già esistente nel gruppo di cui la
 * radice del codice è un prolungamento.
 */
describe("ROBOQUATTRO S — il caso segnalato dal campo", () => {
  const ROBOQUATTRO_S = [
    R("0ID51R-CM", "ROBOQUATTRO S' ID51R CROMAT  '"),
    R("0ID51R-CR", "ROBOQUATTRO S' ID51R CROMO   '"),
    R("0ID51RSMY-CM", "ROBOQUATTRO S ID51RY STRETTA"),
    R("0ID51RSMY-CR", "ROBOQUATTRO S ID51RY STRETTA"),
    R("0ID51RSB/0-CM", "ROBOQUATTRO S ID51RSB ZERO"),
    R("0ID51RSB-NM", "ROBOQUATTRO S'ID51RSB NEROMAT'"),
  ];

  it("0ID51RSMY-CM e -CR entrano in ID51R", () => {
    const m = serieDelGruppo(ROBOQUATTRO_S, "ROBOQUATTRO S");
    expect(m.get("0ID51RSMY-CM")).toBe("ID51R");
    expect(m.get("0ID51RSMY-CR")).toBe("ID51R");
  });

  it("0ID51RSB-NM, fuori per lo spazio mancante in «S'ID51RSB», entra in ID51RSB", () => {
    // Le candidate per prefisso sono due (ID51R e ID51RSB), ma una è IDENTICA
    // alla radice del codice: `ID51RSB`. Un'identità non è un indovinello, ed è
    // per questo che il gradino 2 la controlla prima di arrendersi.
    const m = serieDelGruppo(ROBOQUATTRO_S, "ROBOQUATTRO S");
    expect(m.get("0ID51RSB-NM")).toBe("ID51RSB");
  });

  it("nessun codice del gruppo cambia serie accendendo un filtro", () => {
    const tutte = serieDelGruppo(ROBOQUATTRO_S, "ROBOQUATTRO S");
    for (const r of ROBOQUATTRO_S) {
      const soloLui = splitGroup(ROBOQUATTRO_S, "ROBOQUATTRO S", new Set([r.id]));
      const trovata = soloLui.serie[0]?.serie ?? null;
      expect(trovata).toBe(tutte.get(r.id) ?? null);
    }
  });
});

/**
 * ROSETTA è il guadagno più grosso del gradino 3: oggi 5 serie e OTTANTA codici
 * senza serie su 105. Le radici `PB01`/`PB01Q`/`PB01DG`/`PB01DGQ` ne raccolgono
 * 58 in quattro voci, e sono tutte cose scritte da COLOMBO nei codici.
 */
describe("ROSETTA — il gradino 3", () => {
  const ROSETTA = [
    R("PB01-BI", "ROS. OTT. + SOTTOR. NYLON + 5"),
    R("PB01-CM", "ROS. OTT. + SOTTOR. NYLON + 5"),
    R("PB01/Q-BI", "ROS. OTT. Q + SOTTOR. NYLON"),
    R("PB01/Q-CM", "ROS. OTT. Q + SOTTOR. NYLON"),
    R("XROSDK-BR", "ROSETTA DK BRONZO"),
  ];

  it("raccoglie le radici condivise, e lascia sola quella da un codice", () => {
    const { serie, senzaSerie } = splitGroup(ROSETTA, "ROSETTA");
    expect(serie.map((s) => `${s.serie}:${s.count}`)).toEqual(["PB01:2", "PB01Q:2"]);
    expect(senzaSerie.map((r) => r.code)).toEqual(["XROSDK-BR"]);
  });
});
```

- [ ] **Step 2: Esegui**

Run: `pnpm vitest run src/server/maniglie/browse.test.ts`
Expected: PASS. Se il caso `0ID51RSB-NM` non torna, **non cambiare il test**: ricontrolla `radiceCodice` su `0ID51RSB/0-CM` (deve dare `ID51RSB0`).

- [ ] **Step 3: Commit**

```bash
git add src/server/maniglie/browse.test.ts
git commit -m "test(maniglie): golden delle serie su ROBOQUATTRO S e ROSETTA, dal listino vero"
```

---

## Task 5: La foto rappresentativa, e il router restituisce le serie con le righe

**Files:**
- Modify: `src/server/maniglie/browse.ts`
- Modify: `src/server/api/routers/article.ts`
- Test: `src/server/maniglie/browse.test.ts`, `src/server/api/routers/article-browse.test.ts`

**Interfaces:**
- Produces:
  - `fotoRappresentativa(rows: BrowseRow[]): string | null`
  - `article.browseSerie` → `{ serie: { serie: string; count: number; preview: string | null; rows: ArticleSummary[] }[]; senzaSerie: ArticleSummary[]; total: number }`

- [ ] **Step 1: Scrivi il test della funzione pura**

```ts
describe("fotoRappresentativa", () => {
  it("prende la prima per codice fra quelle che ne hanno una", () => {
    const rows = [
      { ...R("0CB71R-OL", "LARA CB71R OROPLUS"), imageUrl: null },
      { ...R("0CB71R-CM", "LARA CB71R CROMAT"), imageUrl: "k/cromat" },
      { ...R("0CB71R-NM", "LARA CB71R NEROMAT"), imageUrl: "k/neromat" },
    ];
    expect(fotoRappresentativa(rows)).toBe("k/cromat");
  });

  it("null quando nessuna riga ne ha una: il segnaposto non è un errore", () => {
    // Misurato: 157 serie su 533 non hanno alcuna foto.
    expect(fotoRappresentativa([{ ...R("X-1", "KIT"), imageUrl: null }])).toBe(null);
  });

  it("NON risale a righe nascoste dal filtro", () => {
    // Riceve solo le righe visibili: mostrare la foto di un articolo che il
    // filtro ha tolto significherebbe illustrare una serie con un pezzo che in
    // quella vista non esiste.
    expect(fotoRappresentativa([])).toBe(null);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `pnpm vitest run src/server/maniglie/browse.test.ts -t fotoRappresentativa`
Expected: FAIL — `fotoRappresentativa is not exported`.

- [ ] **Step 3: Implementa la funzione pura**

In `browse.ts`:

```ts
/**
 * La foto che rappresenta un insieme di righe: la prima PER CODICE fra quelle
 * che ne hanno una.
 *
 * Riceve le righe VISIBILI, non tutte: col filtro colore acceso su Neromat la
 * serie non deve mostrarsi in cromo, e una foto presa da una riga che il filtro
 * ha tolto illustrerebbe la vista con un pezzo che lì non c'è. Nessun ripiego
 * sull'insieme intero, per la stessa ragione.
 *
 * Dentro una serie tutti i codici sono lo stesso modello in finiture diverse,
 * quindi l'arbitrio si riduce alla finitura — ed è l'ordine del codice a
 * deciderla, in modo deterministico e testabile.
 */
export function fotoRappresentativa(rows: BrowseRow[]): string | null {
  let scelta: BrowseRow | null = null;
  for (const r of rows) {
    if (!r.imageUrl) continue;
    if (scelta === null || r.code.localeCompare(scelta.code) < 0) scelta = r;
  }
  return scelta?.imageUrl ?? null;
}
```

- [ ] **Step 4: Riscrivi `browseFamilies` come `browseSerie`**

In `src/server/api/routers/article.ts`, sostituisci l'intera procedura `browseFamilies` con:

```ts
  /**
   * SFOGLIO, livello 2: le SERIE di un gruppo, **con le loro righe**.
   *
   * Le righe arrivano tutte insieme e non una tendina alla volta: il server
   * legge già l'intero gruppo per classificarlo, quindi una seconda strada che
   * le rilegge sarebbe una seconda definizione di «le righe di questo gruppo»,
   * libera di divergere. Caso peggiore misurato: MANIGLIONE, 338 righe = 88 KB.
   * Una tendina chiusa tiene le sue righe nel DOM con `display:none`, quindi il
   * browser non ne scarica le foto: il costo di rete è quello che si apre.
   */
  browseSerie: agentProcedure
    .input(
      z.object({
        brand: z.string().trim().min(1).max(50).default("COLOMBO"),
        tipo: z.string().trim().min(1).max(100),
        soloPronta: z.boolean().default(false),
        finitura: z.string().trim().min(1).max(8).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tipo = resolveLabel(input.brand, input.tipo);
      if (tipo === null) return { serie: [], senzaSerie: [], total: 0 };

      // TUTTE le righe del gruppo: la classificazione non deve dipendere dal
      // filtro. `articleIdsByFirstWord` si chiama senza `onlyIds`.
      const all = await articleIdsByFirstWord(ctx.db, input.brand, tipo);
      const filtrati = await idsFiltrati(ctx.db, input.brand, input);
      const visible = filtrati === undefined ? undefined : new Set(filtrati);

      const rows = await ctx.db.article.findMany({
        where: { id: { in: all.map((r) => r.id) } },
        select: ARTICLE_FIELDS,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const { inStock } = await resolveStock(ctx.db, rows);

      // `imageUrl` grezzo (la chiave Blob) serve a `fotoRappresentativa`;
      // `toSummary` lo trasforma in un percorso di route per il browser.
      const conFoto: BrowseRow[] = all.map((r) => ({
        ...r,
        imageUrl: byId.get(r.id)?.imageUrl ?? null,
      }));
      const { serie, senzaSerie } = splitGroup(conFoto, tipo, visible);

      const somma = (r: BrowseRow) => {
        const a = byId.get(r.id);
        return a ? toSummary(a, inStock.has(a.id)) : null;
      };
      const vive = <T>(x: T | null): x is T => x !== null;

      return {
        serie: serie.map((s) => ({
          serie: s.serie,
          count: s.count,
          preview: urlFoto(fotoRappresentativa(s.rows), 320),
          rows: s.rows.map(somma).filter(vive),
        })),
        senzaSerie: senzaSerie.map(somma).filter(vive),
        total: serie.reduce((n, s) => n + s.count, 0) + senzaSerie.length,
      };
    }),
```

Aggiungi gli import mancanti in cima al file:

```ts
import {
  splitGroup,
  fotoRappresentativa,
  type BrowseRow,
} from "@/server/maniglie/browse";
import { resolveLabel } from "@/server/maniglie/curatela";
```

e rimuovi `filterByFamily` dall'import.

⚠️ `ARTICLE_FIELDS` contiene già `imageUrl`. `urlFoto` è già definita nel file.

- [ ] **Step 5: Il test del router**

In `src/server/api/routers/article-browse.test.ts` aggiungi:

```ts
describe("browseSerie — la forma della risposta", () => {
  it("ogni serie porta le sue righe, il conteggio e la foto di anteprima", () => {
    // La forma è il contratto con la schermata: le tendine si aprono senza
    // rete, quindi le righe devono essere già dentro la risposta.
    type Risposta = {
      serie: { serie: string; count: number; preview: string | null; rows: unknown[] }[];
      senzaSerie: unknown[];
      total: number;
    };
    const esempio: Risposta = {
      serie: [{ serie: "CB71R", count: 2, preview: "/api/article-image?k=x&size=320", rows: [{}, {}] }],
      senzaSerie: [],
      total: 2,
    };
    expect(esempio.serie[0]!.rows).toHaveLength(esempio.serie[0]!.count);
  });
});
```

- [ ] **Step 6: Esegui i gate**

Run: `pnpm vitest run src/server/ && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/maniglie/browse.ts src/server/maniglie/browse.test.ts src/server/api/routers/article.ts src/server/api/routers/article-browse.test.ts
git commit -m "feat(maniglie): browseSerie restituisce le serie con le righe e la foto di anteprima"
```

---

## Task 6: Livello 1 — i gruppi sanno se sono un modello, e con quale foto

**Files:**
- Modify: `src/server/maniglie/foto-archivio.ts`
- Modify: `src/server/api/routers/article.ts` (`browseGroups`)
- Test: `src/server/maniglie/foto-archivio.test.ts`

**Interfaces:**
- Produces:
  - `etichetteModello(): ReadonlySet<string>`
  - `article.browseGroups` → `{ groups: { word: string; count: number; isModello: boolean; preview: string | null }[] }`

- [ ] **Step 1: Scrivi il test che fallisce**

In `src/server/maniglie/foto-archivio.test.ts`:

```ts
describe("etichetteModello", () => {
  /**
   * Quali gruppi sono un MODELLO non è un nostro giudizio: è la struttura
   * dell'archivio fotografico ufficiale di COLOMBO. Un gruppo ha un archivio
   * proprio (FEDRA, ROBOT) oppure è una tipologia che raccoglie modelli diversi
   * (BOCCHETTA, MANIGLIONE), e lì una foto sola sarebbe un modello a caso
   * spacciato per la categoria.
   */
  it("contiene i gruppi che COLOMBO fotografa come modello", () => {
    expect(etichetteModello().has("FEDRA")).toBe(true);
    expect(etichetteModello().has("ROBOQUATTRO S")).toBe(true);
  });

  it("NON contiene le tipologie", () => {
    expect(etichetteModello().has("BOCCHETTA")).toBe(false);
    expect(etichetteModello().has("MANIGLIONE")).toBe(false);
    expect(etichetteModello().has("KIT")).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.test.ts -t etichetteModello`
Expected: FAIL — non esportata.

- [ ] **Step 3: Implementa**

In `foto-archivio.ts`, dopo `FILE_MODELLO`:

```ts
/**
 * Le etichette di sfoglio che COLOMBO fotografa come MODELLO: quelle a cui
 * `ARCHIVI` o `FILE_MODELLO` assegnano un archivio. Misurate sul listino
 * 02-26: 63 gruppi su 102, e tutti e 63 hanno almeno una foto.
 *
 * Serve al livello 1 per sapere quali tessere hanno una foto che significhi
 * qualcosa. La distinzione NON è nostra: è come il fornitore ha organizzato il
 * suo archivio.
 */
export function etichetteModello(): ReadonlySet<string> {
  const out = new Set<string>();
  for (const v of Object.values(ARCHIVI)) if (v.etichetta) out.add(v.etichetta);
  for (const v of Object.values(FILE_MODELLO)) if (v.etichetta) out.add(v.etichetta);
  return out;
}
```

- [ ] **Step 4: Arricchisci `browseGroups`**

In `article.ts`, sostituisci il corpo di `browseGroups`:

```ts
    .query(async ({ ctx, input }) => {
      const filtrati = await idsFiltrati(ctx.db, input.brand, input);
      const groups = await browseFirstWords(ctx.db, input.brand, filtrati);
      const modelli = etichetteModello();

      // Una sola lettura in più, e solo delle righe che una foto CE L'HANNO
      // (2.118 su 3.456): serve a scegliere l'anteprima per gruppo. Le righe
      // senza foto non servirebbero a niente qui.
      const conFoto = await ctx.db.article.findMany({
        where: {
          brand: input.brand,
          imageUrl: { not: null },
          ...(filtrati ? { id: { in: filtrati } } : {}),
        },
        select: { code: true, name: true, imageUrl: true },
      });

      const perGruppo = new Map<string, { code: string; imageUrl: string }[]>();
      for (const r of conFoto) {
        const label = browseLabel(input.brand, r.name);
        if (label === null || !modelli.has(label)) continue;
        if (!perGruppo.has(label)) perGruppo.set(label, []);
        perGruppo.get(label)!.push({ code: r.code, imageUrl: r.imageUrl! });
      }

      return {
        groups: groups.map((g) => {
          const righe = perGruppo.get(g.word) ?? [];
          const scelta = righe.reduce<{ code: string; imageUrl: string } | null>(
            (best, r) => (best === null || r.code.localeCompare(best.code) < 0 ? r : best),
            null,
          );
          return {
            word: g.word,
            count: g.count,
            isModello: modelli.has(g.word),
            preview: urlFoto(scelta?.imageUrl ?? null, 320),
          };
        }),
      };
    }),
```

Aggiungi gli import: `etichetteModello` da `@/server/maniglie/foto-archivio`, `browseLabel` da `@/server/maniglie/curatela`.

- [ ] **Step 5: Esegui i gate**

Run: `pnpm vitest run src/server/ && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts src/server/api/routers/article.ts
git commit -m "feat(maniglie): i gruppi di livello 1 portano la foto di anteprima dove sono un modello"
```

---

## Task 7: Le tessere di livello 1

**Files:**
- Modify: `src/components/maniglie/sfoglia.tsx`
- Test: `src/components/maniglie/sfoglia.test.tsx` (creare se assente)

**Interfaces:**
- Consumes: `article.browseGroups` dal Task 6
- Produces: `SfogliaGruppi({ groups, soloPronta, finitura })` con `Gruppo = { word: string; count: number; isModello: boolean; preview: string | null }`

- [ ] **Step 1: Scrivi il test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SfogliaGruppi } from "./sfoglia";

const G = (word: string, count: number, isModello: boolean, preview: string | null) => ({
  word, count, isModello, preview,
});

describe("SfogliaGruppi", () => {
  it("il gruppo-modello mostra la sua foto", () => {
    render(
      <SfogliaGruppi
        groups={[G("FEDRA", 35, true, "/api/article-image?k=fedra&size=320")]}
        soloPronta={false}
        finitura={null}
      />,
    );
    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute(
      "src",
      "/api/article-image?k=fedra&size=320",
    );
  });

  it("il gruppo-tipologia non ha un'area immagine vuota", () => {
    // Un riquadro grigio in una griglia si legge come «immagine rotta»; una
    // tessera di solo testo si legge come una tessera di solo testo.
    render(
      <SfogliaGruppi groups={[G("BOCCHETTA", 290, false, null)]} soloPronta={false} finitura={null} />,
    );
    expect(screen.queryByRole("img", { hidden: true })).toBeNull();
    expect(screen.getByText("BOCCHETTA")).toBeVisible();
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `pnpm vitest run src/components/maniglie/sfoglia.test.tsx`
Expected: FAIL — `SfogliaGruppi` non accetta `isModello`/`preview`.

- [ ] **Step 3: Implementa**

In `sfoglia.tsx`, sostituisci `Gruppo` e `ChipGruppo`:

```tsx
export interface Gruppo {
  word: string;
  count: number;
  /** Il gruppo È un modello (COLOMBO gli dedica un archivio fotografico). */
  isModello: boolean;
  /** Percorso della foto di anteprima, o `null`. */
  preview: string | null;
}

/**
 * La tessera di un gruppo, in due forme.
 *
 * **Modello** (63 su 102): foto grande, nome, conteggio. La foto è quella di un
 * suo articolo, e dentro un gruppo-modello tutti gli articoli sono lo stesso
 * modello in finiture diverse — quindi ritrae il gruppo, non un suo membro a
 * caso.
 *
 * **Tipologia** (39): solo testo, nome più grande. NESSUNA area immagine: una
 * tipologia raccoglie modelli diversi (BOCCHETTA ne ha 22), e una foto sola
 * sarebbe un modello spacciato per la categoria. Lasciare il riquadro vuoto
 * sarebbe peggio: in una griglia un buco si legge come immagine rotta.
 */
function TesseraGruppo({ gruppo, coda }: { gruppo: Gruppo; coda: string }) {
  return (
    <li>
      <Link
        href={`/maniglie?tipo=${encodeURIComponent(gruppo.word)}${coda ? `&${coda}` : ""}`}
        aria-label={`${gruppo.word}, ${conteggio(gruppo.count)}`}
        className="flex h-full flex-col gap-1 rounded-md border border-line bg-surface p-2 transition-colors duration-150 hover:border-line-strong hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {gruppo.isModello ? (
          gruppo.preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth
            <img
              src={gruppo.preview}
              alt=""
              loading="lazy"
              className="aspect-square w-full rounded bg-white object-contain"
            />
          ) : (
            <span
              aria-hidden
              className="grid aspect-square w-full place-items-center rounded bg-surface-sunken"
            >
              <Package className="size-6 text-ink-subtle" />
            </span>
          )
        ) : null}
        <span
          className={
            gruppo.isModello
              ? "break-words text-sm font-medium leading-tight text-ink"
              : "flex flex-1 items-center break-words text-base font-semibold leading-tight text-ink"
          }
        >
          {gruppo.word}
        </span>
        <span aria-hidden className="text-xs tabular-nums text-ink-subtle">
          {gruppo.count}
        </span>
      </Link>
    </li>
  );
}
```

Aggiungi `Package` all'import di `lucide-react`. In `SfogliaGruppi`, sostituisci `<ChipGruppo …>` con `<TesseraGruppo …>` e allinea la griglia:

```tsx
        <ul className="grid list-none grid-cols-2 items-start gap-2 sm:grid-cols-3 lg:grid-cols-4">
```

`items-start` è ciò che permette alle tessere di tipologia di restare basse invece di allungarsi quanto quelle con la foto.

- [ ] **Step 4: Esegui**

Run: `pnpm vitest run src/components/maniglie/ && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/maniglie/sfoglia.tsx src/components/maniglie/sfoglia.test.tsx
git commit -m "feat(maniglie): le tessere di livello 1 mostrano la foto dove il gruppo è un modello"
```

---

## Task 8: Le tendine di livello 2, con lo stato nell'URL

**Files:**
- Modify: `src/components/maniglie/sfoglia.tsx`
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.tsx`
- Create: `src/lib/serie-aperte.ts`
- Test: `src/lib/serie-aperte.test.ts`, `src/components/maniglie/sfoglia.test.tsx`

**Interfaces:**
- Produces:
  - `leggiSerieAperte(param: string | null): string[]`
  - `scriviSerieAperte(aperte: string[]): string | null`
  - `SfogliaSerie({ serie, aperte, onToggle, senzaSerie })`

- [ ] **Step 1: Il modulo puro dell'URL, col suo test**

`src/lib/serie-aperte.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { leggiSerieAperte, scriviSerieAperte } from "./serie-aperte";

describe("serie aperte nell'URL", () => {
  it("legge un elenco separato da virgole", () => {
    expect(leggiSerieAperte("CD73,CC113")).toEqual(["CD73", "CC113"]);
  });

  it("un vecchio link a una sola famiglia apre quella tendina", () => {
    // `?fam=CB71R` è la forma che si condivideva prima delle tendine.
    expect(leggiSerieAperte("CB71R")).toEqual(["CB71R"]);
  });

  it("regge i nomi di serie che contengono una barra", () => {
    // `HPS/1` è una serie vera del listino.
    expect(leggiSerieAperte(scriviSerieAperte(["HPS/1"]))).toEqual(["HPS/1"]);
  });

  it("null e stringa vuota danno un elenco vuoto", () => {
    expect(leggiSerieAperte(null)).toEqual([]);
    expect(leggiSerieAperte("")).toEqual([]);
  });

  it("scrivere un elenco vuoto dà null, così il parametro sparisce dall'URL", () => {
    expect(scriviSerieAperte([])).toBe(null);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `pnpm vitest run src/lib/serie-aperte.test.ts`
Expected: FAIL — modulo assente.

- [ ] **Step 3: Implementa**

`src/lib/serie-aperte.ts`:

```ts
/**
 * Le tendine aperte vivono nell'URL, come la ricerca, i filtri e la pagina:
 * «dove si è, sta scritto nella barra». Tornando dalla scheda di un articolo la
 * pagina si ricompone identica, tendine comprese — e il ripristino dello scroll
 * atterrerebbe altrimenti su una pagina che nel frattempo si è accorciata.
 *
 * Il parametro resta `fam` e non diventa `serie`: i link già condivisi valgono
 * più della coerenza del nome interno, e un vecchio `?fam=CB71R` è già un
 * elenco valido di una voce sola.
 */
export function leggiSerieAperte(param: string | null): string[] {
  if (!param) return [];
  return param
    .split(",")
    .map((s) => decodeURIComponent(s).trim())
    .filter(Boolean);
}

/** `null` quando non c'è nulla di aperto: il parametro sparisce dall'URL. */
export function scriviSerieAperte(aperte: string[]): string | null {
  if (aperte.length === 0) return null;
  return aperte.map((s) => encodeURIComponent(s)).join(",");
}
```

- [ ] **Step 4: Il componente delle tendine, col suo test**

In `sfoglia.test.tsx`:

```tsx
describe("SfogliaSerie", () => {
  const SERIE = [
    {
      serie: "CB71R",
      count: 2,
      preview: "/api/article-image?k=lara&size=320",
      rows: [
        { id: "1", code: "0CB71R-CM", name: "LARA CB71R CROMAT", total: 10, inStock: false, imageUrl: null, ean: null, brand: "COLOMBO", catalogPage: null },
      ],
    },
  ];

  it("una tendina chiusa mostra nome, conteggio e foto", () => {
    render(<SfogliaSerie serie={SERIE} aperte={[]} onToggle={() => {}} senzaSerie={[]} />);
    expect(screen.getByText("CB71R")).toBeVisible();
    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute("src", SERIE[0]!.preview);
  });

  it("la foto resta anche a tendina aperta", () => {
    // Con più tendine aperte le intestazioni sono i soli punti di riferimento
    // in una colonna di righe quasi identiche: toglierla la toglie quando serve.
    render(<SfogliaSerie serie={SERIE} aperte={["CB71R"]} onToggle={() => {}} senzaSerie={[]} />);
    expect(screen.getAllByRole("img", { hidden: true }).length).toBeGreaterThan(0);
  });

  it("le righe sono nel DOM anche a tendina chiusa", () => {
    // È ciò che rende l'apertura istantanea: nessuna richiesta, nessuno
    // scheletro. E il browser non scarica le foto di ciò che è `display:none`.
    render(<SfogliaSerie serie={SERIE} aperte={[]} onToggle={() => {}} senzaSerie={[]} />);
    expect(screen.getByText("0CB71R-CM")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Implementa `SfogliaSerie`**

In `sfoglia.tsx`, sostituisci `SfogliaFamiglie` e `SenzaFamiglia`:

```tsx
export interface Serie {
  serie: string;
  count: number;
  preview: string | null;
  rows: ArticleSummary[];
}

/**
 * Livello 2: le SERIE del gruppo, a tendina, più d'una aperta insieme.
 *
 * `<details>` NATIVO, come il filtro colori: dà tastiera, `aria-expanded` e la
 * ricerca del browser (che apre da sé la tendina giusta) senza scriverli. E ha
 * un effetto che una disclosure a mano non avrebbe: una tendina chiusa tiene le
 * sue righe nel DOM con `display:none`, quindi il browser non ne scarica le
 * foto. Il costo di rete è quello che si apre, non quello che si manda.
 *
 * Nessuna animazione di altezza (vietata dal sistema): si muove solo il chevron.
 */
export function SfogliaSerie({
  serie,
  aperte,
  onToggle,
  senzaSerie,
  renderRiga,
}: {
  serie: Serie[];
  aperte: string[];
  onToggle: (serie: string, aperta: boolean) => void;
  senzaSerie: ArticleSummary[];
  renderRiga: (a: ArticleSummary) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="list-none overflow-hidden rounded-md border border-line">
        {serie.map((s) => {
          const aperta = aperte.includes(s.serie);
          return (
            <li key={s.serie} className="border-b border-line last:border-b-0">
              <details
                open={aperta}
                onToggle={(e) => onToggle(s.serie, (e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 bg-surface px-3 py-2 transition-colors duration-150 hover:bg-surface-sunken sm:px-4">
                  <AnteprimaSerie url={s.preview} piccola={aperta} />
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
                    {s.serie}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
                    {conteggio(s.count)}
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-ink-subtle transition-transform duration-150 ${aperta ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </summary>
                <ul className="list-none bg-surface-sunken">{s.rows.map(renderRiga)}</ul>
              </details>
            </li>
          );
        })}
      </ul>

      {senzaSerie.length > 0 ? (
        <>
          {/* Non è una categoria e non deve sembrarlo: sono i codici che il
              listino non lega a una serie. Misurato dopo i tre gradini: 60 su
              3.393. Una voce «Altro» darebbe un nome di categoria a ciò che una
              categoria non ha. */}
          <div className="flex flex-col gap-0.5 pt-1">
            <h3 className="text-sm font-semibold text-ink">Codici senza serie</h3>
            <p className="text-xs text-ink-subtle">
              {conteggio(senzaSerie.length)} che il listino non lega a una serie
            </p>
          </div>
          <ul className="list-none overflow-hidden rounded-md border border-line">
            {senzaSerie.map(renderRiga)}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/**
 * L'anteprima nell'intestazione: 56px chiusa, 32px aperta. Ritrae il MODELLO;
 * le miniature delle righe ritraggono le singole finiture, quindi non è una
 * ripetizione. Nessuna transizione sulla dimensione: sarebbe un'animazione di
 * layout.
 */
function AnteprimaSerie({ url, piccola }: { url: string | null; piccola: boolean }) {
  const dim = piccola ? "size-8" : "size-14";
  if (!url) {
    return (
      <span
        aria-hidden
        className={`grid ${dim} shrink-0 place-items-center rounded border border-line bg-surface-sunken`}
      >
        <Package className="size-4 text-ink-subtle" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth
    <img
      src={url}
      alt=""
      loading="lazy"
      className={`${dim} shrink-0 rounded border border-line bg-white object-contain`}
    />
  );
}
```

Aggiungi gli import: `type ReactNode` da `react`, `type ArticleSummary` da `@/server/api/routers/article`.

- [ ] **Step 6: Collega la pagina**

In `maniglie-client.tsx`:

```tsx
  const aperte = leggiSerieAperte(searchParams.get("fam"));

  const serie = api.article.browseSerie.useQuery(
    { tipo, soloPronta, ...(finitura ? { finitura } : {}) },
    { enabled: sfogliando, staleTime: 5 * 60_000 },
  );

  /**
   * Aprire o chiudere una tendina riscrive l'URL, senza scroll: la posizione
   * dell'agente non deve saltare mentre apre una sezione più in basso.
   */
  const toggleSerie = useCallback(
    (nome: string, aperta: boolean) => {
      const prossime = aperta
        ? [...new Set([...leggiSerieAperte(searchParams.get("fam")), nome])]
        : leggiSerieAperte(searchParams.get("fam")).filter((s) => s !== nome);
      const next = new URLSearchParams(searchParams.toString());
      const v = scriviSerieAperte(prossime);
      if (v) next.set("fam", v);
      else next.delete("fam");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );
```

e la chiave del ripristino scroll include le tendine aperte:

```tsx
  useScrollRestore(
    `${committed}|${tipo}|${aperte.join(",")}|${page}|${soloPronta}|${finitura}`,
    Boolean(search.data ?? gruppi.data ?? serie.data),
  );
```

Nel corpo, dove oggi si rendono `SfogliaFamiglie` + `SenzaFamiglia` + le righe, metti:

```tsx
            <SfogliaSerie
              serie={serie.data?.serie ?? []}
              aperte={aperte}
              onToggle={toggleSerie}
              senzaSerie={serie.data?.senzaSerie ?? []}
              renderRiga={(a) => <ArticoloRow key={a.id} articolo={a} />}
            />
```

- [ ] **Step 7: Esegui i gate**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: PASS. I test di `maniglie-client.test.tsx` che navigavano alla pagina-famiglia falliranno: vanno riscritti nel Task 9.

- [ ] **Step 8: Commit**

```bash
git add src/lib/serie-aperte.ts src/lib/serie-aperte.test.ts src/components/maniglie/sfoglia.tsx src/components/maniglie/sfoglia.test.tsx src/app/\(dashboard\)/maniglie/maniglie-client.tsx
git commit -m "feat(maniglie): le serie diventano tendine multiple, con lo stato nell'URL"
```

---

## Task 9: Lo sfoglio ha un lettore solo

**Files:**
- Modify: `src/server/api/routers/article.ts` (rimuove `browseSlice` e i campi solo-sfoglio)
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.tsx`
- Modify: `src/server/api/routers/article-browse.test.ts`
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

**Interfaces:**
- Produces: `searchInputSchema` senza `tipo`, `famiglia`, `soloPronta`, `finitura`

- [ ] **Step 1: Riscrivi i test dello schema**

In `article-browse.test.ts`, sostituisci i casi che accettavano `tipo`/`famiglia`:

```ts
  it("RIFIUTA il tipo: lo sfoglio non passa più da qui", () => {
    // Con le tendine, `search({tipo})` sarebbe una SECONDA definizione di «le
    // righe di questo gruppo», libera di divergere da `browseSerie`. La ricerca
    // testuale resta l'unico mestiere di questa procedura.
    expect(searchInputSchema.safeParse({ tipo: "MANIGLIONE" }).success).toBe(false);
  });

  it("RIFIUTA una richiesta senza query", () => {
    expect(searchInputSchema.safeParse({}).success).toBe(false);
  });

  it("accetta la sola query, coi default di sempre", () => {
    expect(searchInputSchema.parse({ query: "lara" })).toMatchObject({
      brand: "COLOMBO",
      limit: 20,
      offset: 0,
    });
  });

  it("non accetta un limite oltre 50: la pagina è una pagina", () => {
    expect(searchInputSchema.safeParse({ query: "lara", limit: 500 }).success).toBe(false);
  });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `pnpm vitest run src/server/api/routers/article-browse.test.ts`
Expected: FAIL — `{tipo: "MANIGLIONE"}` è ancora accettato.

- [ ] **Step 3: Smonta**

In `article.ts`:

```ts
export const searchInputSchema = z.object({
  query: z.string().trim().min(1, "Inserisci un termine di ricerca").max(200),
  brand: z.string().trim().min(1).max(50).default("COLOMBO"),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});
```

Elimina la funzione `browseSlice` per intero e il ramo `if (input.tipo) return browseSlice(...)` dalla procedura `search`. In `browse.ts` elimina `filterByFamily` (ora senza chiamanti) e il suo test.

- [ ] **Step 4: Aggiorna la pagina**

In `maniglie-client.tsx`, `search` si abilita solo cercando:

```tsx
  const search = api.article.search.useQuery(
    { query: committed, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
    { enabled: cercando, placeholderData: keepPreviousData, staleTime: 5 * 60_000 },
  );
```

`mostraCodici` diventa `cercando`. La paginazione resta **solo** per la ricerca testuale. Rimuovi `senzaLivello2` e il ramo che mostrava i codici sfogliando: un gruppo senza serie ora mostra tutte le sue righe sotto «Codici senza serie».

- [ ] **Step 5: Aggiorna i test della pagina**

In `maniglie-client.test.tsx`, i test che cliccavano una famiglia e verificavano la navigazione a `?fam=` ora devono verificare che la **tendina si apra**:

```tsx
  it("aprendo una serie l'URL la registra e le righe compaiono", async () => {
    // Prima era una navigazione a una pagina filtrata; ora è una tendina, e
    // possono essere aperte più serie insieme.
    render(<ManiglieClient />);
    await userEvent.click(await screen.findByText("CB71R"));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("fam=CB71R"), { scroll: false });
  });
```

Rimuovi i test della paginazione **dentro un gruppo** e i test di `soloPronta`/`finitura` passati a `search`: quei parametri ora vivono solo su `browseGroups`/`browseSerie`.

- [ ] **Step 6: Esegui i gate**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS, build con tutte le route di prima.

- [ ] **Step 7: Commit**

```bash
git add src/server/api/routers/article.ts src/server/api/routers/article-browse.test.ts src/server/maniglie/browse.ts src/server/maniglie/browse.test.ts src/app/\(dashboard\)/maniglie/
git commit -m "refactor(maniglie): lo sfoglio ha un lettore solo, search resta la ricerca testuale"
```

---

## Task 10: Le parole a schermo dicono il vero

**Files:**
- Modify: `src/components/maniglie/sfoglia.tsx`
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

- [ ] **Step 1: Scrivi il test**

```tsx
  it("non promette più che le etichette siano quelle di COLOMBO", () => {
    // Era già falso PRIMA delle fusioni: `ROBOCINQUE S` è una stringa che
    // componiamo noi, e `ROSETTA` raccoglie le righe scritte `ROS.`. Il test
    // vecchio verificava che la frase CI FOSSE, quindi sarebbe passato identico.
    render(<SfogliaGruppi groups={[G("FEDRA", 35, true, null)]} soloPronta={false} finitura={null} />);
    expect(screen.queryByText(/come li nomina COLOMBO/)).toBeNull();
  });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `pnpm vitest run src/components/maniglie/sfoglia.test.tsx`
Expected: FAIL — la frase c'è.

- [ ] **Step 3: Riscrivi le due frasi**

In `SfogliaGruppi`:

```tsx
        <p className="text-xs text-ink-subtle">
          {groups.length} gruppi in ordine alfabetico. Il numero è quanti codici
          {insiemeContato(soloPronta, finitura)}, non quanti modelli: lo stesso pezzo compare
          una volta per finitura.
        </p>
        {/* Ciò che il programma ha deciso e che senza questa riga non direbbe.
            Chi cercasse una vite qui e non la trovasse concluderebbe che non la
            trattiamo, mentre è a magazzino e la ricerca la restituisce. */}
        <p className="text-xs text-ink-subtle">
          Viti, dadi, chiavi e rondelle non si sfogliano: si trovano scrivendole nella ricerca.
        </p>
```

La frase sulle rondelle ora è **vera**: il Task 1 ha aggiunto `RONDELLE` alle escluse.

- [ ] **Step 4: Esegui i gate**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/maniglie/sfoglia.tsx src/components/maniglie/sfoglia.test.tsx src/app/\(dashboard\)/maniglie/maniglie-client.test.tsx
git commit -m "fix(maniglie): tolta la frase «come li nomina COLOMBO», falsa già prima delle fusioni"
```

---

## Task 11: Verifica sul catalogo vero e in browser

**Files:**
- Modify: `src/server/maniglie/search.integration.test.ts`

- [ ] **Step 1: Il gate d'integrazione sulle serie**

```ts
  /**
   * Sul catalogo vero, non su venti righe finte. I numeri sono quelli misurati
   * il 2026-08-05 e valgono per il listino `LP 02-26`: se il listino cambia,
   * questo test lo dice invece di lasciarlo scoprire a schermo.
   */
  it("le tre regole coprono il 98% dei codici sfogliabili", async () => {
    const rows = await db.article.findMany({
      where: { brand: "COLOMBO" },
      select: { id: true, code: true, codeNorm: true, name: true },
    });
    let sfogliabili = 0;
    let conSerie = 0;
    const perGruppo = new Map<string, typeof rows>();
    for (const r of rows) {
      const l = browseLabel("COLOMBO", r.name);
      if (l === null) continue;
      sfogliabili++;
      if (!perGruppo.has(l)) perGruppo.set(l, []);
      perGruppo.get(l)!.push(r);
    }
    for (const [g, rs] of perGruppo) conSerie += serieDelGruppo(rs, g).size;
    expect(sfogliabili).toBeGreaterThan(3_300);
    expect(conSerie / sfogliabili).toBeGreaterThan(0.98);
  });

  it("nessun articolo cambia serie quando si accende un filtro", async () => {
    // Il difetto che ha riscritto il contratto di `splitGroup`: misurato,
    // classificando dopo il filtro 27 articoli finivano in una serie diversa.
    const rows = await db.article.findMany({
      where: { brand: "COLOMBO" },
      select: { id: true, code: true, codeNorm: true, name: true },
    });
    const perGruppo = new Map<string, typeof rows>();
    for (const r of rows) {
      const l = browseLabel("COLOMBO", r.name);
      if (l === null) continue;
      if (!perGruppo.has(l)) perGruppo.set(l, []);
      perGruppo.get(l)!.push(r);
    }
    for (const [g, rs] of perGruppo) {
      const intera = serieDelGruppo(rs, g);
      const visibili = new Set(rs.filter((_, i) => i % 5 === 0).map((r) => r.id));
      const { serie } = splitGroup(rs, g, visibili);
      for (const s of serie) {
        for (const r of s.rows) {
          expect(s.serie, `${r.code} in ${g}`).toBe(intera.get(r.id));
        }
      }
    }
  });
```

- [ ] **Step 2: Esegui i gate d'integrazione**

Con Postgres avviato e il listino vero importato:

```bash
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm vitest run src/server/maniglie/search.integration.test.ts
```
Expected: PASS.

- [ ] **Step 3: Verifica in browser, desktop e 375px**

Le foto in locale si popolano calcolando l'abbinamento con l'indice dell'archivio (la password dell'area download la fornisce l'utente e **non va scritta in nessun file**); `/api/article-image` si intercetta servendo i WebP convertiti in locale, perché il token Blob è un secret di produzione.

Playwright va lanciato con l'eseguibile pre-installato:
`executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`. **Mai** `npx playwright install`.

Controlli obbligatori, **entrambi i viewport**:
1. Le tessere dei gruppi-modello mostrano una foto; quelle di tipologia non hanno area immagine vuota.
2. Il filtro delle etichette restringe la griglia.
3. Aprire due tendine insieme: entrambe restano aperte, l'URL le elenca.
4. Ricaricare la pagina con quell'URL: le stesse due tendine sono aperte.
5. La foto è presente nell'intestazione **anche a tendina aperta**, più piccola.
6. Aprire una tendina non fa saltare la posizione dello scroll.
7. Entrare in un articolo e tornare indietro: tendine e posizione ripristinate.
8. Accendere «solo pronta consegna»: nessuna serie cambia nome, le serie senza righe spariscono.
9. Accendere un colore: l'anteprima della serie mostra quel colore.
10. Un vecchio `?tipo=MANIG.` apre **MANIGLIA INCASSO** e non un gruppo vuoto.
11. Nessuna risposta HTTP ≥ 400 in console su un caricamento pulito.
12. A 375px nessuno scorrimento orizzontale.

- [ ] **Step 4: Commit**

```bash
git add src/server/maniglie/search.integration.test.ts
git commit -m "test(maniglie): gate sul catalogo vero — copertura delle serie e indipendenza dal filtro"
```

---

## Self-Review

**Copertura della spec:** §3.1 → T3 · §3.2 → T3, T4 · §3.3 → T1 · §3.4 → T1 · §3.5 → T2 · §3.6 → T1 (step 6) · §3.7 → T9 · §4.1 → T7 · §4.2 → T8 · §4.3 → T3 (rinomina), T8, T10 · §4.4 → T5 · §6 → T4, T11.

**Coerenza dei tipi:** `BrowseRow` acquisisce `imageUrl?` nel Task 3 e lo usa nel Task 5. `SerieGroup.rows` è `BrowseRow[]` lato dominio e `ArticleSummary[]` lato router (proiezione in `browseSerie`). `browseLabel`, `foldBrowseGroups`, `sourceFirstWords`, `resolveLabel`, `vociCuratela` prendono tutte `brand` come **primo** parametro.

**Fuori piano, dichiarato:** `updateMany` in `scripts/foto-colombo.ts` (debito noto, 4 minuti per run ops) e il tool chat per le maniglie restano fuori: non servono a questa spec.
