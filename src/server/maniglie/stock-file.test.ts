import { describe, it, expect } from "vitest";
import { extractStockCodes, matchStockCodes, diffStock } from "./stock-file";

/**
 * Il file della pronta consegna è un `.xls` con UNA SOLA colonna di codici
 * (Andrea: «il formato del file è soltanto .xls»). Si legge solo la prima
 * colonna, ignorando fogli, formule e tutto il resto: meno superficie letta,
 * meno modi di sbagliare.
 */
describe("extractStockCodes", () => {
  it("prende la prima cella di ogni riga", () => {
    expect(extractStockCodes([["0CD41RCM"], ["PB01QCM"], ["SE11RRY"]])).toEqual([
      "0CD41RCM",
      "PB01QCM",
      "SE11RRY",
    ]);
  });

  it("ignora le colonne oltre la prima", () => {
    expect(extractStockCodes([["0CD41RCM", "qualcosa", 42]])).toEqual(["0CD41RCM"]);
  });

  it("salta le righe vuote invece di produrre codici fantasma", () => {
    expect(extractStockCodes([["0CD41RCM"], [], [""], [null], ["  "], ["PB01QCM"]])).toEqual([
      "0CD41RCM",
      "PB01QCM",
    ]);
  });

  it("salta la riga d'intestazione, se c'è", () => {
    expect(extractStockCodes([["CODICE"], ["0CD41RCM"]])).toEqual(["0CD41RCM"]);
    expect(extractStockCodes([["Articolo"], ["0CD41RCM"]])).toEqual(["0CD41RCM"]);
  });

  it("NON scambia un codice vero per un'intestazione", () => {
    // Un file senza intestazione non deve perdere la prima riga: sarebbe una
    // maniglia che sparisce dallo scaffale senza che nessuno se ne accorga.
    expect(extractStockCodes([["0CD41RCM"], ["PB01QCM"]])).toEqual(["0CD41RCM", "PB01QCM"]);
  });

  it("conserva il codice GREZZO, com'è scritto nel file", () => {
    // È ciò che Andrea rilegge nel suo gestionale, e serve il giorno che la
    // normalizzazione va rivista.
    expect(extractStockCodes([[" 0cd41r-cm "]])).toEqual(["0cd41r-cm"]);
  });

  it("legge un codice numerico senza trasformarlo", () => {
    expect(extractStockCodes([[123456]])).toEqual(["123456"]);
  });
});

describe("matchStockCodes", () => {
  const catalogo = new Map([
    ["0CD41RCM", "art-1"],
    ["PB01QCM", "art-2"],
  ]);

  it("aggancia per codice normalizzato, non per forma", () => {
    const r = matchStockCodes(["0CD41R-CM", "PB01/Q-CM"], catalogo);
    expect(r.lines.map((l) => l.articleId)).toEqual(["art-1", "art-2"]);
    expect(r.matchedCount).toBe(2);
    expect(r.orphans).toEqual([]);
  });

  it("un codice non a listino diventa una riga ORFANA, non un errore", () => {
    // Gli orfani esistono per costruzione: sono righe di giacenza che non
    // trovano un articolo. Non c'è nulla da «gestire», solo da decidere chi li
    // vede — e li vede solo Andrea.
    const r = matchStockCodes(["0CD41RCM", "XGRATZ7SX"], catalogo);
    expect(r.matchedCount).toBe(1);
    expect(r.orphans).toEqual(["XGRATZ7SX"]);
    expect(r.lines[1]).toEqual({
      rawCode: "XGRATZ7SX",
      codeNorm: "XGRATZ7SX",
      articleId: null,
    });
  });

  it("conserva rawCode E codeNorm su ogni riga", () => {
    const r = matchStockCodes(["0cd41r-cm"], catalogo);
    expect(r.lines[0]).toEqual({
      rawCode: "0cd41r-cm",
      codeNorm: "0CD41RCM",
      articleId: "art-1",
    });
  });

  it("scarta i doppioni dello stesso codice", () => {
    // Lo stesso articolo due volte nel file non deve produrre due righe: la
    // disponibilità è un insieme, non un conteggio (le quantità sono fuori
    // scope per decisione di Andrea).
    const r = matchStockCodes(["0CD41RCM", "0CD41R-CM"], catalogo);
    expect(r.lines).toHaveLength(1);
    expect(r.duplicates).toEqual(["0CD41R-CM"]);
  });

  it("scarta un codice che si annulla nella normalizzazione", () => {
    const r = matchStockCodes(["---", "0CD41RCM"], catalogo);
    expect(r.lines).toHaveLength(1);
    expect(r.invalid).toEqual(["---"]);
  });
});

describe("diffStock", () => {
  it("dice chi è entrato e chi è uscito rispetto all'import precedente", () => {
    // È ciò che smaschera il file della marca sbagliata PRIMA della conferma:
    // numeri che saltano all'occhio, invece di dieci agenti che vedono un
    // magazzino irriconoscibile.
    const d = diffStock(["A", "B", "C"], ["B", "C", "D"]);
    expect(d.entered).toEqual(["D"]);
    expect(d.left).toEqual(["A"]);
  });

  it("senza un import precedente è tutto entrato", () => {
    const d = diffStock([], ["A", "B"]);
    expect(d.entered).toEqual(["A", "B"]);
    expect(d.left).toEqual([]);
  });

  it("due file identici non producono differenze", () => {
    expect(diffStock(["A", "B"], ["B", "A"])).toEqual({ entered: [], left: [] });
  });

  it("confronta sui codici normalizzati, non sulla grafia", () => {
    expect(diffStock(["0CD41R-CM"], ["0CD41RCM"])).toEqual({ entered: [], left: [] });
  });
});
