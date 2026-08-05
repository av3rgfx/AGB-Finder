import { describe, it, expect } from "vitest";
import {
  splitGroup,
  serieDelGruppo,
  radiceCodice,
  fotoRappresentativa,
  type BrowseRow,
} from "./browse";

const R = (code: string, name: string, imageUrl: string | null = null): BrowseRow => ({
  id: code,
  code,
  codeNorm: code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
  name,
  imageUrl,
});

/** Righe vere del listino COLOMBO (foglio «LP 02-26»). */
const LARA = [
  R("0CB71R-CM", "LARA CB71R CROMAT"),
  R("0CB71R-OL", "LARA CB71R OROPLUS"),
  R("0CB72DK-CM", "LARA CB72DK CROMAT"),
];

describe("splitGroup", () => {
  it("raggruppa per serie, ordinando per numerosità", () => {
    expect(splitGroup(LARA, "LARA").serie.map((s) => ({ serie: s.serie, count: s.count }))).toEqual([
      { serie: "CB71R", count: 2 },
      { serie: "CB72DK", count: 1 },
    ]);
  });

  it("a parità di numerosità ordina per nome, così l'elenco non balla fra due letture", () => {
    const rows = [R("0CB72DK-CM", "LARA CB72DK CROMAT"), R("0CB71R-CM", "LARA CB71R CROMAT")];
    expect(splitGroup(rows, "LARA").serie.map((x) => x.serie)).toEqual(["CB71R", "CB72DK"]);
  });

  it("ogni serie porta le sue righe: è ciò che permette alla tendina di aprirsi senza rete", () => {
    const cb71 = splitGroup(LARA, "LARA").serie[0]!;
    expect(cb71.rows.map((r) => r.code)).toEqual(["0CB71R-CM", "0CB71R-OL"]);
    expect(cb71.rows).toHaveLength(cb71.count);
  });

  it("trova la serie anche quando NON è il secondo token", () => {
    // 26% dei codici veri: `PLACCA PEGASO PL70` ha la serie al terzo posto.
    const { serie } = splitGroup([R("0AM11PL70-CM", "PLACCA PEGASO PL70 CROMAT")], "PLACCA");
    expect(serie.map((s) => s.serie)).toEqual(["PL70"]);
  });

  it("restituisce SEPARATAMENTE i codici che una serie non ce l'hanno", () => {
    const rows = [...LARA, R("XZZ-C01", "LARA SENZA CODICE IN DESCRIZIONE")];
    const { serie, senzaSerie } = splitGroup(rows, "LARA");
    expect(serie.reduce((n, f) => n + f.count, 0)).toBe(3);
    expect(senzaSerie.map((r) => r.code)).toEqual(["XZZ-C01"]);
  });

  it("ogni riga sta in uno dei due lati, mai in nessuno e mai in tutti e due", () => {
    const rows = [...LARA, R("XZZ-C01", "LARA SENZA CODICE IN DESCRIZIONE")];
    const { serie, senzaSerie } = splitGroup(rows, "LARA");
    expect(serie.reduce((n, f) => n + f.count, 0) + senzaSerie.length).toBe(rows.length);
  });

  it("NON considera serie la parola del gruppo stessa", () => {
    // Riga vera: `KIT PORTE SCORREVOLI` col codice `XKIT/PS-CM`. «KIT» è dentro
    // il codice, quindi verrebbe preso per serie — e il livello 2 mostrerebbe
    // «KIT › KIT», che non divide nulla e ripete l'etichetta di sopra.
    const { serie, senzaSerie } = splitGroup([R("XKIT/PS-CM", "KIT PORTE SCORREVOLI")], "KIT");
    expect(serie).toEqual([]);
    expect(senzaSerie).toHaveLength(1);
  });

  it("su un elenco vuoto non esplode", () => {
    expect(splitGroup([], "LARA")).toEqual({ serie: [], senzaSerie: [] });
  });
});

describe("radiceCodice", () => {
  it("toglie lo zero di testa e la coda di finitura", () => {
    expect(radiceCodice("0ID51RSMY-CM")).toBe("ID51RSMY");
    expect(radiceCodice("PB01/Q-BI")).toBe("PB01Q");
  });

  it("senza trattino tiene tutto: non c'è una coda da togliere", () => {
    expect(radiceCodice("XQUADRO 104")).toBe("XQUADRO104");
  });

  /**
   * Il controesempio della spec 2026-08-04 §9, che il divieto «non dedurre dal
   * codice» esisteva per proteggere. Verificato: la radice li tiene SEPARATI,
   * quindi la deroga non riapre il caso che il divieto temeva.
   */
  it("NON fonde due codici che il divieto della spec voleva separati", () => {
    expect(radiceCodice("0CD63FP-CM")).not.toBe(radiceCodice("0CD63GB-CM"));
  });
});

describe("splitGroup — la classificazione NON dipende dal filtro", () => {
  /**
   * Il difetto che questo test rende impossibile, misurato il 2026-08-05:
   * classificando DOPO aver filtrato, 27 articoli su 3.393 cambiavano serie
   * solo perché «solo pronta consegna» era acceso — e un URL
   * `?tipo=X&fam=Y&pronta=1` puntava a una tendina che non esisteva più.
   * Il filtro finitura era peggio: la radice È il codice meno la finitura,
   * quindi filtrando per colore ogni radice sarebbe diventata un singoletto.
   */
  it("un articolo sta nella stessa serie con e senza filtro", () => {
    const intera = serieDelGruppo(LARA, "LARA");
    for (const r of LARA) {
      const solo = splitGroup(LARA, "LARA", new Set([r.id]));
      expect(solo.serie[0]?.serie ?? null).toBe(intera.get(r.id) ?? null);
    }
  });

  it("una serie senza righe visibili non compare, ma non ridefinisce le altre", () => {
    const filtrate = splitGroup(LARA, "LARA", new Set(["0CB72DK-CM"]));
    expect(filtrate.serie.map((s) => s.serie)).toEqual(["CB72DK"]);
  });

  it("senza il terzo argomento si vede tutto", () => {
    expect(splitGroup(LARA, "LARA").serie.map((s) => s.serie)).toEqual(["CB71R", "CB72DK"]);
  });
});

/**
 * Il caso portato dal titolare il 2026-08-05. La sua diagnosi («lo zero
 * iniziale del codice, forse un errore di esportazione») era sbagliata:
 * `0ID51R-CM` ha lo stesso zero e la serie la prende. La causa vera è che
 * COLOMBO scrive nella descrizione un codice DIVERSO da quello dell'articolo —
 * `ID51RY` contro `ID51RSMY`. La destinazione che aveva indicato è però esatta,
 * e si raggiunge senza indovinare.
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

  it("0ID51RSMY-CM e -CR entrano in ID51R, per prefisso unico", () => {
    const m = serieDelGruppo(ROBOQUATTRO_S, "ROBOQUATTRO S");
    expect(m.get("0ID51RSMY-CM")).toBe("ID51R");
    expect(m.get("0ID51RSMY-CR")).toBe("ID51R");
  });

  it("0ID51RSB-NM, fuori per lo spazio mancante in «S'ID51RSB», entra in ID51RSB", () => {
    // Le candidate per prefisso sono due (ID51R e ID51RSB), ma una è IDENTICA
    // alla radice del codice. Un'identità non è un indovinello, ed è per questo
    // che il gradino 2 la controlla prima di arrendersi.
    const m = serieDelGruppo(ROBOQUATTRO_S, "ROBOQUATTRO S");
    expect(m.get("0ID51RSB-NM")).toBe("ID51RSB");
  });

  it("nessun codice del gruppo resta senza serie", () => {
    const m = serieDelGruppo(ROBOQUATTRO_S, "ROBOQUATTRO S");
    expect(m.size).toBe(ROBOQUATTRO_S.length);
  });

  it("nessun codice cambia serie accendendo un filtro", () => {
    const intera = serieDelGruppo(ROBOQUATTRO_S, "ROBOQUATTRO S");
    for (const r of ROBOQUATTRO_S) {
      const solo = splitGroup(ROBOQUATTRO_S, "ROBOQUATTRO S", new Set([r.id]));
      expect(solo.serie[0]?.serie ?? null).toBe(intera.get(r.id) ?? null);
    }
  });
});

/**
 * ROSETTA è il guadagno più grosso del gradino 3: con la regola vecchia sono 5
 * serie e OTTANTA codici senza serie su 105. Le radici condivise ne raccolgono
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

  it("raccoglie le radici condivise accanto alle serie della descrizione", () => {
    // `XROSDK-BR` la serie ce l'ha già dal gradino 1: «DK» è nella descrizione
    // ED è dentro il codice. Sono le quattro `PB01*` a nascere dal gradino 3.
    const { serie, senzaSerie } = splitGroup(ROSETTA, "ROSETTA");
    expect(serie.map((s) => `${s.serie}:${s.count}`)).toEqual(["PB01:2", "PB01Q:2", "DK:1"]);
    expect(senzaSerie).toEqual([]);
  });

  it("una radice da un codice solo NON diventa una serie", () => {
    // Una tendina che contiene una riga sola è un involucro attorno a una riga.
    // Righe vere del gruppo QUADRO, che è il caso peggiore misurato: 14 codici
    // e 11 radici uniche, perché sono misure e non modelli.
    const { serie, senzaSerie } = splitGroup(
      [R("XQUADRO 104", "QUADRO 8X8 104mm."), R("XQUADRO 114", "QUADRO 8X8 114mm.")],
      "QUADRO",
    );
    expect(serie).toEqual([]);
    expect(senzaSerie).toHaveLength(2);
  });
});

describe("fotoRappresentativa", () => {
  it("prende la prima per codice fra quelle che ne hanno una", () => {
    const rows = [
      R("0CB71R-OL", "LARA CB71R OROPLUS", null),
      R("0CB71R-CM", "LARA CB71R CROMAT", "k/cromat"),
      R("0CB71R-NM", "LARA CB71R NEROMAT", "k/neromat"),
    ];
    expect(fotoRappresentativa(rows)).toBe("k/cromat");
  });

  it("null quando nessuna riga ne ha una: il segnaposto non è un errore", () => {
    // Misurato: 157 serie su 533 non hanno alcuna foto.
    expect(fotoRappresentativa([R("XZZ-1", "KIT")])).toBe(null);
  });

  it("NON risale a righe che il filtro ha tolto: riceve solo le visibili", () => {
    expect(fotoRappresentativa([])).toBe(null);
  });
});
