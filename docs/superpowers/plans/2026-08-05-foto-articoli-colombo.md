# Foto degli articoli COLOMBO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** far comparire la foto del prodotto sulle righe articolo e sulla scheda del reparto maniglie, prendendola dall'archivio fotografico ufficiale COLOMBO e senza mai attribuire a un codice una foto che COLOMBO non gli ha attribuito.

**Architecture:** un modulo foglia (`foto-archivio.ts`) contiene la tabella dei 79 archivi, il parser dei nomi file e l'abbinamento articolo→foto; uno script ops legge l'archivio con richieste **Range** (mai i 3,5 GB), converte con `sharp` dal CMYK a due WebP, li carica su **Vercel Blob privato** e scrive la **chiave** in `articles.image_url`; una route Node autenticata serve i byte. Nessuna migrazione.

**Tech Stack:** TypeScript strict · Prisma 6 · `@vercel/blob` (già in dependencies) · `sharp` (nuova **devDependency**, solo lo script) · Vitest · zlib/stdlib per lo zip.

## Global Constraints

- **Niente foto→codice inventate**: un articolo che non arriva a nessuno dei tre gradini resta **senza foto**.
- **Mai in `public/`**: il repo è pubblico e sono foto di un fornitore. Blob **privato** dietro route autenticata.
- **La password dell'area download non si scrive in nessun file** — solo `process.env.COLOMBO_DOWNLOAD_PASSWORD`.
- **Nessuna migrazione** (decisione utente 2026-08-05): nessuna colonna nuova, nessun run ops sul DB con `migrate`.
- **Mobile-first**: ogni modifica UI verificata a **375px** in browser vero.
- UI in italiano; codici in `font-mono`.
- TypeScript strict; tutte le API via tRPC; nessun raw SQL fuori da `rag.ts` e `maniglie/search.ts`.
- Un commit per task.

---

### Task 1: Le 31 finiture ufficiali

**Files:**
- Create: `src/server/maniglie/finiture.ts`
- Test: `src/server/maniglie/finiture.test.ts`

**Interfaces:**
- Consumes: nulla (modulo foglia).
- Produces: `FINITURE: Finitura[]`, `type Finitura = { codice: string; nome: string; colore: string }`, `finituraDiCodice(code: string): string | null`, `FINITURE_PER_CODICE: Map<string, Finitura>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { FINITURE, FINITURE_PER_CODICE, finituraDiCodice } from "./finiture";

describe("finiture ufficiali COLOMBO", () => {
  it("sono trentuno, come la pagina 13 del catalogo", () => {
    expect(FINITURE).toHaveLength(31);
  });

  it("ogni finitura ha codice, nome e colore esadecimale", () => {
    for (const f of FINITURE) {
      expect(f.codice).toMatch(/^[A-Z0-9/]{2,5}$/);
      expect(f.nome.length).toBeGreaterThan(2);
      expect(f.colore).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("nessun codice ripetuto", () => {
    expect(new Set(FINITURE.map((f) => f.codice)).size).toBe(31);
  });

  it("legge la coda del codice articolo", () => {
    expect(finituraDiCodice("0CD41R-CM")).toBe("CM");
    expect(finituraDiCodice("0AC11RSMY-C12")).toBe("C12");
  });

  it("una coda che non è fra le 31 non è una finitura", () => {
    // `CR8` è un bicolore CROMO/CROMAT: esiste, ma COLOMBO non lo pubblica
    // fra le finiture. Inventare una categoria sulle code non riconosciute
    // è esattamente ciò che la scheda misure vieta.
    expect(finituraDiCodice("0CD41R-CR8")).toBeNull();
  });

  it("un codice senza trattino non ha coda di finitura", () => {
    // 237 codici del listino vero sono così.
    expect(finituraDiCodice("CB22DKSMSXCR8")).toBeNull();
  });

  it("l'indice per codice ha una voce per finitura", () => {
    expect(FINITURE_PER_CODICE.get("OL")?.nome).toBe("Oroplus");
    expect(FINITURE_PER_CODICE.size).toBe(31);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/finiture.test.ts`
Expected: FAIL — `Cannot find module './finiture'`

- [ ] **Step 3: Write minimal implementation**

Create `src/server/maniglie/finiture.ts` con l'intestazione seguente e le 31 righe
copiate da `docs/superpowers/specs/2026-08-04-foto-e-finiture-colombo-misure-2.md` §5
(codice · nome · colore), nell'ordine della pagina:

```ts
/**
 * Le 31 finiture che COLOMBO pubblica (catalogo `ER MAN 2026`, pagina stampata 13).
 *
 * Modulo foglia, senza dipendenze: lo usano il parser dei nomi delle foto e — dal
 * passo successivo — il filtro colori chiesto da Andrea. Sul listino `LP 02-26`
 * **3.065 codici su 3.456 (88,7%)** hanno come coda una di queste.
 *
 * ⚠️ Il COLORE è CAMPIONATO dalle pastiglie di catalogo, non dichiarato da COLOMBO:
 * va bene per un pallino in un filtro, NON per rappresentare la finitura reale di
 * un prodotto.
 *
 * ⚠️ Le code distinte del listino sono 57, non 31: le altre sono bicolori (`CR8` =
 * CROMO/CROMAT) e misure. Qui stanno SOLO quelle pubblicate — nessuna categoria
 * inventata sulle code non riconosciute.
 */
export interface Finitura {
  /** La coda del codice articolo: `0CD41R-`**`CM`**. */
  codice: string;
  nome: string;
  /** Esadecimale campionato dalla pastiglia di catalogo. */
  colore: string;
}

export const FINITURE: Finitura[] = [
  { codice: "OL", nome: "Oroplus", colore: "#F8EAB4" },
  { codice: "OM", nome: "Oromat", colore: "#E2CE90" },
  { codice: "HPS/1", nome: "Zirconium Stainless-Steel", colore: "#BDBBBB" },
  { codice: "GL", nome: "Grafite", colore: "#54504F" },
  { codice: "GM", nome: "Grafite Mat", colore: "#28201A" },
  { codice: "VL", nome: "Vintage", colore: "#CB9864" },
  { codice: "VM", nome: "Vintage Mat", colore: "#B98756" },
  { codice: "CR", nome: "Cromo", colore: "#EAE7E6" },
  { codice: "CM", nome: "Cromat", colore: "#D6D4D4" },
  { codice: "NI", nome: "Nikelmat", colore: "#A59D8F" },
  { codice: "BR", nome: "Bronzo", colore: "#895623" },
  { codice: "BA", nome: "Bronzo Antico", colore: "#61432B" },
  { codice: "OA", nome: "Ottone Antico", colore: "#B78F44" },
  { codice: "SM", nome: "Silvermat", colore: "#C6CBCE" },
  { codice: "CH", nome: "Cherry", colore: "#D94349" },
  { codice: "DG", nome: "Dark Green", colore: "#00532D" },
  { codice: "UB", nome: "Umber Bronze", colore: "#514B3E" },
  { codice: "NM", nome: "Neromat", colore: "#060706" },
  { codice: "BI", nome: "Biancomat", colore: "#F3F0F1" },
  { codice: "C01", nome: "White", colore: "#FFFEF2" },
  { codice: "C02", nome: "Bronze", colore: "#3D2110" },
  { codice: "C03", nome: "Black", colore: "#000F17" },
  { codice: "C04", nome: "Silver", colore: "#9C9898" },
  { codice: "C05", nome: "Titan", colore: "#0A1B23" },
  { codice: "C06", nome: "Ocean Blue", colore: "#637893" },
  { codice: "C07", nome: "Strawberry Red", colore: "#E21A52" },
  { codice: "C08", nome: "Sunset Orange", colore: "#F36F31" },
  { codice: "C09", nome: "Lemon Yellow", colore: "#FFD400" },
  { codice: "C10", nome: "Claret Violet", colore: "#5D0035" },
  { codice: "C11", nome: "Lime Green", colore: "#4DB857" },
  { codice: "C12", nome: "Capri Blue", colore: "#005596" },
];

export const FINITURE_PER_CODICE = new Map(FINITURE.map((f) => [f.codice, f]));

/**
 * La finitura di un codice articolo, se la sua coda è una delle 31 pubblicate.
 * `null` quando la coda non c'è (237 codici senza trattino) o non è ufficiale.
 */
export function finituraDiCodice(code: string): string | null {
  const i = code.lastIndexOf("-");
  if (i < 0) return null;
  const coda = code.slice(i + 1).toUpperCase();
  return FINITURE_PER_CODICE.has(coda) ? coda : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/maniglie/finiture.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/finiture.ts src/server/maniglie/finiture.test.ts
git commit -m "feat(maniglie): le 31 finiture che COLOMBO pubblica, come modulo"
```

---

### Task 2: La tabella dei 79 archivi e il parser dei nomi file

**Files:**
- Create: `src/server/maniglie/foto-archivio.ts`
- Test: `src/server/maniglie/foto-archivio.test.ts`

**Interfaces:**
- Consumes: `finituraDiCodice`, `FINITURE_PER_CODICE` da Task 1.
- Produces:
  - `ARCHIVI: Record<string, VoceArchivio>` con `interface VoceArchivio { etichetta: string | null; serie?: string }`
  - `scattoDiProdotto(nome: string): boolean`
  - `finituraDiFoto(nome: string): string | null`
  - `variantiZero(s: string): boolean`
  - `chiaveFoto(archivio: string, nome: string): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  ARCHIVI,
  chiaveFoto,
  finituraDiFoto,
  scattoDiProdotto,
  variantiZero,
} from "./foto-archivio";

describe("tabella degli archivi", () => {
  it("copre tutti e 79 gli archivi dell'area download", () => {
    expect(Object.keys(ARCHIVI)).toHaveLength(79);
  });

  it("la serie esiste solo dove un'etichetta ha più archivi", () => {
    // ROBOT, ONE e DUE: due archivi ciascuno, separati dalla serie di codice.
    expect(ARCHIVI["01_Robot1_m"]).toEqual({ etichetta: "ROBOT", serie: "CD41" });
    expect(ARCHIVI["01_Robot1_p"]).toEqual({ etichetta: "ROBOT", serie: "CD75" });
    expect(ARCHIVI["01_One Q"]).toEqual({ etichetta: "ONE", serie: "CC21" });
    expect(ARCHIVI["01_Due Q"]).toEqual({ etichetta: "DUE", serie: "CC41" });
  });

  it("gli archivi la cui serie NON è scritta da nessuna parte non hanno etichetta", () => {
    // MR11 vs MR15, LC31 vs LC41, LC71 vs LC81: l'ordinale della cartella non è
    // la serie. Indovinare produrrebbe una foto giusta di un prodotto sbagliato.
    for (const a of ["01_Spider_m", "01_Spider_p", "01_Milla_1", "01_Milla_2", "01_Trama_1", "01_Trama_2"]) {
      expect(ARCHIVI[a]).toEqual({ etichetta: null });
    }
  });

  it("i cinque prodotti non ancora a listino non hanno etichetta", () => {
    for (const a of ["00a_Laconica", "00b_Robot6", "00c_Robot6S", "00d_Halo", "00e_Kubo"]) {
      expect(ARCHIVI[a]?.etichetta).toBeNull();
    }
  });

  it("i sei archivi di accessori non si agganciano per etichetta", () => {
    // Lì il codice è scritto nel nome del file: ci pensa il gradino 3.
    expect(ARCHIVI["03_Maniglioni_Pulls"]?.etichetta).toBeNull();
    expect(ARCHIVI["02_Pomoli"]?.etichetta).toBeNull();
  });
});

describe("tipo di scatto", () => {
  it("scarta gli scatti d'ambiente", () => {
    expect(scattoDiProdotto("Robo4_def")).toBe(false);
    expect(scattoDiProdotto("Mood 2_IMG_0033")).toBe(false);
    expect(scattoDiProdotto("03_Mood ocean")).toBe(false);
  });

  it("tiene gli scatti di prodotto", () => {
    expect(scattoDiProdotto("Fedra_1OL")).toBe(true);
    expect(scattoDiProdotto("bold_45")).toBe(true);
    expect(scattoDiProdotto("roboquattro cromo matte")).toBe(true);
  });
});

describe("finitura dal nome del file", () => {
  it("legge la coda numerata quando è una delle 31", () => {
    expect(finituraDiFoto("Fedra_1OL")).toBe("OL");
    expect(finituraDiFoto("roboquattro-3CR")).toBe("CR");
    expect(finituraDiFoto("robot41_4NM_new")).toBe("NM");
  });

  it("non legge le parole per esteso", () => {
    // `cromo` è scritto in italiano in 106 nomi e `bronze` in inglese in 18:
    // due lingue e nessun elenco chiuso. La finitura si legge solo dove
    // COLOMBO ha scritto il SUO codice.
    expect(finituraDiFoto("roboquattro cromo matte")).toBeNull();
    expect(finituraDiFoto("due frontale bronze")).toBeNull();
  });

  it("i bicolori non sono una delle 31", () => {
    expect(finituraDiFoto("milla1_1OLOM")).toBeNull();
  });
});

describe("variante ZERO", () => {
  it("la riconosce da entrambi i lati, come parola intera", () => {
    expect(variantiZero("roboquattro zero frontale oroplus_new")).toBe(true);
    expect(variantiZero("ROBOQUATTRO ID41RSB ZERO")).toBe(true);
    expect(variantiZero("roboquattro-1OL")).toBe(false);
    expect(variantiZero("FEDRA AC11R CROMAT")).toBe(false);
  });
});

describe("chiave Blob", () => {
  it("è derivata dalla sorgente, tutta minuscola", () => {
    expect(chiaveFoto("01_Fedra", "Fedra_1OL")).toBe("maniglie/colombo/01-fedra/fedra-1ol");
    expect(chiaveFoto("01_Due Q", "dueq frontale black")).toBe(
      "maniglie/colombo/01-due-q/dueq-frontale-black",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.test.ts`
Expected: FAIL — `Cannot find module './foto-archivio'`

- [ ] **Step 3: Write minimal implementation**

`ARCHIVI` va scritta per esteso, tutte e 79 le righe. Le 73 non elencate qui sotto
sono **identità** (`{ etichetta: "<STEM MAIUSCOLO>" }`, es. `01_Fedra` → `FEDRA`), e
vanno comunque scritte a mano una per una: una tabella che si calcola da sé
maschera i casi in cui il calcolo sbaglia. Elenco degli stem dalla sezione
«PHOTO ARCHIVE» dell'area download.

```ts
import { FINITURE_PER_CODICE } from "./finiture";

/**
 * L'ARCHIVIO FOTOGRAFICO UFFICIALE COLOMBO, mappato al catalogo.
 *
 * L'unità è l'ARCHIVIO, non il gruppo di sfoglio: `01_Fedra/` *è* l'etichetta, non
 * un titolo da decifrare. Ma un gruppo a volte ospita DUE archivi (maniglia e
 * pomolo, o due serie diverse dello stesso nome commerciale), e allora la cartella
 * da sola non sceglie: serve la `serie`, cioè il prefisso di codice, e la si
 * dichiara SOLO dove COLOMBO l'ha scritta.
 *
 * `etichetta: null` = quell'archivio non aggancia articoli per nome di modello. Tre
 * ragioni diverse, tutte annotate riga per riga: prodotto non ancora a listino ·
 * accessori (lì il codice sta nel nome del file, ci pensa il gradino 3) · serie
 * NON DECIDIBILE. L'ultima è la più importante: la serie sbagliata produrrebbe una
 * foto che esiste, si vede bene ed è di un altro prodotto — nessun errore, nessun
 * warning, nessuno se ne accorge.
 */
export interface VoceArchivio {
  /** Etichetta di sfoglio (post-curatela). `null` = nessun aggancio per modello. */
  etichetta: string | null;
  /** Prefisso di codice, quando un'etichetta ha più archivi. */
  serie?: string;
}

export const ARCHIVI: Record<string, VoceArchivio> = {
  // ── prodotti nuovi, non ancora a listino: si aggancieranno da soli ──────────
  "00a_Laconica": { etichetta: null },
  "00b_Robot6": { etichetta: null },
  "00c_Robot6S": { etichetta: null },
  "00d_Halo": { etichetta: null },
  "00e_Kubo": { etichetta: null },

  // ── modelli, un archivio per etichetta ─────────────────────────────────────
  "01_963": { etichetta: "963" },
  "01_Alato": { etichetta: "ALATO" },
  "01_Alba": { etichetta: "ALBA" },
  "01_Ama": { etichetta: "AMA" },
  "01_Blazer": { etichetta: "BLAZER" },
  // `_p` è il POMOLO bold, e il pomolo bold non è nel listino 2026: la sua foto
  // in `02_Pomoli` resta orfana. Quindi `_m` non è ambiguo.
  "01_Bold_m": { etichetta: "BOLD" },
  "01_Bold_p": { etichetta: null },
  "01_Cameo": { etichetta: "CAMEO" },
  "01_Daytona": { etichetta: "DAYTONA" },
  "01_Dea": { etichetta: "DEA" },
  "01_Drop": { etichetta: "DROP" },
  // MOOD Collection: le pagine prodotto del listino COLOMBO stampano CC31 sotto
  // «Due» e CC41 sotto «DueQ»; i nomi dei file dicono `due …` e `dueq …`.
  "01_Due": { etichetta: "DUE", serie: "CC31" },
  "01_Due Q": { etichetta: "DUE", serie: "CC41" },
  "01_Edo": { etichetta: "EDO" },
  "01_Electra": { etichetta: "ELECTRA" },
  "01_Elle": { etichetta: "ELLE" },
  "01_Ellesse": { etichetta: "ELLESSE" },
  "01_Esprit": { etichetta: "ESPRIT" },
  "01_Fedra": { etichetta: "FEDRA" },
  "01_Flessa": { etichetta: "FLESSA" },
  "01_Gaia": { etichetta: "GAIA" },
  "01_Gira": { etichetta: "GIRA" },
  "01_Gryps": { etichetta: "GRYPS" },
  "01_Heidi": { etichetta: "HEIDI" },
  "01_Ida": { etichetta: "IDA" },
  "01_Isy": { etichetta: "ISY" },
  "01_Lara": { etichetta: "LARA" },
  "01_Libra": { etichetta: "LIBRA" },
  "01_Lund": { etichetta: "LUND" },
  "01_Mach": { etichetta: "MACH" },
  "01_Madi": { etichetta: "MADI" },
  "01_Mapo": { etichetta: "MAPO" },
  "01_Meta": { etichetta: "META" },
  // LC31 e LC41 sono due maniglie diverse; «1» e «2» nel nome della cartella NON
  // sono la serie, e nessuna fonte di COLOMBO le accoppia. → domanda aperta.
  "01_Milla_1": { etichetta: null },
  "01_Milla_2": { etichetta: null },
  "01_Mixa": { etichetta: "MIXA" },
  "01_Moon": { etichetta: "MOON" },
  "01_Olly": { etichetta: "OLLY" },
  "01_One": { etichetta: "ONE", serie: "CC11" },
  "01_One Q": { etichetta: "ONE", serie: "CC21" },
  "01_Peak": { etichetta: "PEAK" },
  "01_Pegaso": { etichetta: "PEGASO" },
  "01_Peter": { etichetta: "PETER" },
  "01_Piuma": { etichetta: "PIUMA" },
  // I nomi dei file dicono `robot41_*` e `robot75_*`, e l'indice del listino
  // COLOMBO stampa «robot CD41» (maniglie) e «robot CD75» (pomoli).
  "01_Robot1_m": { etichetta: "ROBOT", serie: "CD41" },
  "01_Robot1_p": { etichetta: "ROBOT", serie: "CD75" },
  "01_Robot2": { etichetta: "ROBODUE" },
  "01_Robot3": { etichetta: "ROBOTRE" },
  "01_Robot4": { etichetta: "ROBOQUATTRO" },
  "01_Robot4S": { etichetta: "ROBOQUATTRO S" },
  "01_Robot5": { etichetta: "ROBOCINQUE" },
  "01_Robot5S": { etichetta: "ROBOCINQUE S" },
  "01_Sirio": { etichetta: "SIRIO" },
  "01_Slim": { etichetta: "SLIM" },
  // MR11 e MR15: due maniglie, accoppiamento non scritto. → domanda aperta.
  "01_Spider_m": { etichetta: null },
  "01_Spider_p": { etichetta: null },
  "01_Star": { etichetta: "STAR" },
  "01_Tacta": { etichetta: "TACTA" },
  "01_Taipan": { etichetta: "TAIPAN" },
  "01_Tecno": { etichetta: "TECNO" },
  "01_Tender": { etichetta: "TENDER" },
  "01_Tool": { etichetta: "TOOL" },
  // LC71 e LC81: come MILLA. → domanda aperta.
  "01_Trama_1": { etichetta: null },
  "01_Trama_2": { etichetta: null },
  "01_Twitty": { etichetta: "TWITTY" },
  "01_Viola": { etichetta: "VIOLA" },
  "01_Wing": { etichetta: "WING" },
  "01_Zelda": { etichetta: "ZELDA" },

  // ── accessori: il codice sta nel nome del file (gradino 3) ─────────────────
  "02_Pomoli": { etichetta: null },
  "03_Maniglioni_Pulls": { etichetta: null },
  "04_Incasso_Flush handles": { etichetta: null },
  "05_Blindate_Armored door": { etichetta: null },
  "06_Complementi": { etichetta: null },
  "07_Kombo_Box": { etichetta: null },
};

/**
 * Uno scatto d'ambiente non è una foto di prodotto: `Robo4_def.jpg` è 8268×7087,
 * 34 MB, la maniglia su fondo colorato con ombre lunghe. In una griglia di
 * miniature su bianco stona. Sono 68 file su 707, e si riconoscono dal suffisso
 * `_def` o dal nome della campagna (`Mood`, `IMG_`).
 */
export function scattoDiProdotto(nome: string): boolean {
  const b = nome.toLowerCase();
  return !/[_ ]def$/.test(b) && !b.includes("img_") && !/\bmood\b/.test(b);
}

/**
 * La finitura scritta da COLOMBO in coda al nome, come SUO codice: `Fedra_1OL`,
 * `robot41_4NM_new`. Le parole per esteso non contano: `cromo` compare in 106 nomi
 * e `bronze` in 18 — due lingue e nessun elenco chiuso.
 */
export function finituraDiFoto(nome: string): string | null {
  const m = /[ _-](\d)(C\d\d|[A-Z]{2})(_new)?$/i.exec(nome);
  if (!m) return null;
  const codice = m[2]!.toUpperCase();
  return FINITURE_PER_CODICE.has(codice) ? codice : null;
}

/**
 * La variante ZERO (rosetta a scomparsa) è un prodotto a sé: 156 codici a listino
 * la nominano nella descrizione e 71 file dell'archivio nel nome. Sono due parole
 * scritte da COLOMBO in due posti diversi, e devono combaciare — la foto liscia su
 * un articolo ZERO è la foto sbagliata, non una foto approssimata.
 */
export function variantiZero(s: string): boolean {
  return /\bzero\b/i.test(s);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * La chiave Blob è DERIVATA dalla sorgente, non dall'articolo: due articoli che
 * condividono la foto condividono il file, e lo script la carica una volta sola.
 * Verificato sui 707 nomi veri: zero collisioni.
 */
export function chiaveFoto(archivio: string, nome: string): string {
  return `maniglie/colombo/${slug(archivio)}/${slug(nome)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts
git commit -m "feat(maniglie): la tabella dei 79 archivi COLOMBO e il parser dei nomi"
```

---

### Task 3: L'abbinamento articolo → foto

**Files:**
- Modify: `src/server/maniglie/foto-archivio.ts`
- Modify: `src/server/maniglie/foto-archivio.test.ts`

**Interfaces:**
- Consumes: `ARCHIVI`, `scattoDiProdotto`, `finituraDiFoto`, `variantiZero`, `chiaveFoto`, `finituraDiCodice`, `browseLabel` (da `./curatela`).
- Produces:
  - `interface FotoArchivio { archivio: string; nome: string }`
  - `abbinaFoto(articoli: ArticoloDaAbbinare[], foto: FotoArchivio[]): Map<string, string>` — id articolo → chiave Blob; gli articoli senza foto **non compaiono**
  - `interface ArticoloDaAbbinare { id: string; code: string; codeNorm: string; name: string }`

- [ ] **Step 1: Write the failing test**

```ts
import { abbinaFoto, type ArticoloDaAbbinare, type FotoArchivio } from "./foto-archivio";

const art = (over: Partial<ArticoloDaAbbinare> & { code: string; name: string }): ArticoloDaAbbinare => ({
  id: over.code,
  codeNorm: over.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
  ...over,
});

describe("abbinamento articolo → foto", () => {
  const fedra: FotoArchivio[] = [
    { archivio: "01_Fedra", nome: "Fedra_1OL" },
    { archivio: "01_Fedra", nome: "Fedra_2CR" },
    { archivio: "01_Fedra", nome: "Fedra_def" },
  ];

  it("gradino 2: la finitura esatta vince sulla foto di modello", () => {
    const m = abbinaFoto([art({ code: "0AC11R-CR", name: "FEDRA AC11R CROMO" })], fedra);
    expect(m.get("0AC11R-CR")).toBe("maniglie/colombo/01-fedra/fedra-2cr");
  });

  it("gradino 1: senza la sua finitura prende la foto del modello", () => {
    const m = abbinaFoto([art({ code: "0AC11R-VM", name: "FEDRA AC11R VINTAGE SAT." })], fedra);
    expect(m.get("0AC11R-VM")).toBe("maniglie/colombo/01-fedra/fedra-1ol");
  });

  it("non usa mai uno scatto d'ambiente", () => {
    const m = abbinaFoto([art({ code: "0AC11R-VM", name: "FEDRA AC11R VINTAGE SAT." })], [
      { archivio: "01_Fedra", nome: "Fedra_def" },
    ]);
    expect(m.size).toBe(0);
  });

  it("gradino 3: il codice scritto nel nome del file vince su tutto", () => {
    const m = abbinaFoto(
      [art({ code: "0ID313RS-CM", name: "MANIGLIONE ID313RS CROMAT" })],
      [{ archivio: "03_Maniglioni_Pulls", nome: "ID313 RS_45" }],
    );
    expect(m.get("0ID313RS-CM")).toBe("maniglie/colombo/03-maniglioni-pulls/id313-rs-45");
  });

  it("la variante ZERO non riceve la foto liscia, e viceversa", () => {
    const foto: FotoArchivio[] = [
      { archivio: "01_Robot4", nome: "roboquattro-1OL" },
      { archivio: "01_Robot4", nome: "roboquattro zero frontale oroplus_new" },
    ];
    const m = abbinaFoto(
      [
        art({ code: "0ID41R-OL", name: "ROBOQUATTRO ID41R OROPLUS" }),
        art({ code: "0ID41RSB/0-OL", name: "ROBOQUATTRO ID41RSB ZERO" }),
      ],
      foto,
    );
    expect(m.get("0ID41R-OL")).toBe("maniglie/colombo/01-robot4/roboquattro-1ol");
    expect(m.get("0ID41RSB/0-OL")).toBe(
      "maniglie/colombo/01-robot4/roboquattro-zero-frontale-oroplus-new",
    );
  });

  it("la serie separa i due archivi di uno stesso gruppo", () => {
    const foto: FotoArchivio[] = [
      { archivio: "01_Robot1_m", nome: "robot41_2CR" },
      { archivio: "01_Robot1_p", nome: "robot75_3CR" },
    ];
    const m = abbinaFoto(
      [
        art({ code: "0CD41R-CR", name: "ROBOT CD41R CROMO" }),
        art({ code: "0CD75R-CR", name: "ROBOT CD75R CROMO" }),
      ],
      foto,
    );
    expect(m.get("0CD41R-CR")).toBe("maniglie/colombo/01-robot1-m/robot41-2cr");
    expect(m.get("0CD75R-CR")).toBe("maniglie/colombo/01-robot1-p/robot75-3cr");
  });

  it("un archivio senza etichetta non presta la sua foto a nessuno", () => {
    // SPIDER: due archivi, accoppiamento archivio↔serie non scritto.
    const m = abbinaFoto([art({ code: "0MR11R-CM", name: "SPIDER MR11R CROMAT" })], [
      { archivio: "01_Spider_m", nome: "spider1_1CR" },
    ]);
    expect(m.size).toBe(0);
  });

  it("è deterministico: la stessa lista dà sempre la stessa chiave", () => {
    const foto = [
      { archivio: "01_Fedra", nome: "Fedra_2CR" },
      { archivio: "01_Fedra", nome: "Fedra_1OL" },
    ];
    const a = art({ code: "0AC11R-VM", name: "FEDRA AC11R VINTAGE SAT." });
    expect(abbinaFoto([a], foto).get(a.id)).toBe(abbinaFoto([a], [...foto].reverse()).get(a.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.test.ts`
Expected: FAIL — `abbinaFoto is not a function`

- [ ] **Step 3: Write minimal implementation**

Aggiungere in coda a `src/server/maniglie/foto-archivio.ts`:

```ts
import { browseLabel } from "./curatela";
import { finituraDiCodice } from "./finiture";

export interface FotoArchivio {
  /** Cartella dello zip, senza `.zip`: `01_Fedra`. */
  archivio: string;
  /** Nome del file senza estensione: `Fedra_1OL`. */
  nome: string;
}

export interface ArticoloDaAbbinare {
  id: string;
  code: string;
  codeNorm: string;
  name: string;
}

const senzaZeroIniziale = (codeNorm: string) => codeNorm.replace(/^0/, "");

/** Il nucleo del codice: senza lo 0 di testa e senza la coda di finitura. */
function nucleo(a: ArticoloDaAbbinare): string {
  const fin = finituraDiCodice(a.code);
  const senzaCoda = fin ? a.code.slice(0, a.code.lastIndexOf("-")) : a.code;
  return senzaZeroIniziale(senzaCoda.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
}

/** Sotto i 5 caratteri un nucleo aggancerebbe quasi qualunque nome per caso. */
const MIN_NUCLEO = 5;

/**
 * Articolo → chiave Blob della sua foto. Gli articoli senza foto NON compaiono
 * nella mappa: `undefined` è la risposta, e non c'è una chiave «di riserva».
 *
 * Tre gradini, in ordine di forza — tutti e tre sono cose che COLOMBO ha scritto:
 *  3. il CODICE dell'articolo è nel nome del file (l'unica affermazione su un
 *     codice d'ordine: raggiunge maniglioni, pomoli, bocchette e complementi, che
 *     per nome di modello sarebbero irraggiungibili);
 *  2. la FINITURA del file è quella dell'articolo;
 *  1. la foto del MODELLO, in una finitura qualunque.
 *
 * Su tutti e tre pesa il filtro della variante ZERO.
 */
export function abbinaFoto(
  articoli: ArticoloDaAbbinare[],
  foto: FotoArchivio[],
): Map<string, string> {
  const usabili = foto
    .filter((f) => scattoDiProdotto(f.nome))
    .map((f) => ({
      ...f,
      chiave: chiaveFoto(f.archivio, f.nome),
      nomeNorm: f.nome.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      finitura: finituraDiFoto(f.nome),
      zero: variantiZero(f.nome),
    }))
    // Ordine stabile: l'abbinamento non deve dipendere dall'ordine di lettura
    // degli zip, o la stessa richiesta darebbe due chiavi diverse.
    .sort((a, b) => a.chiave.localeCompare(b.chiave));

  const out = new Map<string, string>();
  for (const a of articoli) {
    const nu = nucleo(a);
    const zero = variantiZero(a.name);

    if (nu.length >= MIN_NUCLEO) {
      const perCodice = usabili.filter((f) => f.nomeNorm.includes(nu));
      if (perCodice.length > 0) {
        // Il match più lungo: fra `PB13` e `PB1304` vince chi dice di più.
        const scelta = [...perCodice].sort(
          (x, y) => y.nomeNorm.length - x.nomeNorm.length || x.chiave.localeCompare(y.chiave),
        )[0]!;
        out.set(a.id, scelta.chiave);
        continue;
      }
    }

    const etichetta = browseLabel(a.name);
    if (etichetta === null) continue;
    const senzaZero = senzaZeroIniziale(a.codeNorm);
    const candidate = usabili.filter((f) => {
      const voce = ARCHIVI[f.archivio];
      if (!voce || voce.etichetta !== etichetta) return false;
      if (voce.serie && !senzaZero.startsWith(voce.serie)) return false;
      return f.zero === zero;
    });
    if (candidate.length === 0) continue;

    const finitura = finituraDiCodice(a.code);
    const esatta = finitura ? candidate.find((f) => f.finitura === finitura) : undefined;
    out.set(a.id, (esatta ?? candidate[0]!).chiave);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts
git commit -m "feat(maniglie): l'abbinamento articolo→foto, tre gradini e nessuna invenzione"
```

---

### Task 4: La route che serve i byte

**Files:**
- Create: `src/app/api/article-image/chiave-param.ts`
- Create: `src/app/api/article-image/chiave-param.test.ts`
- Create: `src/app/api/article-image/route.ts`
- Create: `src/app/api/article-image/route.test.ts`

**Interfaces:**
- Consumes: `env.BLOB_READ_WRITE_TOKEN`, `auth` (`@/server/auth/config`), `get` da `@vercel/blob`.
- Produces: `parseChiaveFoto(raw: string | null): string | null`, `parseSizeFoto(raw: string | null): 320 | 900 | null`, `GET`.

- [ ] **Step 1: Write the failing test (validazione del parametro)**

```ts
import { describe, it, expect } from "vitest";
import { parseChiaveFoto, parseSizeFoto } from "./chiave-param";

describe("parseChiaveFoto", () => {
  it("accetta una chiave del nostro prefisso", () => {
    expect(parseChiaveFoto("maniglie/colombo/01-fedra/fedra-1ol")).toBe(
      "maniglie/colombo/01-fedra/fedra-1ol",
    );
  });

  it("rifiuta tutto ciò che esce dal prefisso", () => {
    for (const bad of [
      null,
      "",
      "listino/page-1",
      "maniglie/colombo/../../listino/page-1",
      "maniglie/colombo/01-fedra/fedra-1ol/extra",
      "maniglie/colombo//fedra-1ol",
      "maniglie/colombo/01-Fedra/fedra-1ol",
      "https://altro.example/x",
      `maniglie/colombo/01-fedra/${"a".repeat(200)}`,
    ]) {
      expect(parseChiaveFoto(bad)).toBeNull();
    }
  });
});

describe("parseSizeFoto", () => {
  it("accetta solo i due formati generati", () => {
    expect(parseSizeFoto("320")).toBe(320);
    expect(parseSizeFoto("900")).toBe(900);
  });
  it("rifiuta il resto", () => {
    for (const bad of [null, "", "0320", "321", "1200", "abc"]) {
      expect(parseSizeFoto(bad)).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/article-image/chiave-param.test.ts`
Expected: FAIL — modulo assente

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/article-image/chiave-param.ts
/**
 * Valida la chiave Blob prima di passarla a `get()` (anti-SSRF / path-injection),
 * con la stessa disciplina di `parsePageParam` del listino: forma canonica
 * ancorata, tutto il resto → `null` (la route risponde 400).
 *
 * Il prefisso è nostro e chiuso: nessuna chiave fuori da `maniglie/colombo/` è
 * raggiungibile, quindi la route non può servire il listino né altro che stia
 * sullo stesso store.
 */
const CHIAVE = /^maniglie\/colombo\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,80}$/;

export function parseChiaveFoto(raw: string | null): string | null {
  return raw !== null && CHIAVE.test(raw) ? raw : null;
}

/** Solo i due formati che lo script genera: chiedere un terzo darebbe un 502. */
export function parseSizeFoto(raw: string | null): 320 | 900 | null {
  return raw === "320" ? 320 : raw === "900" ? 900 : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/api/article-image/chiave-param.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test (route)**

Modellare su `src/app/api/listino/route.test.ts` (leggerlo prima: usa gli stessi
mock di `next/headers`, `@/server/auth/config` e `@vercel/blob`).

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
const blobGet = vi.fn();
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock("@/server/auth/config", () => ({ auth: { api: { getSession: () => getSession() } } }));
vi.mock("@vercel/blob", () => ({ get: (...a: unknown[]) => blobGet(...a) }));
vi.mock("@/env", () => ({ env: { BLOB_READ_WRITE_TOKEN: "tok" } }));

const { GET } = await import("./route");
const req = (qs: string) => new Request(`http://x/api/article-image?${qs}`);

describe("GET /api/article-image", () => {
  beforeEach(() => {
    getSession.mockReset();
    blobGet.mockReset();
    getSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("401 senza sessione", async () => {
    getSession.mockResolvedValue(null);
    expect((await GET(req("k=maniglie/colombo/01-fedra/fedra-1ol&size=320"))).status).toBe(401);
  });

  it("400 su chiave non valida", async () => {
    expect((await GET(req("k=listino/page-1&size=320"))).status).toBe(400);
  });

  it("400 su formato non generato", async () => {
    expect((await GET(req("k=maniglie/colombo/01-fedra/fedra-1ol&size=1200"))).status).toBe(400);
  });

  it("serve il WebP del formato chiesto, dallo store privato", async () => {
    blobGet.mockResolvedValue({ stream: new ReadableStream() });
    const res = await GET(req("k=maniglie/colombo/01-fedra/fedra-1ol&size=900"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(blobGet).toHaveBeenCalledWith("maniglie/colombo/01-fedra/fedra-1ol-900.webp", {
      access: "private",
      token: "tok",
    });
  });

  it("404 quando la foto non c'è: è la normalità, non un errore", async () => {
    blobGet.mockRejectedValue(new Error("not found"));
    expect((await GET(req("k=maniglie/colombo/01-fedra/x&size=320"))).status).toBe(404);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/article-image/route.test.ts`
Expected: FAIL — modulo assente

- [ ] **Step 7: Write minimal implementation**

```ts
// src/app/api/article-image/route.ts
import { headers } from "next/headers";
import { get } from "@vercel/blob";
import { auth } from "@/server/auth/config";
import { env } from "@/env";
import { parseChiaveFoto, parseSizeFoto } from "./chiave-param";

export const runtime = "nodejs";

/**
 * Serve una foto d'articolo COLOMBO da Vercel Blob (store PRIVATO), dietro auth.
 * Stessa forma di `/api/listino`: le foto sono di un fornitore e non devono essere
 * raggiungibili pubblicamente — `public/` è escluso, il repo è pubblico.
 *
 * Uso: `?k=<chiave>&size=320|900`.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Non autorizzato", { status: 401 });

  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) return new Response("Foto non configurate", { status: 503 });

  const url = new URL(req.url);
  const chiave = parseChiaveFoto(url.searchParams.get("k"));
  const size = parseSizeFoto(url.searchParams.get("size"));
  if (chiave === null || size === null) {
    return new Response("Richiesta non valida", { status: 400 });
  }

  const res = await get(`${chiave}-${size}.webp`, { access: "private", token }).catch(() => null);
  // La foto mancante è la NORMALITÀ (42% dei codici non ne ha una): 404 pulito,
  // e la UI disegna il segnaposto senza dire che è successo qualcosa.
  if (!res?.stream) return new Response("Foto non trovata", { status: 404 });

  return new Response(res.stream, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      // Immutabile per chiave: la chiave cambia se cambia la foto.
      "Cache-Control": "private, max-age=604800, immutable",
    },
  });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm vitest run src/app/api/article-image/`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/app/api/article-image
git commit -m "feat(maniglie): la route che serve le foto dal Blob privato"
```

---

### Task 5: Il router espone l'URL, non la chiave

**Files:**
- Modify: `src/server/api/routers/article.ts` (`toSummary`, `getById`)
- Modify: `src/server/api/routers/article.test.ts`

**Interfaces:**
- Consumes: `articles.image_url` (chiave Blob), `parseChiaveFoto` non serve qui.
- Produces: `ArticleSummary.imageUrl: string | null` = `/api/article-image?k=…&size=320`; `getById` in più `imageUrlLarge: string | null` (size 900).

- [ ] **Step 1: Write the failing test**

Aggiungere a `src/server/api/routers/article.test.ts` (leggerlo prima: usa un
`db` finto con `article.findMany`/`findUnique`):

```ts
it("la chiave a DB diventa l'URL della route, non esce mai grezza", async () => {
  // ... predisporre una riga con imageUrl: "maniglie/colombo/01-fedra/fedra-1ol"
  const res = await caller.search({ query: "fedra" });
  expect(res.hits[0]!.imageUrl).toBe(
    "/api/article-image?k=maniglie%2Fcolombo%2F01-fedra%2Ffedra-1ol&size=320",
  );
});

it("un articolo senza foto ha imageUrl null: nessuna richiesta sprecata", async () => {
  // riga con imageUrl: null
  const res = await caller.search({ query: "vite" });
  expect(res.hits[0]!.imageUrl).toBeNull();
});

it("la scheda riceve anche il formato grande", async () => {
  const res = await caller.getById({ id: "a1" });
  expect(res.imageUrlLarge).toBe(
    "/api/article-image?k=maniglie%2Fcolombo%2F01-fedra%2Ffedra-1ol&size=900",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/api/routers/article.test.ts`
Expected: FAIL — `imageUrl` è ancora la chiave grezza, `imageUrlLarge` non esiste

- [ ] **Step 3: Write minimal implementation**

In `src/server/api/routers/article.ts`, sopra `toSummary`:

```ts
/**
 * `articles.image_url` conserva la CHIAVE Blob, non un URL: il file sta su uno
 * store privato e i byte passano sempre dalla route autenticata. Il browser vede
 * solo un percorso della nostra applicazione.
 */
function urlFoto(chiave: string | null, size: 320 | 900): string | null {
  return chiave === null ? null : `/api/article-image?k=${encodeURIComponent(chiave)}&size=${size}`;
}
```

In `toSummary`: `imageUrl: urlFoto(a.imageUrl, 320)`.
In `getById`, nell'oggetto restituito: `imageUrlLarge: urlFoto(row.imageUrl, 900)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/api/routers/article.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/article.ts src/server/api/routers/article.test.ts
git commit -m "feat(maniglie): il router traduce la chiave Blob nell'URL della route"
```

---

### Task 6: La scheda articolo usa il formato grande

**Files:**
- Modify: `src/app/(dashboard)/maniglie/[id]/articolo-client.tsx:36`
- Modify: `src/app/(dashboard)/maniglie/[id]/articolo-client.test.tsx`

**Interfaces:**
- Consumes: `imageUrlLarge` da Task 5.
- Produces: nulla.

> Le **righe** (`maniglie-client.tsx`) non si toccano: `ArticoloRow` legge già
> `articolo.imageUrl` e `Foto` gestisce già il 404 col segnaposto. Era il posto
> disegnato la sessione scorsa e rimasto vuoto.

- [ ] **Step 1: Write the failing test**

```tsx
it("la scheda mostra la foto nel formato grande", async () => {
  // mock di api.article.getById con imageUrlLarge: "/api/article-image?k=x&size=900"
  render(<ArticoloClient id="a1" />);
  const img = await screen.findByRole("presentation", { hidden: true });
  expect(img.getAttribute("src")).toContain("size=900");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run "src/app/(dashboard)/maniglie/[id]/articolo-client.test.tsx"`
Expected: FAIL — la scheda usa ancora `imageUrl` (size=320)

- [ ] **Step 3: Write minimal implementation**

`articolo-client.tsx`: `<Foto url={a.imageUrlLarge} />`.
Aggiornare il commento di `Foto`: la foto arriva dalla route autenticata, non da
un URL Blob esterno; correggere anche il commento `eslint-disable` che dice
«URL esterno non ottimizzabile» in entrambi i file.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run "src/app/(dashboard)/maniglie"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/maniglie"
git commit -m "feat(maniglie): la scheda articolo mostra la foto a 900px"
```

---

### Task 7: Lettura dell'archivio remoto (zip via Range)

**Files:**
- Create: `src/server/maniglie/zip-range.ts`
- Test: `src/server/maniglie/zip-range.test.ts`

**Interfaces:**
- Consumes: `node:zlib` (`inflateRawSync`).
- Produces:
  - `interface VoceZip { nome: string; metodo: number; csize: number; usize: number; offset: number }`
  - `leggiCentralDirectory(coda: Buffer, dimensioneTotale: number): { inizio: number; lunghezza: number }`
  - `parseCentralDirectory(cd: Buffer): VoceZip[]`
  - `datiVoce(localHeader: Buffer, corpo: Buffer, voce: VoceZip): Buffer`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import {
  leggiCentralDirectory,
  parseCentralDirectory,
  datiVoce,
  type VoceZip,
} from "./zip-range";

/** Costruisce uno zip minimo in memoria: una voce STORE e una DEFLATE. */
function zipFinto(voci: { nome: string; dati: Buffer; deflate: boolean }[]) {
  // ... (implementare con Buffer.alloc + writeUInt32LE secondo APPNOTE.TXT)
}

describe("zip letto per intervalli", () => {
  it("trova la central directory dalla coda del file", () => {
    const zip = zipFinto([{ nome: "a/x.jpg", dati: Buffer.from("ciao"), deflate: false }]);
    const { inizio, lunghezza } = leggiCentralDirectory(zip, zip.length);
    expect(zip.subarray(inizio, inizio + 4)).toEqual(Buffer.from("PK\x01\x02", "latin1"));
    expect(lunghezza).toBeGreaterThan(0);
  });

  it("elenca le voci con offset e metodo", () => {
    const zip = zipFinto([
      { nome: "a/x.jpg", dati: Buffer.from("ciao"), deflate: false },
      { nome: "a/y.jpg", dati: Buffer.alloc(2048, 7), deflate: true },
    ]);
    const { inizio, lunghezza } = leggiCentralDirectory(zip, zip.length);
    const voci = parseCentralDirectory(zip.subarray(inizio, inizio + lunghezza));
    expect(voci.map((v) => v.nome)).toEqual(["a/x.jpg", "a/y.jpg"]);
    expect(voci[0]!.metodo).toBe(0);
    expect(voci[1]!.metodo).toBe(8);
  });

  it("restituisce i byte originali, compressi o no", () => {
    const dati = Buffer.alloc(2048, 7);
    const zip = zipFinto([{ nome: "a/y.jpg", dati, deflate: true }]);
    const { inizio, lunghezza } = leggiCentralDirectory(zip, zip.length);
    const v = parseCentralDirectory(zip.subarray(inizio, inizio + lunghezza))[0]!;
    const lh = zip.subarray(v.offset, v.offset + 30);
    const nlen = lh.readUInt16LE(26);
    const elen = lh.readUInt16LE(28);
    const inizioDati = v.offset + 30 + nlen + elen;
    expect(datiVoce(lh, zip.subarray(inizioDati, inizioDati + v.csize), v)).toEqual(dati);
  });
});
```

Implementare `zipFinto` per esteso nel file di test: header locale (30 byte,
firma `PK\x03\x04`), corpo, central directory (46 byte, firma `PK\x01\x02`), EOCD
(22 byte, firma `PK\x05\x06`), con `crc32` calcolato via `node:zlib` `crc32` se
disponibile o 0 (i lettori qui non lo verificano).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/zip-range.test.ts`
Expected: FAIL — modulo assente

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/maniglie/zip-range.ts
import { inflateRawSync } from "node:zlib";

/**
 * Il minimo di ZIP che serve per prendere UNA foto da un archivio remoto senza
 * scaricarlo: l'archivio COLOMBO pesa 3,5 GB e le foto che ci servono sono 228.
 *
 * Niente dipendenze: la central directory è tre `readUInt*LE` e `inflateRaw` sta
 * in `node:zlib`. Una libreria zip qui costerebbe più codice di quanto ne evita,
 * perché comunque servono le richieste Range.
 */
export interface VoceZip {
  nome: string;
  /** 0 = STORE, 8 = DEFLATE. */
  metodo: number;
  csize: number;
  usize: number;
  /** Offset del local header dentro lo zip. */
  offset: number;
}

/** Posizione e lunghezza della central directory, lette dall'EOCD in coda. */
export function leggiCentralDirectory(
  coda: Buffer,
  dimensioneTotale: number,
): { inizio: number; lunghezza: number } {
  const i = coda.lastIndexOf(Buffer.from("PK\x05\x06", "latin1"));
  if (i < 0) throw new Error("EOCD non trovato: l'archivio non è uno zip leggibile");
  const lunghezza = coda.readUInt32LE(i + 12);
  const inizio = coda.readUInt32LE(i + 16);
  if (inizio + lunghezza > dimensioneTotale) throw new Error("central directory fuori dal file");
  return { inizio, lunghezza };
}

export function parseCentralDirectory(cd: Buffer): VoceZip[] {
  const out: VoceZip[] = [];
  let p = 0;
  while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
    const nlen = cd.readUInt16LE(p + 28);
    const elen = cd.readUInt16LE(p + 30);
    const clen = cd.readUInt16LE(p + 32);
    out.push({
      nome: cd.subarray(p + 46, p + 46 + nlen).toString("utf8"),
      metodo: cd.readUInt16LE(p + 10),
      csize: cd.readUInt32LE(p + 20),
      usize: cd.readUInt32LE(p + 24),
      offset: cd.readUInt32LE(p + 42),
    });
    p += 46 + nlen + elen + clen;
  }
  return out;
}

/** I byte originali della voce. `corpo` è già il tratto compresso. */
export function datiVoce(localHeader: Buffer, corpo: Buffer, voce: VoceZip): Buffer {
  if (localHeader.readUInt32LE(0) !== 0x04034b50) throw new Error("local header non valido");
  return voce.metodo === 0 ? corpo : inflateRawSync(corpo);
}

/** Byte da chiedere per il corpo della voce: il local header dice quanto saltare. */
export function inizioDati(localHeader: Buffer, voce: VoceZip): number {
  return voce.offset + 30 + localHeader.readUInt16LE(26) + localHeader.readUInt16LE(28);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/maniglie/zip-range.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/zip-range.ts src/server/maniglie/zip-range.test.ts
git commit -m "feat(maniglie): leggere una voce di zip remoto per intervalli"
```

---

### Task 8: Lo script ops `pnpm foto:colombo`

**Files:**
- Create: `scripts/foto-colombo.ts`
- Modify: `package.json` (script `foto:colombo`, devDependency `sharp`)
- Create: `.github/workflows/ops-foto-colombo.yml`

**Interfaces:**
- Consumes: `ARCHIVI`/`abbinaFoto`/`chiaveFoto` (Task 2-3), `zip-range` (Task 7), `sharp`, `put`/`head` da `@vercel/blob`, Prisma.
- Produces: `articles.image_url` popolata; nessuna esportazione riusata altrove.

- [ ] **Step 1: Installare la dipendenza e dichiarare lo script**

```bash
pnpm add -D sharp
```

In `package.json`, fra gli `scripts`:
```json
"foto:colombo": "tsx --env-file-if-exists=.env scripts/foto-colombo.ts"
```

`sharp` è **devDependency**: la usa solo lo script ops, mai l'applicazione — non
entra nel bundle Vercel.

- [ ] **Step 2: Scrivere lo script**

Struttura (modellare l'intestazione e lo stile su `scripts/import-listino.ts` e
`scripts/split-listino.ts`):

```ts
/**
 * Foto degli articoli COLOMBO: dall'archivio ufficiale a Vercel Blob privato.
 *
 * NON scarica i 3,5 GB. Legge l'indice dei 79 zip con richieste Range sulle
 * central directory (pochi MB), decide quali foto servono (modulo puro
 * `foto-archivio.ts`), e scarica SOLO quelle — una voce di zip alla volta, sempre
 * per intervalli. Idempotente: ciò che è già su Blob non si riscarica, quindi
 * rilanciarlo dopo un listino nuovo costa la sola rilettura degli indici.
 *
 * La password dell'area download arriva da COLOMBO_DOWNLOAD_PASSWORD e non è
 * scritta da nessuna parte.
 *
 * Uso: pnpm foto:colombo [--dry-run]
 */
```

Passi, in ordine:
1. `login()` — `POST https://download.colombodesign.com/` con `password` e
   `login=LOGIN`, conservando il cookie di sessione dalla risposta.
2. `elencaArchivi(html)` — le `href='/download/maniglie/archivio/*.zip'` (79).
3. per ogni zip: `HEAD` per la dimensione, `Range` sugli ultimi 64 KiB + 22 byte,
   `leggiCentralDirectory`, `Range` sulla central directory,
   `parseCentralDirectory`; tenere le voci `.jpg` che non stanno in `__MACOSX/`.
   **Verifica**: 707 foto in tutto — se il conto cambia, dirlo a schermo (l'archivio
   è del fornitore e può cambiare; il numero non è un'asserzione, è una notizia).
4. leggere gli articoli (`brand: "COLOMBO"`, `select` id/code/codeNorm/name) e
   chiamare `abbinaFoto`.
5. per ogni chiave distinta scelta: se `head(chiave + "-320.webp")` risponde,
   saltare; altrimenti scaricare la voce (`Range` sul local header, poi sul corpo),
   `datiVoce`, e per ogni formato:
   ```ts
   const webp = await sharp(originale)
     .resize(size, size, { fit: "inside", withoutEnlargement: true })
     .webp({ quality: 80 })
     .toBuffer();
   await put(`${chiave}-${size}.webp`, webp, {
     access: "private",
     token,
     contentType: "image/webp",
     addRandomSuffix: false,
     allowOverwrite: true,
   });
   ```
   `sharp` applica da sé il profilo ICC incorporato: il CMYK esce in sRGB coi
   colori giusti (verificato — l'oroplus esce oro).
6. scrivere `image_url`: prima `updateMany({ where: { brand }, data: { imageUrl: null } })`
   e poi un `update` per articolo abbinato, **in una transazione**. L'azzeramento
   serve perché un articolo che PERDE la foto (tabella corretta, listino nuovo)
   deve perderla davvero: senza, resterebbe a schermo la foto di prima e nessun
   conteggio andrebbe a zero.
7. riepilogo: foto scelte · caricate · saltate · articoli abbinati, per gradino.

Con `--dry-run` si fermano i passi 5 e 6 e si stampa solo il riepilogo: è così che
si verifica la copertura senza toccare né Blob né DB.

- [ ] **Step 3: Provarlo davvero, in locale, con `--dry-run`**

```bash
set -a; source .env; set +a
COLOMBO_DOWNLOAD_PASSWORD='…' pnpm foto:colombo --dry-run
```
Expected: `707 foto` · `228 chiavi scelte` · `1995 articoli abbinati (322 per codice · 994 per finitura · 679 per modello)`

- [ ] **Step 4: Il workflow ops**

Creare `.github/workflows/ops-foto-colombo.yml` sul modello di
`.github/workflows/ops-split-listino.yml` (leggerlo prima): `workflow_dispatch`,
`pnpm install`, engine Prisma, poi `pnpm foto:colombo`. Secret nuovi:
`COLOMBO_DOWNLOAD_PASSWORD`; già presenti: `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL`.

- [ ] **Step 5: Commit**

```bash
git add scripts/foto-colombo.ts package.json pnpm-lock.yaml .github/workflows/ops-foto-colombo.yml
git commit -m "feat(maniglie): lo script ops che porta le foto COLOMBO su Blob privato"
```

---

### Task 9: La guardia di copertura sul catalogo vero

**Files:**
- Create: `src/server/maniglie/foto-archivio.integration.test.ts`

**Interfaces:**
- Consumes: `abbinaFoto`, `ARCHIVI`, un dump dei nomi dell'archivio.
- Produces: nulla.

> Il gate gira **solo** con `INTEGRATION_DATABASE_URL`, come
> `search.integration.test.ts`, e richiede il listino vero importato. I 707 nomi
> **non si committano**: il test li legge da `process.env.COLOMBO_FOTO_INDEX`
> (percorso a un JSON prodotto da `pnpm foto:colombo --dry-run --dump`), e senza
> quella variabile si salta dichiarandolo.

- [ ] **Step 1: Write the failing test**

```ts
const url = process.env.INTEGRATION_DATABASE_URL;
const indice = process.env.COLOMBO_FOTO_INDEX;

describe.skipIf(!url || !indice)("foto ↔ catalogo vero", () => {
  it("copre almeno il 55% dei codici, e il numero non cala in silenzio", async () => {
    const coperti = abbinaFoto(articoli, foto).size;
    // La lezione del `widthMm: 550` del kit: una copertura che si restringe non
    // fa fallire nulla e nessun conteggio va a zero. Qui il pavimento è esplicito.
    expect(coperti / articoli.length).toBeGreaterThan(0.55);
  });

  it("ogni etichetta della tabella esiste davvero fra quelle dello sfoglio", async () => {
    const etichette = new Set(articoli.map((a) => browseLabel(a.name)).filter(Boolean));
    for (const [archivio, voce] of Object.entries(ARCHIVI)) {
      if (voce.etichetta === null) continue;
      expect(etichette, `${archivio} → ${voce.etichetta}`).toContain(voce.etichetta);
    }
  });

  it("ogni serie dichiarata aggancia almeno un codice a catalogo", async () => {
    for (const [archivio, voce] of Object.entries(ARCHIVI)) {
      if (!voce.serie) continue;
      const n = articoli.filter((a) => a.codeNorm.replace(/^0/, "").startsWith(voce.serie!)).length;
      expect(n, `${archivio} → ${voce.serie}`).toBeGreaterThan(0);
    }
  });

  it("nessun articolo dei gruppi non decidibili riceve una foto", async () => {
    const m = abbinaFoto(articoli, foto);
    for (const a of articoli.filter((a) => ["SPIDER", "MILLA", "TRAMA"].includes(browseLabel(a.name) ?? ""))) {
      // …a meno che il suo CODICE non sia scritto in un nome di file (gradino 3),
      // che è un'affermazione di COLOMBO e vale comunque.
      if (m.has(a.id)) expect(m.get(a.id)).toMatch(/^maniglie\/colombo\/0[2-7]-/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/maniglie/foto-archivio.integration.test.ts`
Expected: SKIP senza le variabili; con le variabili, FAIL finché l'indice non c'è

- [ ] **Step 3: Aggiungere `--dump <file>` allo script**

In `scripts/foto-colombo.ts`, con `--dump <percorso>` scrivere l'indice
`[{archivio, nome}]` in JSON. È l'unico modo di far girare il gate senza mettere
i nomi del fornitore nel repo pubblico.

- [ ] **Step 4: Run test to verify it passes**

```bash
COLOMBO_DOWNLOAD_PASSWORD='…' pnpm foto:colombo --dry-run --dump /tmp/foto.json
INTEGRATION_DATABASE_URL="$DATABASE_URL" COLOMBO_FOTO_INDEX=/tmp/foto.json \
  pnpm vitest run src/server/maniglie/foto-archivio.integration.test.ts
```
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/foto-archivio.integration.test.ts scripts/foto-colombo.ts
git commit -m "test(maniglie): la guardia che impedisce alla copertura di calare in silenzio"
```

---

### Task 10: Il commento a schema che dice il falso

**Files:**
- Modify: `prisma/schema.prisma:767-770`

**Interfaces:** nessuna.

- [ ] **Step 1: Correggere il commento**

Oggi dice: *«URL su Vercel Blob PUBBLICO (`colombo/<codeNorm>.jpg`), mai byte in
Postgres»*. Tre affermazioni, due false. Sostituire con:

```prisma
  /// CHIAVE su Vercel Blob **privato**, senza suffisso di formato:
  /// `maniglie/colombo/<archivio>/<nome-file>`; i due WebP sono `-320`/`-900`, e i
  /// byte passano sempre da `/api/article-image` (dietro auth: sono foto di un
  /// fornitore, e `public/` è escluso perché il repo è pubblico). Mai byte in
  /// Postgres: le 7.082 foto AGB dentro il DB sono la causa unica dei tre limiti
  /// di piattaforma più caldi. La scrive `pnpm foto:colombo`; NULL = nessuna foto,
  /// che per il 42% dei codici è la normalità.
```

**Nessuna migrazione**: i commenti `///` di Prisma non toccano il database.
Verificarlo: `pnpm prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --exit-code` deve dire che non ci sono differenze.

- [ ] **Step 2: Verificare**

Run: `pnpm typecheck && pnpm prisma generate`
Expected: nessun errore, nessuna migrazione proposta

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "docs(schema): image_url non è un URL pubblico, ed è ora di dirlo"
```

---

### Task 11: Gate completi, browser vero, documenti

- [ ] **Step 1: Gate**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
Expected: tutto verde; i test passano da 1336 a ≥ 1370.

- [ ] **Step 2: Verifica in browser (obbligatoria, mobile E desktop)**

```bash
pnpm dev   # con .env che ha BLOB_READ_WRITE_TOKEN e le foto già caricate
```
Con Playwright ed `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`,
**aspettando il contenuto e non un timer** (il primo giro ritrae lo skeleton):

1. `/maniglie?tipo=FEDRA&fam=AC11R` a **375px**: le otto righe mostrano otto
   miniature, e le finiture diverse mostrano foto diverse;
2. la stessa a desktop;
3. la scheda di `0AC11R-OL`: foto grande, non sgranata;
4. un gruppo scoperto (`?tipo=BOCCHETTA`): segnaposto neutro su tutte le righe,
   **nessun messaggio d'errore**;
5. rete: nessuna richiesta a `/api/article-image` per gli articoli senza foto.

Guardare gli screenshot, non solo contare i verdi.

- [ ] **Step 3: Documenti**

Aggiornare `handoff.md` (sessione, §RIPRENDI DA QUI, azioni ops) e `CLAUDE.md`
(stato). Registrare in `docs/superpowers/kit-assunzioni/` **no** — questo non è
il kit; le domande aperte vanno in `handoff.md` §DA CHIEDERE:
SPIDER/MILLA/TRAMA (quale archivio è quale serie).

- [ ] **Step 4: Commit e push**

```bash
git add -A && git commit -m "docs: chiusura — le foto COLOMBO"
git push -u origin claude/ufptrade-foto-maniglie-a6bc3s
```

---

## Azioni ops (al merge)

🟢 **Nessuna migrazione, nessuna finestra di disservizio.**

1. Secret nuovo su GitHub: `COLOMBO_DOWNLOAD_PASSWORD`.
2. Lanciare **«Ops — Foto COLOMBO»** (`workflow_dispatch`).
3. Verificare in produzione una riga coperta e una scoperta.

L'ordine merge/ops qui è **indifferente**: senza le foto su Blob `image_url` resta
NULL e la UI disegna il segnaposto — cioè esattamente ciò che si vede oggi.
