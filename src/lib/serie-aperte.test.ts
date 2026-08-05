import { describe, expect, it } from "vitest";
import { leggiSerieAperte, scriviSerieAperte } from "./serie-aperte";

describe("le serie aperte nell'URL", () => {
  it("legge un elenco separato da virgole", () => {
    expect(leggiSerieAperte("CD73,CC113")).toEqual(["CD73", "CC113"]);
  });

  it("un vecchio link a una sola famiglia apre quella tendina", () => {
    // `?fam=CB71R` è la forma che si condivideva prima delle tendine: continua
    // a valere, ed è la ragione per cui il parametro non è stato rinominato.
    expect(leggiSerieAperte("CB71R")).toEqual(["CB71R"]);
  });

  it("regge i nomi di serie che contengono una barra", () => {
    // `HPS/1` è una serie vera del listino COLOMBO.
    expect(leggiSerieAperte(scriviSerieAperte(["HPS/1"]))).toEqual(["HPS/1"]);
  });

  it("null e stringa vuota danno un elenco vuoto", () => {
    expect(leggiSerieAperte(null)).toEqual([]);
    expect(leggiSerieAperte("")).toEqual([]);
  });

  it("scrivere un elenco vuoto dà null, così il parametro sparisce dall'URL", () => {
    expect(scriviSerieAperte([])).toBe(null);
  });

  it("il giro completo conserva l'ordine", () => {
    const aperte = ["CD73", "HPS/1", "CC113"];
    expect(leggiSerieAperte(scriviSerieAperte(aperte))).toEqual(aperte);
  });
});
