import { describe, it, expect } from "vitest";
import { parseVision, BANDE_VISION_2026, type VisionBanda } from "./vision-parse";

/** Pagine finte: `\f` separa, gli indici di riga partono da 0 dentro la pagina. */
function pagine(...pp: string[][]): string {
  return pp.map((righe) => righe.join("\n")).join("\f");
}
const BANDA = (o: Partial<VisionBanda> = {}): VisionBanda => ({
  pagina: 0,
  modelli: ["XX11 R"],
  daRiga: 0,
  aRiga: 20,
  daColonna: 0,
  aColonna: 60,
  ...o,
});

describe("parseVision", () => {
  it("appaia finitura e prezzo sulla stessa riga", () => {
    const t = pagine(["XX11 R", "oroplus                105,30", "cromat                  61,20"]);
    expect(parseVision(t, [BANDA()])).toEqual([
      {
        pagina: 0,
        modelli: ["XX11 R"],
        righe: [
          { finitura: "oroplus", prezzo: "105,30" },
          { finitura: "cromat", prezzo: "61,20" },
        ],
      },
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

  it("GUARDIA 2 — una finitura fuori legenda non si scarta: sbilancia e ferma", () => {
    const t = pagine(["XX11 R", "fucsia                 105,30"]);
    // «fucsia» non è fra le 13: 0 nomi contro 1 prezzo, quindi il blocco cade.
    expect(() => parseVision(t, [BANDA()])).toThrow(/XX11 R/);
  });

  it("GUARDIA 3 — rifiuta se lo stesso modello ha due prezzi diversi su due pagine", () => {
    const t = pagine(
      ["ZZ19 BZG", "oromat                  53,60"],
      ["ZZ19 BZG", "oromat                  53,70"],
    );
    const bande = [
      BANDA({ pagina: 0, modelli: ["ZZ19 BZG"] }),
      BANDA({ pagina: 1, modelli: ["ZZ19 BZG"] }),
    ];
    expect(() => parseVision(t, bande)).toThrow(/ZZ19 BZG.*oromat.*due prezzi diversi/s);
  });

  it("il disaccordo DICHIARATO passa, e vince la PAGINA PIÙ BASSA", () => {
    // BT19 BZG in oromat è l'unico disaccordo del documento vero. La regola non
    // è un valore scritto a mano — che resterebbe tale anche quando l'edizione
    // successiva cambia il prezzo su entrambe le pagine — ma «vince la pagina
    // del prodotto», che viene prima del riepilogo in coda al documento.
    // Le bande sono dichiarate in ordine INVERSO apposta: il risultato non deve
    // dipendere da quello.
    const t = pagine(["ZZ", "oromat                  11,11"], ["ZZ", "oromat                  22,22"]);
    const bande = [
      BANDA({ pagina: 1, modelli: ["BT19 BZG"] }),
      BANDA({ pagina: 0, modelli: ["BT19 BZG"] }),
    ];
    const out = parseVision(t, bande);
    expect(out.map((b) => b.righe[0]!.prezzo)).toEqual(["11,11", "11,11"]);
  });

  it("una deroga che non serve più fa fallire: non resta lì a coprire il prossimo", () => {
    const t = pagine(["ZZ", "oromat                  11,11"], ["ZZ", "oromat                  11,11"]);
    const bande = [
      BANDA({ pagina: 0, modelli: ["BT19 BZG"] }),
      BANDA({ pagina: 1, modelli: ["BT19 BZG"] }),
    ];
    expect(() => parseVision(t, bande)).toThrow(/deroga è diventata morta/);
  });

  it("un disaccordo NON dichiarato continua a fermare tutto", () => {
    // La dichiarazione vale per una coppia modello+finitura, non per il modello.
    const t = pagine(
      ["BT19 BZG", "cromat                  46,60"],
      ["BT19 BZG", "cromat                  46,70"],
    );
    const bande = [
      BANDA({ pagina: 0, modelli: ["BT19 BZG"] }),
      BANDA({ pagina: 1, modelli: ["BT19 BZG"] }),
    ];
    expect(() => parseVision(t, bande)).toThrow(/BT19 BZG.*cromat/s);
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

  it("«silver mat» e «silvermat» sono due grafie della stessa finitura", () => {
    // Il listino le usa entrambe: ID66 scrive «silver mat», ID713 «silvermat».
    const t = pagine(["XX11 R", "silver mat             106,30"]);
    expect(parseVision(t, [BANDA()])[0]!.righe).toEqual([
      { finitura: "silver mat", prezzo: "106,30" },
    ]);
  });
});

describe("BANDE_VISION_2026", () => {
  it("copre le otto pagine con prezzi", () => {
    // La 13 è la pagina riepilogativa dei nottolini: ripete tre prodotti già
    // stampati sulle pagine 6-8, ed è proprio ciò che dà materia alla guardia 3.
    expect(new Set(BANDE_VISION_2026.map((b) => b.pagina))).toEqual(
      new Set([6, 7, 8, 9, 10, 11, 12, 13]),
    );
    expect(BANDE_VISION_2026).toHaveLength(37);
  });

  it("ogni banda ha una finestra di righe e di colonne non vuota", () => {
    for (const b of BANDE_VISION_2026) {
      expect(b.aRiga).toBeGreaterThan(b.daRiga);
      expect(b.aColonna).toBeGreaterThan(b.daColonna);
      expect(b.modelli.length).toBeGreaterThan(0);
    }
  });
});
