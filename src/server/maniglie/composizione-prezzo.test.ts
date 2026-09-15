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
    expect(composizionePrezzo(3, 0.1)).toEqual({ kind: "conMaggiorazione", percento: 3.3 });
  });

  it("surcharge ZERO non è NULL: è una maggiorazione dichiarata nulla", () => {
    // `articleTotal` li tratta identici (`?? 0`), ma significano cose opposte —
    // `0` AFFERMA l'assenza, `null` la registra come non dichiarata. È la stessa
    // distinzione fra `[]` e `undefined` nel filtro della pronta consegna, ed è
    // `surcharge IS NULL` a ritrovare le 251 righe del listino 05/26.
    expect(composizionePrezzo(100, 0)).toEqual({ kind: "conMaggiorazione", percento: 0 });
  });

  it("un priceList a zero non produce NaN né Infinity a schermo", () => {
    expect(composizionePrezzo(0, 0)).toEqual({ kind: "netto" });
    expect(composizionePrezzo(0, 1)).toEqual({ kind: "netto" });
  });
});
