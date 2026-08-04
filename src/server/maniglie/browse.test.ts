import { describe, it, expect } from "vitest";
import { splitGroup, filterByFamily, type BrowseRow } from "./browse";

const R = (code: string, name: string): BrowseRow => ({
  id: code,
  code,
  codeNorm: code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
  name,
});

/** Righe vere del listino COLOMBO (foglio «LP 02-26»). */
const LARA = [
  R("0CB71R-CM", "LARA CB71R CROMAT"),
  R("0CB71R-OL", "LARA CB71R OROPLUS"),
  R("0CB72DK-CM", "LARA CB72DK CROMAT"),
];

describe("splitGroup", () => {
  it("raggruppa per famiglia, ordinando per numerosità", () => {
    expect(splitGroup(LARA, "LARA").families).toEqual([
      { family: "CB71R", count: 2 },
      { family: "CB72DK", count: 1 },
    ]);
  });

  it("a parità di numerosità ordina per nome, così l'elenco non balla fra due letture", () => {
    const rows = [R("0CB72DK-CM", "LARA CB72DK CROMAT"), R("0CB71R-CM", "LARA CB71R CROMAT")];
    expect(splitGroup(rows, "LARA").families.map((x) => x.family)).toEqual(["CB71R", "CB72DK"]);
  });

  it("trova la famiglia anche quando NON è il secondo token", () => {
    // 26% dei codici veri: `PLACCA PEGASO PL70` ha la famiglia al terzo posto.
    expect(splitGroup([R("0AM11PL70-CM", "PLACCA PEGASO PL70 CROMAT")], "PLACCA").families).toEqual([
      { family: "PL70", count: 1 },
    ]);
  });

  /**
   * Il difetto che questa funzione esiste per rendere impossibile: su 114 gruppi
   * veri solo 23 hanno copertura piena e SETTANTA sono parziali (MANIGLIONE
   * 333/338, BOCCHETTA 250/288). Restituire le sole famiglie renderebbe i codici
   * restanti irraggiungibili — cioè invisibili a chi sfoglia, con un prezzo e una
   * disponibilità che esistono.
   */
  it("restituisce SEPARATAMENTE i codici che una famiglia non ce l'hanno", () => {
    const rows = [...LARA, R("0CC211BZG-C01", "LARA SENZA CODICE IN DESCRIZIONE")];
    const { families, loose } = splitGroup(rows, "LARA");
    expect(families.reduce((n, f) => n + f.count, 0)).toBe(3);
    expect(loose.map((r) => r.code)).toEqual(["0CC211BZG-C01"]);
  });

  it("ogni riga sta in uno dei due lati, mai in nessuno e mai in tutti e due", () => {
    const rows = [...LARA, R("0CC211BZG-C01", "LARA SENZA CODICE IN DESCRIZIONE")];
    const { families, loose } = splitGroup(rows, "LARA");
    expect(families.reduce((n, f) => n + f.count, 0) + loose.length).toBe(rows.length);
  });

  it("NON considera famiglia la parola del gruppo stessa", () => {
    // Riga vera: `KIT PORTE SCORREVOLI` col codice `XKIT/PS-CM`. «KIT» è dentro
    // il codice, quindi verrebbe presa per famiglia — e il livello 2 mostrerebbe
    // «KIT › KIT», che non divide nulla e ripete l'etichetta di sopra.
    const { families, loose } = splitGroup([R("XKIT/PS-CM", "KIT PORTE SCORREVOLI")], "KIT");
    expect(families).toEqual([]);
    expect(loose).toHaveLength(1);
  });

  it("un gruppo senza alcuna famiglia dà famiglie vuote: è il segnale di saltare il livello 2", () => {
    const rows = [R("0CC211BZG-C01", "KIT PORTE SCORREVOLI")];
    expect(splitGroup(rows, "KIT").families).toEqual([]);
    expect(splitGroup(rows, "KIT").loose).toHaveLength(1);
  });

  it("su un elenco vuoto non esplode", () => {
    expect(splitGroup([], "LARA")).toEqual({ families: [], loose: [] });
  });
});

describe("filterByFamily", () => {
  it("tiene solo le righe di quella famiglia", () => {
    expect(filterByFamily(LARA, "LARA", "CB71R").map((r) => r.code)).toEqual([
      "0CB71R-CM",
      "0CB71R-OL",
    ]);
  });

  it("su una famiglia inesistente non restituisce nulla, invece di restituire tutto", () => {
    // Un filtro che «non trova» e quindi mostra l'intero gruppo è il modo più
    // rapido per far promettere all'agente un articolo che non ha guardato.
    expect(filterByFamily(LARA, "LARA", "NONESISTE")).toEqual([]);
  });

  it("non aggancia le righe senza famiglia", () => {
    const rows = [...LARA, R("0CC211BZG-C01", "LARA SENZA CODICE IN DESCRIZIONE")];
    expect(filterByFamily(rows, "LARA", "CB71R")).toHaveLength(2);
  });

  it("usa la stessa regola di splitGroup sulla famiglia degenere", () => {
    const rows = [R("XKIT/PS-CM", "KIT PORTE SCORREVOLI")];
    expect(filterByFamily(rows, "KIT", "KIT")).toEqual([]);
  });
});
