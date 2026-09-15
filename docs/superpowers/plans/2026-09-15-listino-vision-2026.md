# Listino COLOMBO «Vision 2026» — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** portare a catalogo i 251 articoli nuovi del listino COLOMBO Vision 2026 (edizione 05/26) leggendoli dal PDF, e dichiarare a schermo che il loro prezzo non comprende il *temporary surcharge* del 3,5 %.

**Architecture:** quattro moduli foglia puri (`vision-decode` → `vision-parse` → `vision-codici`, più `composizione-prezzo`), uno script ops additivo che li mette in fila dopo `pdftotext`, e due punti di UI che leggono il prezzo. Nessuna migrazione, nessuna colonna nuova: il discriminante è `surcharge IS NULL`, che oggi è esatto.

**Tech Stack:** TypeScript strict · Vitest · Prisma 6 · Next 15 App Router · tsx · poppler-utils (`pdftotext`).

**Spec:** `docs/superpowers/specs/2026-09-15-listino-vision-2026-design.md`

## Global Constraints

- **Il repo è PUBBLICO.** Prezzi, giacenze e foto del fornitore **non si committano mai**. Le fixture dei test contengono righe **inventate**; i numeri veri stanno solo nel gate d'integrazione, che legge il PDF scaricato a run time.
- **NON TOCCARE IL REPARTO SERRAMENTI** (catalogo AGB, assistente, kit, clienti). Golden invariati: kit 16 righe / 21 pezzi / **90,20 €**, gemello entrata 7,5 **96,29 €**, antieffrazione 17 / 22 / **110,13 €**, bilico **450,03** · **766,51** · **433,46 €**.
- TypeScript **strict**. Tutte le API via **tRPC**. Tutte le query via **Prisma**; nessun raw SQL nuovo.
- UI **in italiano**; codici prodotto in **monospace**. Percentuali con la **virgola** (`3,5 %`), mai col punto.
- Ogni schermata si progetta e si verifica **mobile-first, a ≤ 375px E desktop**, con gli screenshot **guardati**.
- `surcharge` dei nuovi articoli = **`null`**, mai `0`, mai il 3,5 % calcolato.
- Le **19 righe «zirconium HPS/1» restano fuori** dall'import.
- Le due sentinelle della curatela (`curatela.test.ts` «ogni accessorio è un'etichetta che la curatela produce davvero» e `search.integration.test.ts` «ogni accessorio dichiarato esiste fra i gruppi del listino») **non si allentano**.
- Comandi: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`. Prima di `prisma`/`tsx`: `set -a; source .env; set +a`.

## Struttura dei file

| file | responsabilità |
|---|---|
| `src/server/maniglie/vision-decode.ts` | **crea** — testo cifrato → testo in chiaro (shift +29) |
| `src/server/maniglie/vision-parse.ts` | **crea** — testo → blocchi `{modelli, righe}`; bande dichiarate; tre guardie |
| `src/server/maniglie/vision-codici.ts` | **crea** — blocchi → articoli `{code, codeNorm, name, priceList}` |
| `src/server/maniglie/composizione-prezzo.ts` | **crea** — `(priceList, surcharge)` → ramo netto / con maggiorazione |
| `src/server/maniglie/curatela.ts` | **modifica** — `"ROBOT6"` in `divise` |
| `src/app/(dashboard)/maniglie/[id]/articolo-client.tsx` | **modifica** — didascalia del prezzo nei due rami |
| `src/app/(dashboard)/maniglie/maniglie-client.tsx` | **modifica** — marcatore condizionale + legenda |
| `src/server/api/routers/article.ts` | **modifica** — `surcharge` in `ArticleSummary` |
| `scripts/import-vision.ts` | **crea** — `pdftotext` + upsert **additivo** |
| `.github/workflows/ops-neon.yml` | **modifica** — step di import Vision |

---

### Task 1: il decodificatore

**Files:**
- Create: `src/server/maniglie/vision-decode.ts`
- Test: `src/server/maniglie/vision-decode.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: `decodeVision(raw: Buffer): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/maniglie/vision-decode.test.ts
import { describe, it, expect } from "vitest";
import { decodeVision } from "./vision-decode";

describe("decodeVision", () => {
  it("scala di +29 i byte di testo", () => {
    // «9LVLRQ» cifrato vale «Vision»: è la firma con cui si riconosce il file.
    expect(decodeVision(Buffer.from("9LVLRQ", "latin1"))).toBe("Vision");
  });

  it("NON tocca i byte di struttura: \\n, \\f, \\r e lo spazio", () => {
    // Scalare lo spazio lo trasforma in «=» e riempie la pagina di rumore.
    const raw = Buffer.from([0x39, 0x20, 0x0a, 0x0c, 0x0d, 0x4c]); // 9 _ \n \f \r L
    expect(decodeVision(raw)).toBe("V \n\f\ri");
  });

  it("decodifica le CIFRE, che stanno sotto il byte 32", () => {
    // Saltare i byte < 32 perde esattamente le cifre: lo «0» cifrato è \x13.
    // È l'errore che aveva fatto concludere che nel PDF non ci fossero prezzi.
    expect(decodeVision(Buffer.from([0x13, 0x16, 0x0f, 0x15, 0x16]))).toBe("03,25");
  });

  it("torna indietro oltre 255 senza esplodere", () => {
    expect(decodeVision(Buffer.from([0xff]))).toBe(String.fromCharCode(28));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/maniglie/vision-decode.test.ts`
Expected: FAIL — `Failed to resolve import "./vision-decode"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/maniglie/vision-decode.ts
/**
 * Il testo estratto dal listino COLOMBO «Vision 2026» con `pdftotext -layout`
 * arriva cifrato con uno shift costante di **+29 per byte** — lo stesso del
 * catalogo `ER MAN 2026` (`9LVLRQ` → `Vision`).
 *
 * Due byte-classi NON vanno scalate, e sbagliarle è costato due tentativi:
 *
 * 1. **I byte di struttura** (`\n`, `\f`, `\r` e lo spazio 0x20) non sono testo
 *    del PDF: `\f` separa le pagine e lo spazio è la spaziatura che `-layout`
 *    inserisce per ricostruire le colonne. Scalarli trasforma ogni spazio in
 *    «=» e rende illeggibile la pagina.
 * 2. ⚠️ **I byte sotto 32 invece SÌ**: sono esattamente le CIFRE (lo «0» cifrato
 *    è `\x13`). Saltarli fa concludere che il listino non contenga prezzi —
 *    conclusione che è già stata tratta una volta, ed era falsa.
 *
 * Modulo foglia: nessuna dipendenza, nessun accesso a rete o disco.
 */
const STRUTTURA = new Set([0x0a, 0x0c, 0x0d, 0x20]);

export function decodeVision(raw: Buffer): string {
  let out = "";
  for (const b of raw) {
    out += String.fromCharCode(STRUTTURA.has(b) ? b : (b + 29) % 256);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/maniglie/vision-decode.test.ts`
Expected: PASS — 4 test

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/vision-decode.ts src/server/maniglie/vision-decode.test.ts
git commit -m "feat(maniglie): decodificatore del listino Vision 2026 (shift +29)"
```

---

### Task 2: il parser, che si rifiuta invece di indovinare

**Files:**
- Create: `src/server/maniglie/vision-parse.ts`
- Test: `src/server/maniglie/vision-parse.test.ts`

**Interfaces:**
- Consumes: niente (riceve il testo già decodificato).
- Produces:
  - `interface VisionBanda { pagina: number; modelli: string[]; daRiga: number; aRiga: number; daColonna: number; aColonna: number }`
  - `const BANDE_VISION_2026: VisionBanda[]`
  - `interface VisionRiga { finitura: string; prezzo: string }`
  - `interface VisionBlocco { pagina: number; modelli: string[]; righe: VisionRiga[] }`
  - `function parseVision(testo: string, bande: VisionBanda[]): VisionBlocco[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/maniglie/vision-parse.test.ts
import { describe, it, expect } from "vitest";
import { parseVision, type VisionBanda } from "./vision-parse";

/** Pagine finte: `\f` separa, gli indici di riga partono da 0 dentro la pagina. */
function pagine(...pp: string[][]): string {
  return pp.map((righe) => righe.join("\n")).join("\f");
}
const BANDA = (o: Partial<VisionBanda> = {}): VisionBanda => ({
  pagina: 0, modelli: ["XX11 R"], daRiga: 0, aRiga: 20, daColonna: 0, aColonna: 60, ...o,
});

describe("parseVision", () => {
  it("appaia finitura e prezzo sulla stessa riga", () => {
    const t = pagine([
      "XX11 R",
      "oroplus                105,30",
      "cromat                  61,20",
    ]);
    expect(parseVision(t, [BANDA()])).toEqual([
      { pagina: 0, modelli: ["XX11 R"], righe: [
        { finitura: "oroplus", prezzo: "105,30" },
        { finitura: "cromat", prezzo: "61,20" },
      ] },
    ]);
  });

  it("appaia in ORDINE DI LETTURA quando nome e prezzo cadono su righe diverse", () => {
    // Nel documento vero succede nei blocchi alti: il nome sta su una riga e il
    // prezzo due righe sotto, perché `-layout` ricostruisce le colonne.
    const t = pagine([
      "XX11 R",
      "oroplus",
      "cromat",
      "                       105,30",
      "                        61,20",
    ]);
    expect(parseVision(t, [BANDA()])[0]!.righe).toEqual([
      { finitura: "oroplus", prezzo: "105,30" },
      { finitura: "cromat", prezzo: "61,20" },
    ]);
  });

  it("GUARDIA 1 — rifiuta il blocco se i nomi non sono quanti i prezzi", () => {
    const t = pagine(["XX11 R", "oroplus                105,30", "cromat"]);
    expect(() => parseVision(t, [BANDA()])).toThrow(/XX11 R.*2 finiture.*1 prezz/s);
  });

  it("GUARDIA 2 — rifiuta una finitura che non è fra le 13 della legenda", () => {
    const t = pagine(["XX11 R", "fucsia                 105,30"]);
    // «fucsia» non viene riconosciuta: nessun nome, quindi 0 nomi e 1 prezzo.
    expect(() => parseVision(t, [BANDA()])).toThrow(/XX11 R/);
  });

  it("GUARDIA 3 — rifiuta se lo stesso modello ha due prezzi diversi su due pagine", () => {
    // È il caso reale di BT19 BZG: 53,60 a p7 e 53,70 a p12.
    const t = pagine(
      ["ZZ19 BZG", "oromat                  53,60"],
      ["ZZ19 BZG", "oromat                  53,70"],
    );
    const bande = [
      BANDA({ pagina: 0, modelli: ["ZZ19 BZG"] }),
      BANDA({ pagina: 1, modelli: ["ZZ19 BZG"] }),
    ];
    expect(() => parseVision(t, bande)).toThrow(/ZZ19 BZG.*oromat.*53,60.*53,70/s);
  });

  it("accetta lo stesso modello su due pagine se i prezzi coincidono", () => {
    const t = pagine(
      ["ZZ19 BZG", "oromat                  53,60"],
      ["ZZ19 BZG", "oromat                  53,60"],
    );
    const bande = [
      BANDA({ pagina: 0, modelli: ["ZZ19 BZG"] }),
      BANDA({ pagina: 1, modelli: ["ZZ19 BZG"] }),
    ];
    expect(parseVision(t, bande)).toHaveLength(2);
  });

  it("ignora i prezzi FUORI dalla banda di colonna", () => {
    // Nel documento vero la colonna accanto porta i movimenti DK: un prezzo che
    // sconfina è la differenza fra la distinta giusta e una plausibile.
    const t = pagine(["XX11 R", "oroplus      105,30            999,99"]);
    expect(parseVision(t, [BANDA({ aColonna: 30 })])[0]!.righe).toEqual([
      { finitura: "oroplus", prezzo: "105,30" },
    ]);
  });

  it("ignora un prezzo a SINISTRA del nome (è una quota del disegno)", () => {
    const t = pagine(["XX11 R", "  137,5     oroplus            105,30"]);
    expect(parseVision(t, [BANDA()])[0]!.righe).toEqual([
      { finitura: "oroplus", prezzo: "105,30" },
    ]);
  });
});

describe("BANDE_VISION_2026", () => {
  it("copre le otto pagine con prezzi", async () => {
    const { BANDE_VISION_2026 } = await import("./vision-parse");
    // La 13 è la pagina riepilogativa dei nottolini: ripete tre prodotti già
    // stampati sulle pagine 6-8, ed è proprio ciò che dà materia alla guardia 3.
    expect(new Set(BANDE_VISION_2026.map((b) => b.pagina))).toEqual(
      new Set([6, 7, 8, 9, 10, 11, 12, 13]),
    );
    expect(BANDE_VISION_2026).toHaveLength(37);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/maniglie/vision-parse.test.ts`
Expected: FAIL — `Failed to resolve import "./vision-parse"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/maniglie/vision-parse.ts
/**
 * Lettura del listino COLOMBO «Vision 2026» (edizione 05/26) già decodificato.
 *
 * ⚠️ Le BANDE sono **dichiarate**, non dedotte: il layout a due colonne di
 * *questo* documento è un fatto, non una regola generale, e un parser generico
 * ricavato da un solo esemplare sarebbe YAGNI. In cambio il parser **fallisce
 * rumorosamente** se il documento non è quello che crede (le tre guardie sotto):
 * meglio un import che non parte di 251 prezzi plausibili e sbagliati.
 *
 * Modulo puro: nessun accesso a rete, disco o database.
 */

/** Le 13 grafie con cui il listino 05/26 nomina una finitura. Elenco CHIUSO. */
const FINITURE_LISTINO = [
  "zirconium HPS/1", "grafite mat", "umber bronze", "dark green", "silver mat",
  "silvermat", "biancomat", "neromat", "oroplus", "oromat", "cromat", "cromo", "cherry",
] as const;

// Ordine di lunghezza decrescente: «cromat» contiene «cromo»? no, ma «silvermat»
// e «silver mat» sì — col primo che capita si aggancerebbe la grafia sbagliata.
const RX_FINITURA = new RegExp(
  [...FINITURE_LISTINO].sort((a, b) => b.length - a.length).map(esc).join("|"),
  "g",
);
const RX_PREZZO = /\b\d{1,3},\d{2}\b/g;

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Un blocco del documento: dove guardare, e quali modelli condividono la colonna. */
export interface VisionBanda {
  pagina: number;
  /** I modelli che condividono UNA colonna di prezzi (`AM41 R` + `AM41 RY`). */
  modelli: string[];
  daRiga: number;
  aRiga: number;
  daColonna: number;
  aColonna: number;
}

export interface VisionRiga {
  finitura: string;
  /** Come stampato: `105,30`. La conversione a Decimal sta a valle. */
  prezzo: string;
}

export interface VisionBlocco {
  pagina: number;
  modelli: string[];
  righe: VisionRiga[];
}

export function parseVision(testo: string, bande: VisionBanda[]): VisionBlocco[] {
  const pagine = testo.split("\f").map((p) => p.split("\n"));
  const blocchi: VisionBlocco[] = [];

  for (const b of bande) {
    const righe = pagine[b.pagina] ?? [];
    const nomi: { riga: number; col: number; testo: string }[] = [];
    const prezzi: { riga: number; col: number; testo: string }[] = [];

    for (let i = b.daRiga; i <= Math.min(b.aRiga, righe.length - 1); i++) {
      const linea = righe[i]!;
      for (const m of linea.matchAll(RX_FINITURA)) {
        if (m.index >= b.daColonna && m.index <= b.aColonna) {
          nomi.push({ riga: i, col: m.index, testo: m[0] });
        }
      }
      for (const m of linea.matchAll(RX_PREZZO)) {
        if (m.index >= b.daColonna && m.index <= b.aColonna) {
          prezzi.push({ riga: i, col: m.index, testo: m[0] });
        }
      }
    }

    // I prezzi stanno a DESTRA dei nomi: un numero più a sinistra è una quota
    // del disegno tecnico (`137,5`), non un prezzo.
    const colNomi = nomi.length > 0 ? Math.min(...nomi.map((n) => n.col)) : 0;
    const soloDestra = prezzi.filter((p) => p.col > colNomi + 6);

    // GUARDIA 1 — appaiati in ordine di lettura: è ciò che significa il layout a
    // colonne. Se i due elenchi non hanno la stessa lunghezza l'appaiamento
    // sarebbe arbitrario, e un prezzo sulla finitura sbagliata non si vede.
    if (nomi.length !== soloDestra.length) {
      throw new Error(
        `Vision: blocco «${b.modelli.join(" + ")}» (pagina ${b.pagina}): ` +
          `${nomi.length} finiture e ${soloDestra.length} prezzi. ` +
          `Il documento non ha il layout previsto: nessuna riga importata.`,
      );
    }

    const ordina = <T extends { riga: number; col: number }>(xs: T[]): T[] =>
      [...xs].sort((x, y) => x.riga - y.riga || x.col - y.col);

    blocchi.push({
      pagina: b.pagina,
      modelli: b.modelli,
      righe: ordina(nomi).map((n, i) => ({
        finitura: n.testo,
        prezzo: ordina(soloDestra)[i]!.testo,
      })),
    });
  }

  verificaIncrociata(blocchi);
  return blocchi;
}

/**
 * GUARDIA 3 — i prodotti che il listino stampa su DUE pagine devono costare lo
 * stesso. Non è teorica: ha trovato l'unica incoerenza del documento (`BT19 BZG`
 * oromat, due valori diversi a p7 e p12, con 21 prezzi ripetuti su 22 concordi).
 */
function verificaIncrociata(blocchi: VisionBlocco[]): void {
  const visti = new Map<string, { prezzo: string; pagina: number }>();
  for (const b of blocchi) {
    for (const mod of b.modelli) {
      for (const r of b.righe) {
        const k = JSON.stringify([mod, r.finitura]);
        const prima = visti.get(k);
        if (prima && prima.prezzo !== r.prezzo) {
          throw new Error(
            `Vision: «${mod}» in ${r.finitura} costa ${prima.prezzo} a pagina ` +
              `${prima.pagina} e ${r.prezzo} a pagina ${b.pagina}. ` +
              `Il listino si contraddice: nessuna riga importata.`,
          );
        }
        if (!prima) visti.set(k, { prezzo: r.prezzo, pagina: b.pagina });
      }
    }
  }
}

/**
 * Le 37 bande del documento, misurate sul file vero. `pagina` è l'indice dopo
 * lo split su `\f` (la copertina è 0), `daRiga`/`aRiga` sono indici di riga
 * dentro la pagina, `daColonna`/`aColonna` colonne di carattere di `-layout`.
 */
export const BANDE_VISION_2026: VisionBanda[] = [
  { pagina: 6, modelli: ["AM41 R", "AM41 RY"], daRiga: 16, aRiga: 42, daColonna: 40, aColonna: 200 },
  { pagina: 6, modelli: ["AM41 RSB"], daRiga: 43, aRiga: 75, daColonna: 40, aColonna: 130 },
  { pagina: 6, modelli: ["AM42 DK/SM"], daRiga: 43, aRiga: 75, daColonna: 130, aColonna: 230 },
  { pagina: 6, modelli: ["FF13 BB", "FF13 Y"], daRiga: 76, aRiga: 117, daColonna: 40, aColonna: 130 },
  { pagina: 6, modelli: ["AM41 RSM", "AM41 RSMY"], daRiga: 118, aRiga: 146, daColonna: 40, aColonna: 200 },
  { pagina: 6, modelli: ["AM19 BZG"], daRiga: 147, aRiga: 170, daColonna: 40, aColonna: 200 },
  { pagina: 7, modelli: ["ID81 R", "ID81 RY"], daRiga: 16, aRiga: 43, daColonna: 40, aColonna: 200 },
  { pagina: 7, modelli: ["ID81 RSB"], daRiga: 44, aRiga: 77, daColonna: 40, aColonna: 132 },
  { pagina: 7, modelli: ["ID82 DK/SM"], daRiga: 44, aRiga: 77, daColonna: 132, aColonna: 230 },
  { pagina: 7, modelli: ["FF13 BB", "FF13 Y"], daRiga: 78, aRiga: 119, daColonna: 40, aColonna: 132 },
  { pagina: 7, modelli: ["ID81 RSM", "ID81 RSMY"], daRiga: 120, aRiga: 149, daColonna: 40, aColonna: 200 },
  { pagina: 7, modelli: ["FF19 BZG"], daRiga: 150, aRiga: 175, daColonna: 40, aColonna: 200 },
  { pagina: 8, modelli: ["ID91 R", "ID91 RY"], daRiga: 16, aRiga: 43, daColonna: 40, aColonna: 200 },
  { pagina: 8, modelli: ["ID91 RSB"], daRiga: 44, aRiga: 77, daColonna: 40, aColonna: 136 },
  { pagina: 8, modelli: ["ID92 DK/SM"], daRiga: 44, aRiga: 77, daColonna: 136, aColonna: 230 },
  { pagina: 8, modelli: ["BT13 BB", "BT13 Y"], daRiga: 78, aRiga: 120, daColonna: 40, aColonna: 136 },
  { pagina: 8, modelli: ["ID91 RSM", "ID91 RSMY"], daRiga: 121, aRiga: 151, daColonna: 40, aColonna: 200 },
  { pagina: 8, modelli: ["BT19 BZG"], daRiga: 152, aRiga: 175, daColonna: 40, aColonna: 200 },
  { pagina: 9, modelli: ["AM15 R", "AM15 RY"], daRiga: 21, aRiga: 49, daColonna: 40, aColonna: 130 },
  { pagina: 9, modelli: ["AM15 RSB"], daRiga: 50, aRiga: 72, daColonna: 40, aColonna: 130 },
  { pagina: 9, modelli: ["AM15 FISSO"], daRiga: 73, aRiga: 98, daColonna: 40, aColonna: 130 },
  { pagina: 9, modelli: ["AM25 FISSO"], daRiga: 73, aRiga: 98, daColonna: 130, aColonna: 240 },
  { pagina: 9, modelli: ["FF13 BB", "FF13 Y"], daRiga: 99, aRiga: 130, daColonna: 40, aColonna: 130 },
  { pagina: 10, modelli: ["ID45 R", "ID45 RY"], daRiga: 18, aRiga: 46, daColonna: 40, aColonna: 133 },
  { pagina: 10, modelli: ["ID45 RSB"], daRiga: 47, aRiga: 69, daColonna: 40, aColonna: 133 },
  { pagina: 10, modelli: ["ID45 FISSO"], daRiga: 70, aRiga: 89, daColonna: 40, aColonna: 133 },
  { pagina: 10, modelli: ["ID55 FISSO"], daRiga: 70, aRiga: 89, daColonna: 133, aColonna: 240 },
  { pagina: 10, modelli: ["ID13 BB", "ID13 Y"], daRiga: 90, aRiga: 120, daColonna: 50, aColonna: 132 },
  { pagina: 11, modelli: ["AM16"], daRiga: 5, aRiga: 37, daColonna: 90, aColonna: 240 },
  { pagina: 11, modelli: ["ID66"], daRiga: 38, aRiga: 70, daColonna: 90, aColonna: 240 },
  { pagina: 12, modelli: ["AM313/0"], daRiga: 5, aRiga: 40, daColonna: 90, aColonna: 240 },
  { pagina: 12, modelli: ["AM413 Y/0"], daRiga: 41, aRiga: 78, daColonna: 90, aColonna: 240 },
  { pagina: 12, modelli: ["ID713 Q"], daRiga: 79, aRiga: 125, daColonna: 90, aColonna: 240 },
  { pagina: 12, modelli: ["ID813 YQ"], daRiga: 126, aRiga: 160, daColonna: 90, aColonna: 240 },
  { pagina: 13, modelli: ["AM19 BZG"], daRiga: 5, aRiga: 24, daColonna: 40, aColonna: 240 },
  { pagina: 13, modelli: ["FF19 BZG"], daRiga: 25, aRiga: 55, daColonna: 40, aColonna: 240 },
  { pagina: 13, modelli: ["BT19 BZG"], daRiga: 56, aRiga: 95, daColonna: 40, aColonna: 240 },
];
```

⚠️ Le bande di pagina 13 ripetono i tre nottolini già presenti sulle pagine 6-8, e non è una svista: sono la materia della **guardia 3**, cioè ciò che ha scoperto il disaccordo `BT19 BZG` (53,60 contro 53,70). Toglierle spegne la guardia senza che nessun test diventi rosso.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/maniglie/vision-parse.test.ts`
Expected: PASS — 9 test

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/vision-parse.ts src/server/maniglie/vision-parse.test.ts
git commit -m "feat(maniglie): parser del listino Vision 2026, con tre guardie che lo fermano"
```

---

### Task 3: dai blocchi agli articoli — la regola e le sue sei eccezioni

**Files:**
- Create: `src/server/maniglie/vision-codici.ts`
- Test: `src/server/maniglie/vision-codici.test.ts`

**Interfaces:**
- Consumes: `VisionBlocco` (Task 2); `finituraDiTesto`, `FINITURE_PER_CODICE` da `./finiture`; `normalizeArticleCode` da `./code-norm`.
- Produces:
  - `interface VisionArticolo { code: string; codeNorm: string; name: string; priceList: Prisma.Decimal }`
  - `interface VisionEsito { articoli: VisionArticolo[]; esclusi: { modello: string; finitura: string }[] }`
  - `function articoliVision(blocchi: VisionBlocco[]): VisionEsito`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/maniglie/vision-codici.test.ts
import { describe, it, expect } from "vitest";
import { articoliVision } from "./vision-codici";
import type { VisionBlocco } from "./vision-parse";

const blocco = (modelli: string[], righe: [string, string][], pagina = 6): VisionBlocco => ({
  pagina, modelli, righe: righe.map(([finitura, prezzo]) => ({ finitura, prezzo })),
});

describe("articoliVision — la regola", () => {
  it("compone «0» + modello senza separatori + «-» + sigla", () => {
    const { articoli } = articoliVision([blocco(["AM41 R"], [["oroplus", "105,30"]])]);
    expect(articoli[0]!.code).toBe("0AM41R-OL");
    expect(articoli[0]!.codeNorm).toBe("0AM41ROL");
    expect(articoli[0]!.priceList.toString()).toBe("105.3");
  });

  it("toglie anche lo slash dal modello: AM42 DK/SM → 0AM42DKSM", () => {
    const { articoli } = articoliVision([blocco(["AM42 DK/SM"], [["cromat", "52,70"]])]);
    expect(articoli[0]!.code).toBe("0AM42DKSM-CM");
  });

  it("emette una riga per OGNI modello che condivide la colonna", () => {
    const { articoli } = articoliVision([
      blocco(["AM41 R", "AM41 RY"], [["oroplus", "105,30"]]),
    ]);
    expect(articoli.map((a) => a.code)).toEqual(["0AM41R-OL", "0AM41RY-OL"]);
  });
});

describe("articoliVision — le sei eccezioni", () => {
  it.each([
    ["FF13 Y", "0FF13-CM"],       // la Y sparisce
    ["FF13 BB", "0FF13BB-CM"],
    ["BT13 Y", "0BT13-CM"],
    ["BT13 BB", "0BT13BB-CM"],
    ["FF19 BZG", "0FF19BZG6-CM"], // compare un 6
    ["BT19 BZG", "0BT19BZG6-CM"],
  ])("«%s» usa il codice vero del listino, non la regola → %s", (mod, atteso) => {
    const { articoli } = articoliVision([blocco([mod], [["cromat", "10,00"]])]);
    expect(articoli[0]!.code).toBe(atteso);
  });

  it("la regola NUDA darebbe un codice diverso: è questo che l'eccezione evita", () => {
    const { articoli } = articoliVision([blocco(["FF19 BZG"], [["cromat", "41,00"]])]);
    expect(articoli[0]!.code).not.toBe("0FF19BZG-CM");
  });
});

describe("articoliVision — «zirconium HPS/1» resta fuori", () => {
  it("non produce articoli e li elenca fra gli esclusi", () => {
    const { articoli, esclusi } = articoliVision([
      blocco(["AM41 R"], [["oroplus", "105,30"], ["zirconium HPS/1", "115,40"]]),
    ]);
    expect(articoli).toHaveLength(1);
    expect(esclusi).toEqual([{ modello: "AM41 R", finitura: "zirconium HPS/1" }]);
  });

  it("una finitura SCONOSCIUTA invece fa fallire, non si scarta in silenzio", () => {
    expect(() => articoliVision([blocco(["AM41 R"], [["fucsia", "1,00"]])])).toThrow(/fucsia/);
  });
});

describe("articoliVision — le descrizioni", () => {
  it.each([
    [["AM41 R"], 6, "LACONICA AM41R OROPLUS"],
    [["AM42 DK/SM"], 6, "LACONICA AM42DK S/MOV. OROPLUS"],
    [["ID81 R"], 7, "ROBOT6 ID81R OROPLUS"],
    [["ID91 R"], 8, "ROBOT6 S ID91R OROPLUS"],
    [["AM15 FISSO"], 9, "HALO FISSO AM15 OROPLUS"],
    [["ID45 R"], 10, "KUBO ID45R OROPLUS"],
    [["FF13 BB"], 6, "BOCCHETTA F.NORM. FF13 OROPLUS"],
    [["FF13 Y"], 6, "BOCCHETTA Y FF13 OROPLUS"],
    [["AM19 BZG"], 6, "NOTTOLINO AM19BZG OROPLUS"],
    [["AM16"], 11, "MANIGLIONE AM16 OROPLUS"],
    [["AM313/0"], 12, "MANIGLIONE AM313/0 OROPLUS"],
  ])("%s a pagina %i → «%s»", (modelli, pagina, atteso) => {
    const { articoli } = articoliVision([blocco(modelli, [["oroplus", "1,00"]], pagina)]);
    expect(articoli[0]!.name).toBe(atteso);
  });

  it("nessuna descrizione supera i 35 caratteri, il massimo dei 3.456 esistenti", () => {
    const tutti = articoliVision([
      blocco(["AM42 DK/SM"], [["umber bronze", "1,00"]], 6),
      blocco(["FF13 BB"], [["umber bronze", "1,00"]], 6),
      blocco(["ID92 DK/SM"], [["grafite mat", "1,00"]], 8),
    ]).articoli;
    for (const a of tutti) expect(a.name.length).toBeLessThanOrEqual(35);
  });

  it("la prima parola NON è mai «MANIGLIA», che la curatela fonde in MANIGLIA INCASSO", () => {
    // 144 righe finirebbero fra i maniglioni a incasso, e nessun conteggio
    // andrebbe a zero: il difetto sarebbe invisibile.
    const { articoli } = articoliVision([blocco(["AM41 R"], [["oroplus", "1,00"]])]);
    expect(articoli[0]!.name.split(" ")[0]).not.toBe("MANIGLIA");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/maniglie/vision-codici.test.ts`
Expected: FAIL — `Failed to resolve import "./vision-codici"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/maniglie/vision-codici.ts
import { Prisma } from "@prisma/client";
import { normalizeArticleCode } from "./code-norm";
import { finituraDiTesto, FINITURE_PER_CODICE } from "./finiture";
import type { VisionBlocco } from "./vision-parse";

/**
 * Dai blocchi del listino Vision 2026 agli articoli.
 *
 * LA REGOLA — `codice = "0" + designazione senza separatori + "-" + sigla` — è
 * **misurata, non postulata**: la pronta consegna contiene 12 codici scritti da
 * COLOMBO per questi stessi prodotti nuovi (`0AM41RHPS1`, `0ID81RCM`,
 * `0ID45FISSOCM`…) e la regola li riproduce su 10 designazioni su 10.
 *
 * ⚠️ Sui COMPONENTI CONDIVISI, che a listino ci sono già, la regola sbaglia 11
 * volte su 13 — sono pezzi vecchi a cui il 2026 dà una designazione nuova. Lì il
 * codice si **legge**, e le sei voci stanno scritte per esteso qui sotto: anche
 * le due che oggi coincidono con la regola, perché un codice che esiste non deve
 * dipendere da una regola per restare giusto domani. È la stessa disciplina dei
 * 74 codici delle varianti ARTECH, mai concatenati.
 */
const NUCLEO_ECCEZIONE: Record<string, string> = {
  "FF13 BB": "0FF13BB",
  "FF13 Y": "0FF13", //     la «Y» del listino non entra nel codice
  "BT13 BB": "0BT13BB",
  "BT13 Y": "0BT13",
  "FF19 BZG": "0FF19BZG6", // il «6» non è la serie: `BZG6` sta in 12 famiglie
  "BT19 BZG": "0BT19BZG6",
};

/** La serie commerciale per pagina del documento. */
const SERIE: Record<number, string> = {
  6: "LACONICA", 7: "ROBOT6", 8: "ROBOT6 S", 9: "HALO", 10: "KUBO",
};

export interface VisionArticolo {
  code: string;
  codeNorm: string;
  name: string;
  priceList: Prisma.Decimal;
}

export interface VisionEsito {
  articoli: VisionArticolo[];
  /** Le righe «zirconium HPS/1»: la loro coda non è derivabile (vedi sotto). */
  esclusi: { modello: string; finitura: string }[];
}

function nucleo(modello: string): string {
  return NUCLEO_ECCEZIONE[modello] ?? `0${modello.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
}

/**
 * La descrizione, che l'import compone e che `curatela.ts` classifica per PRIMA
 * PAROLA. Si segue la convenzione di COLOMBO misurata sul listino vero: **nome
 * del modello** per maniglie e pomoli (`FEDRA AC11R CROMAT`), **tipo** per i
 * componenti condivisi (`BOCCHETTA Y FF13 CROMAT`, `NOTTOLINO FF19BZG6 CROMAT`).
 *
 * ⚠️ Mai iniziare con «MANIGLIA»: `curatela.ts` la fonde in `MANIGLIA INCASSO`,
 * e 144 righe finirebbero fra i maniglioni a incasso **senza che alcun conteggio
 * vada a zero**.
 *
 * Il nome della finitura si DERIVA da `finiture.ts` (verificato: le 11 sigle in
 * gioco danno esattamente la parola del listino), così non nasce una seconda
 * tabella libera di divergere da quella del filtro colori.
 */
function descrizione(modello: string, pagina: number, sigla: string): string {
  const fin = FINITURE_PER_CODICE.get(sigla)!.nome.toUpperCase();
  const cod = modello.replace(/\s/g, "");
  const fam = modello.split(" ")[0]!;
  const suf = modello.includes(" ") ? modello.slice(fam.length + 1) : "";

  if (suf === "BB") return `BOCCHETTA F.NORM. ${fam} ${fin}`;
  if (suf === "Y") return `BOCCHETTA Y ${fam} ${fin}`;
  if (suf === "BZG") return `NOTTOLINO ${cod} ${fin}`;
  if (pagina === 11 || pagina === 12) return `MANIGLIONE ${cod} ${fin}`;
  if (suf === "FISSO") return `${SERIE[pagina]} FISSO ${fam} ${fin}`;
  if (suf === "DK/SM") return `${SERIE[pagina]} ${fam}DK S/MOV. ${fin}`;
  return `${SERIE[pagina]} ${cod} ${fin}`;
}

export function articoliVision(blocchi: VisionBlocco[]): VisionEsito {
  const articoli: VisionArticolo[] = [];
  const esclusi: { modello: string; finitura: string }[] = [];
  const visti = new Set<string>();

  for (const b of blocchi) {
    for (const r of b.righe) {
      const sigla = finituraDiTesto(r.finitura);

      if (sigla === null) {
        // `finituraDiTesto` riconosce 12 delle 13 grafie del listino. L'unica che
        // rifiuta è «zirconium HPS/1», il cui nome in tabella è «Zirconium
        // Stainless-Steel» — e quelle righe restano comunque fuori, perché la
        // CODA di quella finitura non è derivabile: COLOMBO usa `I1` e `HPS1`
        // nella stessa serie (`0AM42DKSMI1` contro `0AM41RHPS1`).
        // Qualunque ALTRA finitura non riconosciuta è un documento che non
        // capiamo: si ferma, non si scarta in silenzio.
        if (r.finitura !== "zirconium HPS/1") {
          throw new Error(
            `Vision: finitura «${r.finitura}» non riconosciuta (modello ` +
              `${b.modelli.join(" + ")}). Nessuna riga importata.`,
          );
        }
        for (const mod of b.modelli) esclusi.push({ modello: mod, finitura: r.finitura });
        continue;
      }

      for (const mod of b.modelli) {
        const code = `${nucleo(mod)}-${sigla}`;
        // Lo stesso prodotto è stampato su due pagine (i nottolini): la guardia 3
        // del parser ha già provato che i prezzi coincidono, qui si deduplica.
        if (visti.has(code)) continue;
        visti.add(code);
        articoli.push({
          code,
          codeNorm: normalizeArticleCode(code),
          name: descrizione(mod, b.pagina, sigla),
          priceList: new Prisma.Decimal(r.prezzo.replace(",", ".")),
        });
      }
    }
  }
  return { articoli, esclusi };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/maniglie/vision-codici.test.ts`
Expected: PASS — 24 test

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/vision-codici.ts src/server/maniglie/vision-codici.test.ts
git commit -m "feat(maniglie): codici e descrizioni del Vision 2026, con le sei eccezioni lette"
```

---

### Task 4: la composizione del prezzo

**Files:**
- Create: `src/server/maniglie/composizione-prezzo.ts`
- Test: `src/server/maniglie/composizione-prezzo.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: `type ComposizionePrezzo = { kind: "conMaggiorazione"; percento: number } | { kind: "netto" }` e `function composizionePrezzo(priceList: number, surcharge: number | null): ComposizionePrezzo`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/maniglie/composizione-prezzo.test.ts
import { describe, it, expect } from "vitest";
import { composizionePrezzo } from "./composizione-prezzo";

describe("composizionePrezzo", () => {
  it("con surcharge: dichiara la maggiorazione e la sua percentuale", () => {
    expect(composizionePrezzo(104.54, 3.66)).toEqual({ kind: "conMaggiorazione", percento: 3.5 });
  });

  it("con surcharge NULL: il prezzo è netto", () => {
    expect(composizionePrezzo(105.3, null)).toEqual({ kind: "netto" });
  });

  it("la percentuale si DERIVA dal dato, non è la costante 3,5", () => {
    // Se un listino futuro portasse un'aliquota diversa, l'etichetta deve
    // restare vera senza che nessuno la riscriva.
    expect(composizionePrezzo(100, 5)).toEqual({ kind: "conMaggiorazione", percento: 5 });
  });

  it("arrotonda la percentuale a un decimale", () => {
    expect(composizionePrezzo(104.54, 3.66)).toEqual({ kind: "conMaggiorazione", percento: 3.5 });
    expect(composizionePrezzo(3, 0.1)).toEqual({ kind: "conMaggiorazione", percento: 3.3 });
  });

  it("surcharge ZERO non è NULL: è una maggiorazione dichiarata nulla", () => {
    // `articleTotal` li tratta identici (`?? 0`), ma significano cose opposte —
    // `0` AFFERMA l'assenza, `null` la registra come non dichiarata. È la stessa
    // distinzione fra `[]` e `undefined` nel filtro della pronta consegna.
    expect(composizionePrezzo(100, 0)).toEqual({ kind: "conMaggiorazione", percento: 0 });
  });

  it("un priceList a zero non produce NaN né Infinity", () => {
    expect(composizionePrezzo(0, 0)).toEqual({ kind: "netto" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/maniglie/composizione-prezzo.test.ts`
Expected: FAIL — `Failed to resolve import "./composizione-prezzo"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/maniglie/composizione-prezzo.ts
/**
 * COSA CONTIENE il totale di un articolo — non quanto vale, che è `articleTotal`.
 *
 * Serve perché dal listino Vision 2026 il catalogo ha due convenzioni di prezzo
 * insieme: i 3.456 articoli del 02/26 comprendono il *temporary surcharge* del
 * 3,5 %, i 251 del 05/26 no, perché quel documento non lo dichiara. Sotto
 * un'etichetta costante «IVA esclusa» i due numeri si leggono come confrontabili
 * e non lo sono — ed è denaro che dieci agenti pronunciano a un cliente.
 *
 * Il discriminante NON è una colonna nuova: è `surcharge === null`, che oggi è
 * esatto (il 3,5 % è presente su tutte e 3.456 le righe vecchie). Una colonna
 * «edizione» nascerebbe `NULL` su 3.456 righe, cioè la forma della
 * «disponibilità falsa» già rimossa da questo progetto.
 *
 * ⚠️ Il giorno in cui COLOMBO pubblicasse un listino con la maggiorazione su
 * alcune righe e non su altre, il discriminante dovrà diventare l'edizione.
 * Dichiarato ora, costruito allora.
 *
 * La percentuale si **deriva** dai due numeri: mai una seconda costante 3,5 nel
 * codice, o il giorno di un'aliquota diversa l'etichetta mentirebbe.
 *
 * Modulo foglia: nessuna dipendenza.
 */
export type ComposizionePrezzo =
  | { kind: "conMaggiorazione"; percento: number }
  | { kind: "netto" };

export function composizionePrezzo(
  priceList: number,
  surcharge: number | null,
): ComposizionePrezzo {
  if (surcharge === null) return { kind: "netto" };
  // Un listino a zero non esiste, ma dividerci produrrebbe NaN o Infinity in
  // un'etichetta mostrata a schermo.
  if (priceList === 0) return { kind: "netto" };
  return { kind: "conMaggiorazione", percento: Math.round((surcharge / priceList) * 1000) / 10 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/maniglie/composizione-prezzo.test.ts`
Expected: PASS — 6 test

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/composizione-prezzo.ts src/server/maniglie/composizione-prezzo.test.ts
git commit -m "feat(maniglie): composizionePrezzo — cosa contiene il totale, non quanto vale"
```

---

### Task 5: `ROBOT6 S` non deve collassare in `ROBOT6`

**Files:**
- Modify: `src/server/maniglie/curatela.ts:140`
- Test: `src/server/maniglie/curatela.test.ts`

**Interfaces:**
- Consumes: `browseLabel(brand, name)` (esistente).
- Produces: niente di nuovo — cambia solo il comportamento di `browseLabel` su `ROBOT6 S …`.

- [ ] **Step 1: Write the failing test**

```ts
// aggiungere in src/server/maniglie/curatela.test.ts, dentro il describe di browseLabel
it("ROBOT6 S è un prodotto diverso da ROBOT6, come ROBOCINQUE S", () => {
  // `firstWord` prende il primo token: senza `divise`, le 36 righe del Robot6 S
  // finirebbero dentro ROBOT6 e il gruppo mostrerebbe due modelli come uno.
  expect(browseLabel("COLOMBO", "ROBOT6 S ID91R OROMAT")).toBe("ROBOT6 S");
  expect(browseLabel("COLOMBO", "ROBOT6 ID81R OROPLUS")).toBe("ROBOT6");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/maniglie/curatela.test.ts`
Expected: FAIL — `expected 'ROBOT6' to be 'ROBOT6 S'`

- [ ] **Step 3: Write minimal implementation**

In `src/server/maniglie/curatela.ts`, riga 140, aggiungere `"ROBOT6"` all'insieme:

```ts
    divise: new Set(["ROBOCINQUE", "ROBOQUATTRO", "ROBOT6"]),
```

`MARCATORE_S` (`/^S'?$|^S'/`) riconosce già la `S` nuda: nessuna macchina nuova.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/maniglie/curatela.test.ts`
Expected: PASS — l'intero file, sentinelle degli accessori comprese

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/curatela.ts src/server/maniglie/curatela.test.ts
git commit -m "fix(maniglie): ROBOT6 S è una voce propria, come ROBOCINQUE S"
```

---

### Task 6: la scheda articolo dichiara cosa contiene il prezzo

**Files:**
- Modify: `src/app/(dashboard)/maniglie/[id]/articolo-client.tsx:45-50`
- Test: `src/app/(dashboard)/maniglie/[id]/articolo-client.test.tsx`

**Interfaces:**
- Consumes: `composizionePrezzo` (Task 4). Il router restituisce già `priceList` e `surcharge` (`article.ts:425-427`): nessuna modifica di API.
- Produces: niente.

- [ ] **Step 1: Write the failing test**

```tsx
// aggiungere in src/app/(dashboard)/maniglie/[id]/articolo-client.test.tsx
it("dichiara la maggiorazione quando il prezzo la comprende", () => {
  render(<ArticoloClient id="x" />); // fixture: priceList 46.68, surcharge 1.63
  expect(screen.getByText(/include magg\. temporanea 3,5 %/)).toBeInTheDocument();
});

it("dichiara l'ASSENZA quando il listino non la porta — non tace", () => {
  // Un'etichetta che compare solo sull'anomalia insegna «niente etichetta =
  // tutto regolare», e il giorno di una terza convenzione il silenzio mente.
  vi.mocked(api.article.byId.useQuery).mockReturnValue(
    query({ data: { ...articolo, priceList: 105.3, surcharge: null, total: 105.3 } }),
  );
  render(<ArticoloClient id="x" />);
  expect(screen.getByText(/nessuna maggiorazione dichiarata/)).toBeInTheDocument();
});

it("la percentuale si scrive con la VIRGOLA, non col punto", () => {
  // Il «42.5%» col punto in una UI italiana è già costato uno screenshot.
  render(<ArticoloClient id="x" />);
  expect(screen.queryByText(/3\.5 ?%/)).not.toBeInTheDocument();
});
```

⚠️ Allineare il mock al meccanismo già usato nel file (`query(...)` e il mock di tRPC esistente); leggere le prime 35 righe del test prima di scrivere.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run "src/app/(dashboard)/maniglie/[id]/articolo-client.test.tsx"`
Expected: FAIL — `Unable to find an element with the text: /include magg. temporanea 3,5 %/`

- [ ] **Step 3: Write minimal implementation**

Sostituire il blocco del prezzo (`articolo-client.tsx:45-50`):

```tsx
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-[27px] font-bold tabular-nums leading-tight text-ink">
              {formatPrice(a.total)}
            </span>
            {/* La didascalia non è più una costante: dice COSA CONTIENE il numero.
                Dal listino 05/26 il catalogo ha due convenzioni insieme, e sotto
                un'etichetta unica si leggono come confrontabili. Si dichiarano
                ENTRAMBI i rami: un'etichetta solo sull'anomalia insegnerebbe che
                il silenzio significa «tutto regolare». */}
            <span className="text-xs text-ink-subtle">{didascalia(a.priceList, a.surcharge)}</span>
          </p>
```

e aggiungere, sopra il componente:

```tsx
import { composizionePrezzo } from "~/server/maniglie/composizione-prezzo";

/** Le percentuali in una UI italiana si scrivono con la virgola. */
function didascalia(priceList: number, surcharge: number | null): string {
  const c = composizionePrezzo(priceList, surcharge);
  return c.kind === "conMaggiorazione"
    ? `IVA esclusa · include magg. temporanea ${String(c.percento).replace(".", ",")} %`
    : "IVA esclusa · nessuna maggiorazione dichiarata";
}
```

⚠️ `composizione-prezzo.ts` è un modulo **foglia senza `server-only`**: importabile da un client component, come `finiture.ts` e `taxonomy.ts`. Verificare che il file non contenga `import "server-only"` prima di importarlo.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run "src/app/(dashboard)/maniglie/[id]/articolo-client.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/maniglie/[id]/articolo-client.tsx" "src/app/(dashboard)/maniglie/[id]/articolo-client.test.tsx"
git commit -m "feat(maniglie): la scheda dichiara cosa contiene il prezzo, in entrambi i rami"
```

---

### Task 7: il marcatore condizionale in elenco

**Files:**
- Modify: `src/server/api/routers/article.ts:66-84` (`toSummary`)
- Modify: `src/app/(dashboard)/maniglie/maniglie-client.tsx:452-479` (`ArticoloRow`) e il punto in cui si rende l'elenco
- Test: `src/app/(dashboard)/maniglie/maniglie-client.test.tsx`

**Interfaces:**
- Consumes: `composizionePrezzo` (Task 4).
- Produces: `ArticleSummary` guadagna `surcharge: number | null`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/(dashboard)/maniglie/maniglie-client.test.tsx
it("NON marca nulla se tutte le righe hanno la stessa convenzione", () => {
  // 157 righe nuove su 251 stanno in gruppi interamente 05/26: lì il marcatore
  // non ha nulla da distinguere, e sarebbe rumore.
  renderElenco([riga({ surcharge: null }), riga({ surcharge: null })]);
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
});

it("marca le righe nette SOLO quando l'elenco contiene entrambe le convenzioni", () => {
  renderElenco([riga({ surcharge: 1.63 }), riga({ code: "0AM41R-OL", surcharge: null })]);
  const legenda = screen.getByRole("note");
  expect(legenda).toHaveTextContent(/senza magg\. temporanea/i);
  expect(screen.getAllByTitle(/senza magg/i)).toHaveLength(1);
});

it("il marcatore è legato alla legenda per chi usa uno screen reader", () => {
  renderElenco([riga({ surcharge: 1.63 }), riga({ code: "0AM41R-OL", surcharge: null })]);
  const marcatore = screen.getByTitle(/senza magg/i);
  expect(marcatore.getAttribute("aria-describedby")).toBe(screen.getByRole("note").id);
});
```

⚠️ `renderElenco` e `riga` sono helper locali da scrivere sul modello di quelli già presenti nel file di test; leggerlo prima. Se il file non esiste, crearlo con il mock di tRPC già usato in `articolo-client.test.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"`
Expected: FAIL — `Unable to find an accessible element with the role "note"`

- [ ] **Step 3: Write minimal implementation**

In `src/server/api/routers/article.ts`, dentro `toSummary`, aggiungere accanto a `total`:

```ts
    /** Serve a dichiarare COSA contiene `total`: dal listino 05/26 il catalogo
        ha due convenzioni insieme. `null` = prezzo netto, nessuna maggiorazione
        dichiarata dal listino. */
    surcharge: a.surcharge === null ? null : a.surcharge.toNumber(),
```

In `maniglie-client.tsx`, `ArticoloRow` riceve una prop nuova e marca il prezzo:

```tsx
function ArticoloRow({ articolo, marca, legendaId }: {
  articolo: ArticleSummary; marca: boolean; legendaId: string;
}) {
  // …invariato fino al prezzo…
      <span className="text-sm font-semibold tabular-nums text-ink sm:justify-self-end">
        {formatPrice(articolo.total)}
        {marca && composizionePrezzo(articolo.priceList ?? 0, articolo.surcharge).kind === "netto" && (
          <span
            title="Prezzo senza magg. temporanea"
            aria-describedby={legendaId}
            className="ml-0.5 align-super text-[10px] font-normal text-ink-subtle"
          >
            †
          </span>
        )}
      </span>
```

e nel componente che rende la lista, prima delle righe:

```tsx
  // Il marcatore compare SOLO se l'elenco visibile contiene entrambe le
  // convenzioni: dove non c'è nulla con cui confondersi sarebbe rumore, e si
  // autoestingue quando il listino torna omogeneo. Neutro, mai rosso: quel
  // prezzo non è inaffidabile, è affidabile quanto il documento.
  const misto =
    articoli.some((a) => a.surcharge === null) && articoli.some((a) => a.surcharge !== null);
  const legendaId = "legenda-prezzi";
```

```tsx
  {misto && (
    <p role="note" id={legendaId} className="px-3 pb-2 text-xs text-ink-subtle sm:px-4">
      † prezzo senza magg. temporanea: il listino di quell'articolo non la dichiara.
    </p>
  )}
```

⚠️ `ArticoloRow` oggi non riceve `priceList`. Due strade: aggiungerlo a `toSummary` accanto a `surcharge`, **oppure** — più semplice e sufficiente — marcare in base al solo `surcharge === null`, senza chiamare `composizionePrezzo` in riga. **Preferire la seconda**: in elenco la distinzione binaria basta, e `composizionePrezzo` resta il posto unico per il *testo*. In quel caso la condizione è `marca && articolo.surcharge === null` e non serve toccare `priceList`.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"`
Expected: PASS — 3 test

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/article.ts "src/app/(dashboard)/maniglie/maniglie-client.tsx" "src/app/(dashboard)/maniglie/maniglie-client.test.tsx"
git commit -m "feat(maniglie): marcatore condizionale sui prezzi senza maggiorazione"
```

---

### Task 8: lo script di import, che AGGIUNGE e non sostituisce

**Files:**
- Create: `scripts/import-vision.ts`
- Modify: `package.json` (script `import:vision`)

**Interfaces:**
- Consumes: `decodeVision` (1), `parseVision` + `BANDE_VISION_2026` (2), `articoliVision` (3).
- Produces: il comando `pnpm import:vision COLOMBO <file.pdf>`.

- [ ] **Step 1: Write the failing test**

Questo task non ha un test unitario proprio: la logica pura è già coperta dai task 1-3, e ciò che resta è I/O. Il gate è il **Task 9** (integrazione sul file vero). Scrivere prima il test del Task 9, verificarlo rosso, poi implementare qui.

- [ ] **Step 2: Write the script**

```ts
// scripts/import-vision.ts
/**
 * Import del listino COLOMBO «Vision 2026» (edizione 05/26).
 *
 *   pnpm import:vision COLOMBO ./vision.pdf
 *
 * ⚠️ È un'AGGIUNTA, non una sostituzione, e la differenza è una SOTTRAZIONE.
 * `import:listino` significa «questo file È il listino»: riscrive
 * `lastListingAt` e poi stampa «N articoli NON erano in questo listino». Su un
 * delta quella riga direbbe che 3.456 articoli non sono più a listino — falso,
 * ed è proprio la riga che l'operatore legge per capire se è andata bene.
 *
 * Qui `lastListingAt` si scrive lo stesso (quelle righe SONO in un listino), ma
 * il conteggio degli assenti **non si calcola affatto**: un delta non è in
 * condizione di sapere cosa sia stato ritirato.
 *
 * Script separato e non un flag: la semantica sbagliata non dev'essere
 * raggiungibile per distrazione.
 */
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decodeVision } from "../src/server/maniglie/vision-decode";
import { parseVision, BANDE_VISION_2026 } from "../src/server/maniglie/vision-parse";
import { articoliVision } from "../src/server/maniglie/vision-codici";

const prisma = new PrismaClient();

async function main() {
  const [brandArg, filePath] = process.argv.slice(2);
  if (!brandArg || !filePath) {
    console.error("Uso: pnpm import:vision <MARCA> <file.pdf>");
    process.exit(1);
  }
  const brand = brandArg.toUpperCase();
  console.log(`▶ Listino Vision 2026 ${brand} — ${filePath}`);

  // `-layout` ricostruisce le colonne con la spaziatura: le bande dichiarate in
  // `vision-parse` sono colonne di QUEL testo. Senza `-layout` non combaciano.
  const raw = execFileSync("pdftotext", ["-layout", filePath, "-"], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: "buffer",
  });
  const testo = decodeVision(raw);
  if (!testo.includes("Vision")) {
    console.error("✗ Il file non è il listino Vision 2026 (firma «Vision» assente).");
    process.exit(1);
  }

  const { articoli, esclusi } = articoliVision(parseVision(testo, BANDE_VISION_2026));
  console.log(`  ${articoli.length} articoli letti · ${esclusi.length} righe escluse`);
  if (esclusi.length > 0) {
    const modelli = [...new Set(esclusi.map((e) => e.modello))];
    console.log(
      `  ⚠ «zirconium HPS/1» esclusa su ${modelli.length} modelli: COLOMBO usa ` +
        `due code (I1 e HPS1) e non è derivabile. Entrano quando risponde.`,
    );
  }

  const now = new Date();
  let creati = 0;
  let aggiornati = 0;
  for (const a of articoli) {
    const res = await prisma.article.upsert({
      where: { brand_code: { brand, code: a.code } },
      // `surcharge` NON compare: resta `null` sui nuovi, ed è l'unico valore che
      // non afferma un sovrapprezzo che il documento non dichiara. Mai `0`: in
      // `articleTotal` darebbe lo stesso totale, ma AFFERMA l'assenza e cancella
      // il discriminante `surcharge IS NULL` che ritrova queste righe.
      // `catalogPage` e `imageUrl` non si toccano: sono lo strato del catalogo.
      update: { name: a.name, priceList: a.priceList, lastListingAt: now },
      create: {
        brand,
        code: a.code,
        codeNorm: a.codeNorm,
        name: a.name,
        priceList: a.priceList,
        lastListingAt: now,
      },
      select: { createdAt: true, updatedAt: true },
    });
    if (res.createdAt.getTime() === res.updatedAt.getTime()) creati++;
    else aggiornati++;
  }

  console.log(`✓ ${articoli.length} articoli — ${creati} nuovi, ${aggiornati} aggiornati`);
  console.log(
    `  ${articoli.length} importati SENZA temporary surcharge: il listino 05/26 non lo dichiara.`,
  );
  // NIENTE conteggio degli «assenti»: è un delta (vedi il commento in testa).
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

In `package.json`, accanto a `import:listino`:

```json
    "import:vision": "tsx --env-file-if-exists=.env scripts/import-vision.ts",
```

- [ ] **Step 3: Run it against the real file**

```bash
set -a; source .env; set +a
corepack pnpm import:vision COLOMBO /percorso/vision2026.pdf
```

Expected:
```
▶ Listino Vision 2026 COLOMBO — …
  251 articoli letti · 19 righe escluse
  ⚠ «zirconium HPS/1» esclusa su 19 modelli: …
✓ 251 articoli — 234 nuovi, 17 aggiornati
  251 importati SENZA temporary surcharge: il listino 05/26 non lo dichiara.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/import-vision.ts package.json
git commit -m "feat(maniglie): import:vision — un'aggiunta, non una sostituzione"
```

---

### Task 9: il gate sul file vero

**Files:**
- Create: `src/server/maniglie/vision.integration.test.ts`

**Interfaces:**
- Consumes: tutti i moduli 1-3.
- Produces: niente.

Il test è **gated** come gli altri: gira solo se `VISION_PDF` punta al PDF vero. Così i numeri reali non entrano nel repo e la CI resta verde senza il file.

- [ ] **Step 1: Write the test**

```ts
// src/server/maniglie/vision.integration.test.ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { decodeVision } from "./vision-decode";
import { parseVision, BANDE_VISION_2026 } from "./vision-parse";
import { articoliVision } from "./vision-codici";

const pdf = process.env.VISION_PDF;

/**
 * Gate sul documento VERO. I numeri stanno qui e non nelle fixture perché il
 * repo è pubblico e sono il listino di un fornitore: questo file gira solo con
 * `VISION_PDF` valorizzato, e in CI resta saltato.
 */
describe.skipIf(!pdf)("listino Vision 2026 — documento reale", () => {
  const blocchi = () => {
    const raw = execFileSync("pdftotext", ["-layout", pdf!, "-"], {
      maxBuffer: 64 * 1024 * 1024, encoding: "buffer",
    });
    return parseVision(decodeVision(raw), BANDE_VISION_2026);
  };

  it("le tre guardie passano su tutte e 37 le bande", () => {
    expect(blocchi()).toHaveLength(37);
  });

  it("produce 251 articoli e 19 esclusi", () => {
    const { articoli, esclusi } = articoliVision(blocchi());
    expect(articoli).toHaveLength(251);
    expect(esclusi).toHaveLength(19);
    expect(new Set(esclusi.map((e) => e.finitura))).toEqual(new Set(["zirconium HPS/1"]));
  });

  it("i codici confermati da COLOMBO nella pronta consegna ci sono tutti", () => {
    // Sono i 12 «orfani»: codici che COLOMBO ha già scritto per questi prodotti.
    // Quattro dei dodici sono HPS/1 e restano fuori (`0AM15FISSOI1`,
    // `0AM25FISSOI1`, `0AM41RHPS1`, `0AM42DKSMI1`); questi otto no.
    const norm = new Set(articoliVision(blocchi()).articoli.map((a) => a.codeNorm));
    for (const c of ["0ID45FISSOCM", "0ID55FISSOCM", "0ID81RCM", "0ID81ROM",
                     "0ID82DKSMCM", "0ID82DKSMOM", "0ID91RCM", "0ID92DKSMCM"]) {
      expect(norm).toContain(c);
    }
  });

  it("nessuna descrizione inizia con MANIGLIA, e nessuna supera i 35 caratteri", () => {
    for (const a of articoliVision(blocchi()).articoli) {
      expect(a.name.split(" ")[0]).not.toBe("MANIGLIA");
      expect(a.name.length).toBeLessThanOrEqual(35);
    }
  });

  it("nessun codice si ripete", () => {
    const codici = articoliVision(blocchi()).articoli.map((a) => a.code);
    expect(new Set(codici).size).toBe(codici.length);
  });
});
```

- [ ] **Step 2: Run it with the real file**

```bash
VISION_PDF=/percorso/vision2026.pdf corepack pnpm vitest run src/server/maniglie/vision.integration.test.ts
```
Expected: 5 test PASS.

- [ ] **Step 3: Prove it can go red**

Cambiare a mano una banda (`aColonna: 200` → `aColonna: 100` sulla prima) e rilanciare: deve fallire con il messaggio della guardia 1, non passare. Ripristinare.

- [ ] **Step 4: Commit**

```bash
git add src/server/maniglie/vision.integration.test.ts
git commit -m "test(maniglie): gate del Vision 2026 sul documento reale"
```

---

### Task 10: lo step ops

**Files:**
- Modify: `.github/workflows/ops-neon.yml`

**Interfaces:**
- Consumes: `pnpm import:vision` (Task 8).
- Produces: niente.

- [ ] **Step 1: Add the input**

Sotto `listino_colombo_url`:

```yaml
      vision_url:
        description: "URL diretto del listino COLOMBO Vision 2026 PDF. Vuoto = salta l'import."
        required: false
        default: "https://drive.usercontent.google.com/download?id=1BO66H81J3-JlOh8vl4htwX_rHl93B1mM&export=download&confirm=t"
```

- [ ] **Step 2: Add the step**

**Dopo** lo step «Import listino COLOMBO»: è un delta e presuppone la base.

```yaml
      # Delta del listino 05/26: AGGIUNGE i prodotti nuovi (Laconica, Robot6,
      # Robot6 S, Halo, Kubo e complementi) senza dichiarare che il resto non è
      # più a listino. Sta DOPO l'import COLOMBO perché presuppone la base.
      - name: Import listino Vision 2026 (reparto maniglie)
        if: ${{ github.event.inputs.vision_url != '' }}
        env:
          VISION_URL: ${{ github.event.inputs.vision_url }}
        run: |
          curl -sSL "$VISION_URL" -o vision.pdf
          # La pipeline esistente controlla 'PK' perché importa xlsx: un PDF
          # fallirebbe lì. Questo è un PDF, e la guardia è la sua.
          head -c 5 vision.pdf | grep -q '%PDF' || { echo "::error::Il download non è un PDF valido"; exit 1; }
          echo "PDF scaricato: $(wc -c < vision.pdf) byte, $(pdfinfo vision.pdf | awk '/Pages/{print $2}') pagine"
          pnpm import:vision COLOMBO vision.pdf
```

⚠️ `poppler-utils` è già installato dallo step esistente «Install poppler-utils» (riga 34): non duplicarlo.

- [ ] **Step 3: Verify the YAML parses**

Run: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/ops-neon.yml')); print(len(d['jobs']['ops']['steps']), 'step')"`
Expected: un numero, nessuna eccezione.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ops-neon.yml
git commit -m "ops: step di import del listino Vision 2026"
```

---

### Task 11: le foto dei nuovi, già in archivio

**Files:**
- Modify: `src/server/maniglie/foto-archivio.ts`
- Test: `src/server/maniglie/foto-archivio.test.ts`

**Interfaces:**
- Consumes: `ARCHIVI` (esistente).
- Produces: niente di nuovo.

- [ ] **Step 1: Write the failing test**

```ts
// aggiungere in src/server/maniglie/foto-archivio.test.ts
it("i cinque archivi dei prodotti 2026 hanno un'etichetta: ora sono a listino", () => {
  // Erano `null` con il commento «prodotti nuovi: a catalogo 2026, non ancora a
  // listino». Il listino 05/26 li porta, quindi le foto si agganciano.
  for (const [archivio, etichetta] of [
    ["00a_Laconica", "LACONICA"], ["00b_Robot6", "ROBOT6"],
    ["00c_Robot6S", "ROBOT6 S"], ["00d_Halo", "HALO"], ["00e_Kubo", "KUBO"],
  ] as const) {
    expect(ARCHIVI[archivio]?.etichetta).toBe(etichetta);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/maniglie/foto-archivio.test.ts`
Expected: FAIL — `expected null to be 'LACONICA'`

- [ ] **Step 3: Write minimal implementation**

In `ARCHIVI`, sostituire `etichetta: null` con l'etichetta, per i cinque archivi, e **aggiornare il commento** che dice «non ancora a listino» — è diventato falso.

⚠️ Leggere prima la forma esatta delle voci `ARCHIVI` e di `soloCopertina`: se l'archivio deve solo **nominare** il gruppo senza prestare foto ai codici, il flag è quello, non `etichetta: null`.

- [ ] **Step 4: Run the whole suite**

Run: `corepack pnpm test`
Expected: tutti verdi, **sentinelle della curatela comprese**.

- [ ] **Step 5: Commit**

```bash
git add src/server/maniglie/foto-archivio.ts src/server/maniglie/foto-archivio.test.ts
git commit -m "feat(maniglie): i cinque archivi 2026 hanno un'etichetta, le foto si agganciano"
```

---

### Task 12: gate finale e verifica browser

- [ ] **Step 1: I quattro gate**

```bash
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build
```
Expected: tutti verdi. ⚠️ **Non lanciare `build` mentre gira `dev`**: condividono `.next` e il dev server serve 404 su tutti i chunk. Dopo la build, `rm -rf .next`.

- [ ] **Step 2: Il reparto serramenti non si è mosso**

```bash
corepack pnpm vitest run src/server/kit
```
Expected: golden invariati — **16 righe / 21 pezzi / 90,20 €**, gemello **96,29 €**, antieffrazione **17 / 22 / 110,13 €**, bilico **450,03 · 766,51 · 433,46 €**.

- [ ] **Step 3: Il gate d'integrazione**

```bash
VISION_PDF=/percorso/vision2026.pdf corepack pnpm vitest run src/server/maniglie/vision.integration.test.ts
INTEGRATION_DATABASE_URL="$DATABASE_URL" corepack pnpm vitest run src/server/maniglie/search.integration.test.ts
```
Expected: entrambi verdi.

- [ ] **Step 4: Verifica browser, desktop E 375px**

Con il DB vero, listino + Vision importati. Da controllare, **guardando gli screenshot**:

1. la scheda di `0AM41R-OL` dice «nessuna maggiorazione dichiarata»;
2. la scheda di un articolo 02/26 dice «include magg. temporanea 3,5 %»;
3. nello sfoglio, il gruppo **LACONICA** esiste e **non** mostra il marcatore (righe tutte 05/26);
4. nel gruppo **BOCCHETTA** il marcatore compare **e** la legenda è presente;
5. **ROBOT6** e **ROBOT6 S** sono due voci distinte;
6. a 375px nulla scorre in orizzontale e la didascalia va a capo invece di troncarsi.

⚠️ Gli script di verifica **mentono**: scopare i selettori alla sezione (`section[aria-labelledby='sfoglia-titolo']`) — `ul.grid` prende anche il filtro finitura e `details summary` anche il filtro colori. È già successo quattro volte.

- [ ] **Step 5: Aggiornare la documentazione**

`handoff.md` (§RIPRENDI DA QUI) e `CLAUDE.md` (§STATO). Aggiungere a `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md` le cinque domande della §9 dello spec.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: stato del listino Vision 2026 e le cinque domande aperte"
```

---

## Self-review

**Copertura dello spec**

| § dello spec | task |
|---|---|
| §2 la regola e le eccezioni | 3 |
| §2.3 HPS/1 fuori | 3, 9 |
| §3 cosa si importa | 8, 9 |
| §3.1 prezzo e `surcharge` NULL | 8 (scrittura), 4 (lettura) |
| §3.2 dichiarazione del prezzo | 4, 6, 7 |
| §3.3 descrizioni e `divise` | 3, 5 |
| §3.4 EAN assente | 8 (non si scrive) |
| §4 import additivo | 8 |
| §5 moduli | 1, 2, 3, 4, 8 |
| §5.1 le tre guardie | 2 |
| §6 `finiture.ts` non si tocca | 3 (riuso di `finituraDiTesto`) |
| §7 ops | 10, 11 |
| §8 sentinelle | 2, 3, 4, 5, 9 |

**Rischi noti, dichiarati**

- Le bande del Task 2 sono misurate sul file scaricato il 2026-09-15. Se COLOMBO ripubblica il PDF con un impaginato diverso, la guardia 1 ferma l'import: è il comportamento voluto, ma va ri-misurato.
- Il Task 7 tocca un file client grande (`maniglie-client.tsx`): leggere il punto d'inserimento prima di scrivere, non fidarsi dei numeri di riga di questo piano.
- I Task 6 e 7 hanno una forma di UI che **`/impeccable` può cambiare**: il testo e il glifo qui sono una base, non un verdetto.
