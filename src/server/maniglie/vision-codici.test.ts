import { describe, it, expect } from "vitest";
import { articoliVision } from "./vision-codici";
import type { VisionBlocco } from "./vision-parse";

const blocco = (modelli: string[], righe: [string, string][], pagina = 6): VisionBlocco => ({
  pagina,
  modelli,
  righe: righe.map(([finitura, prezzo]) => ({ finitura, prezzo })),
});

describe("articoliVision — la regola", () => {
  it("compone «0» + modello senza separatori + «-» + sigla", () => {
    const { articoli } = articoliVision([blocco(["AM41 R"], [["oroplus", "105,30"]])]);
    expect(articoli[0]!.code).toBe("0AM41R-OL");
    expect(articoli[0]!.codeNorm).toBe("0AM41ROL");
    expect(articoli[0]!.priceList.toString()).toBe("105.3");
  });

  it("toglie gli spazi ma TIENE lo slash: AM42 DK/SM → 0AM42DK/SM", () => {
    const { articoli } = articoliVision([blocco(["AM42 DK/SM"], [["cromat", "52,70"]])]);
    expect(articoli[0]!.code).toBe("0AM42DK/SM-CM");
  });

  it("emette una riga per OGNI modello che condivide la colonna", () => {
    const { articoli } = articoliVision([blocco(["AM41 R", "AM41 RY"], [["oroplus", "105,30"]])]);
    expect(articoli.map((a) => a.code)).toEqual(["0AM41R-OL", "0AM41RY-OL"]);
  });

  it("non ripete un codice già emesso (i nottolini stanno su due pagine)", () => {
    const { articoli } = articoliVision([
      blocco(["FF19 BZG"], [["oroplus", "43,10"]], 7),
      blocco(["FF19 BZG"], [["oroplus", "43,10"]], 13),
    ]);
    expect(articoli).toHaveLength(1);
  });
});

describe("articoliVision — le sei eccezioni", () => {
  it.each([
    ["FF13 Y", "0FF13-CM"], //       la Y sparisce
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
      blocco(["AM41 R"], [
        ["oroplus", "105,30"],
        ["zirconium HPS/1", "115,40"],
      ]),
    ]);
    expect(articoli).toHaveLength(1);
    expect(esclusi).toHaveLength(1);
    expect(esclusi[0]).toMatchObject({ modello: "AM41 R", finitura: "zirconium HPS/1" });
    expect(esclusi[0]!.motivo).toMatch(/HPS\/1/);
  });

  it("una finitura SCONOSCIUTA invece fa fallire, non si scarta in silenzio", () => {
    expect(() => articoliVision([blocco(["AM41 R"], [["fucsia", "1,00"]])])).toThrow(/fucsia/);
  });

  it("non conta due volte un modello stampato su due pagine", () => {
    // FF19 BZG sta a pagina 7 e a pagina 13: contare le occorrenze direbbe 2
    // dove il modello è uno, e quel numero lo legge l'operatore.
    const { esclusi } = articoliVision([
      blocco(["FF19 BZG"], [["zirconium HPS/1", "47,30"]], 7),
      blocco(["FF19 BZG"], [["zirconium HPS/1", "47,30"]], 13),
    ]);
    expect(esclusi).toHaveLength(1);
  });

  it("«ID13 Y» e «AM19 BZG» non producono codici: la loro classe smentisce la regola", () => {
    // Le designazioni `… Y` perdono la Y (2 su 2) e le `… BZG` guadagnano un 6
    // (2 su 2) — ma a listino esistono anche 6 bocchette che la Y la tengono e
    // 5 nottolini col BZG nudo. Per FF13/BT13/FF19/BT19 il codice si LEGGE; per
    // questi due, che sono nuovi, entrambe le forme sono possibili.
    const { articoli, esclusi } = articoliVision([
      blocco(["ID13 Y"], [["cromo", "10,30"]], 10),
      blocco(["AM19 BZG"], [["oroplus", "43,10"]], 6),
    ]);
    expect(articoli).toHaveLength(0);
    expect(esclusi.map((e) => e.modello)).toEqual(["ID13 Y", "AM19 BZG"]);
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
    [["FF19 BZG"], 7, "NOTTOLINO FF19BZG6 OROPLUS"],
    [["AM16"], 11, "MANIGLIONE AM16 OROPLUS"],
    [["AM313/0"], 12, "MANIGLIONE AM313 ZERO OROPLUS"],
    [["AM413 Y/0"], 12, "MANIGLIONE AM413Y ZERO OROPLUS"],
  ])("%s a pagina %i → «%s»", (modelli, pagina, atteso) => {
    const { articoli } = articoliVision([blocco(modelli, [["oroplus", "1,00"]], pagina)]);
    expect(articoli[0]!.name).toBe(atteso);
  });

  it("il nome della finitura viene da finiture.ts, non da una seconda tabella", () => {
    const { articoli } = articoliVision([blocco(["AM41 R"], [["grafite mat", "1,00"]])]);
    expect(articoli[0]!.name).toBe("LACONICA AM41R GRAFITE MAT");
  });

  it("nessuna descrizione supera i 35 caratteri, il massimo dei 3.456 esistenti", () => {
    const { articoli } = articoliVision([
      blocco(["AM42 DK/SM"], [["umber bronze", "1,00"]], 6),
      blocco(["FF13 BB"], [["umber bronze", "1,00"]], 6),
      blocco(["ID92 DK/SM"], [["grafite mat", "1,00"]], 8),
    ]);
    for (const a of articoli) expect(a.name.length).toBeLessThanOrEqual(35);
  });

  it("la prima parola NON è mai «MANIGLIA», che la curatela fonde in MANIGLIA INCASSO", () => {
    // 144 righe finirebbero fra i maniglioni a incasso, e nessun conteggio
    // andrebbe a zero: il difetto sarebbe invisibile.
    const { articoli } = articoliVision([blocco(["AM41 R"], [["oroplus", "1,00"]])]);
    expect(articoli[0]!.name.split(" ")[0]).not.toBe("MANIGLIA");
  });

  it("ROBOT6 S porta la S come SECONDO token, che è ciò che `divise` legge", () => {
    const { articoli } = articoliVision([blocco(["ID91 R"], [["oromat", "1,00"]], 8)]);
    expect(articoli[0]!.name.split(" ")[1]).toBe("S");
  });
});
