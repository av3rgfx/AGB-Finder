import { describe, it, expect } from "vitest";
import { resolveListinoColumns, parseListinoSheet } from "./listino-parse";

/**
 * Il listino COLOMBO è un xlsx con codice, descrizione, prezzo, *temporary
 * surcharge* 3,5%, somma ed EAN. Le intestazioni esatte non sono un contratto
 * (il file di Andrea è «un vecchio modello» e ne arriverà uno nuovo), quindi le
 * colonne si riconoscono per NOME, non per posizione: un file con le colonne
 * spostate deve continuare a funzionare, e un file senza le colonne obbligatorie
 * deve fallire dicendo quali mancano — non importare metà dati.
 */
describe("resolveListinoColumns", () => {
  it("riconosce le intestazioni del listino COLOMBO", () => {
    const cols = resolveListinoColumns([
      "CODICE",
      "DESCRIZIONE",
      "PREZZO",
      "TEMPORARY SURCHARGE 3,5%",
      "SOMMA",
      "EAN",
    ]);
    expect(cols).toEqual({
      code: "CODICE",
      name: "DESCRIZIONE",
      priceList: "PREZZO",
      surcharge: "TEMPORARY SURCHARGE 3,5%",
      declaredTotal: "SOMMA",
      ean: "EAN",
    });
  });

  /**
   * Il listino vero (`LISTINO 02 2026 con temporary surcherge.xlsx`, foglio
   * «LP 02-26») NON intitola la colonna del surcharge con un nome: ci mette
   * l'ALIQUOTA. La riga di intestazione è
   *
   *   ["Articolo","Descrizione","Prezzo LP 02/26", 0.035, "SOMMA","EAN", null, null]
   *
   * — un numero e due celle vuote. Le intestazioni erano state dedotte dal NOME
   * DEL FILE («con temporary surcherge») e non dal file: il parser non era mai
   * passato su questo xlsx.
   */
  it("non esplode su intestazioni che non sono stringhe", () => {
    // Il cast riproduce esattamente il chiamante che ha prodotto il crash:
    // `sheet_to_json({header: 1})` restituisce le celle GREZZE, e lo script le
    // passava con un `as string[]`. Il cast era la bugia; qui è la prova.
    const cols = resolveListinoColumns([
      "Articolo",
      "Descrizione",
      "Prezzo LP 02/26",
      0.035,
      "SOMMA",
      "EAN",
      null,
      null,
    ] as unknown as string[]);
    expect(cols?.code).toBe("Articolo");
    expect(cols?.name).toBe("Descrizione");
    expect(cols?.priceList).toBe("Prezzo LP 02/26");
    expect(cols?.declaredTotal).toBe("SOMMA");
    expect(cols?.ean).toBe("EAN");
  });

  it("riconosce la colonna del surcharge quando è intitolata con la sua aliquota", () => {
    // `sheet_to_json` in modalità oggetto formatta l'intestazione: la chiave
    // delle celle è «3.5%», non `0.035`. È quella che il parser deve restituire,
    // perché è quella con cui le righe si indicizzano.
    const cols = resolveListinoColumns([
      "Articolo",
      "Descrizione",
      "Prezzo LP 02/26",
      "3.5%",
      "SOMMA",
      "EAN",
    ]);
    expect(cols?.surcharge).toBe("3.5%");
  });

  it("non scambia per surcharge una colonna a caso quando il nome c'è", () => {
    const cols = resolveListinoColumns([
      "CODICE",
      "DESCRIZIONE",
      "PREZZO",
      "TEMPORARY SURCHARGE",
      "3.5%",
    ]);
    expect(cols?.surcharge).toBe("TEMPORARY SURCHARGE");
  });

  it("non prende per surcharge una colonna vuota di SheetJS", () => {
    // Le celle di intestazione vuote diventano `__EMPTY`, `__EMPTY_1`…
    const cols = resolveListinoColumns([
      "Articolo",
      "Descrizione",
      "Prezzo",
      "__EMPTY",
      "__EMPTY_1",
    ]);
    expect(cols?.surcharge).toBeNull();
  });

  it("ignora maiuscole e spazi attorno", () => {
    const cols = resolveListinoColumns([" codice ", "Descrizione", "Prezzo"]);
    expect(cols?.code).toBe(" codice ");
    expect(cols?.name).toBe("Descrizione");
    expect(cols?.priceList).toBe("Prezzo");
  });

  it("non confonde «prezzo» con «somma»", () => {
    // Se il matcher fosse un banale `includes`, «SOMMA PREZZO» potrebbe finire
    // su priceList e il totale dichiarato sparirebbe.
    const cols = resolveListinoColumns(["CODICE", "DESCRIZIONE", "PREZZO", "SOMMA PREZZO"]);
    expect(cols?.priceList).toBe("PREZZO");
    expect(cols?.declaredTotal).toBe("SOMMA PREZZO");
  });

  it("le colonne facoltative possono mancare", () => {
    const cols = resolveListinoColumns(["CODICE", "DESCRIZIONE", "PREZZO"]);
    expect(cols).not.toBeNull();
    expect(cols?.surcharge).toBeNull();
    expect(cols?.ean).toBeNull();
    expect(cols?.declaredTotal).toBeNull();
  });

  it("restituisce null se manca una colonna obbligatoria", () => {
    expect(resolveListinoColumns(["DESCRIZIONE", "PREZZO"])).toBeNull(); // niente codice
    expect(resolveListinoColumns(["CODICE", "DESCRIZIONE"])).toBeNull(); // niente prezzo
  });

  it("accetta sinonimi ragionevoli", () => {
    const cols = resolveListinoColumns(["ARTICOLO", "DENOMINAZIONE", "LISTINO", "BARCODE"]);
    expect(cols?.code).toBe("ARTICOLO");
    expect(cols?.name).toBe("DENOMINAZIONE");
    expect(cols?.priceList).toBe("LISTINO");
    expect(cols?.ean).toBe("BARCODE");
  });
});

const HEADERS = ["CODICE", "DESCRIZIONE", "PREZZO", "TEMPORARY SURCHARGE", "SOMMA", "EAN"];
const row = (o: Record<string, unknown>) => ({
  CODICE: "",
  DESCRIZIONE: "",
  PREZZO: "",
  "TEMPORARY SURCHARGE": "",
  SOMMA: "",
  EAN: "",
  ...o,
});

describe("parseListinoSheet", () => {
  it("legge una riga completa e normalizza il codice", () => {
    const r = parseListinoSheet(
      [
        row({
          CODICE: "0CD41R-CM",
          DESCRIZIONE: "Maniglia CD41 cromo satinato",
          PREZZO: 101,
          "TEMPORARY SURCHARGE": 3.535,
          SOMMA: 104.535,
          EAN: "8033433012345",
        }),
      ],
      HEADERS,
    );
    expect(r.articles).toHaveLength(1);
    const a = r.articles[0]!;
    expect(a.code).toBe("0CD41R-CM");
    expect(a.codeNorm).toBe("0CD41RCM");
    expect(a.name).toBe("Maniglia CD41 cromo satinato");
    expect(a.priceList.toString()).toBe("101");
    expect(a.surcharge?.toString()).toBe("3.54");
    expect(a.ean).toBe("8033433012345");
  });

  it("arrotonda ENTRAMBE le metà a 2 decimali in scrittura", () => {
    // Le colonne a DB sono Decimal(12,2): se non si arrotondasse qui, ci
    // penserebbe Postgres in silenzio e il controllo sul totale (sotto) girerebbe
    // su numeri diversi da quelli salvati.
    const r = parseListinoSheet(
      [row({ CODICE: "X1", DESCRIZIONE: "x", PREZZO: 101.004, "TEMPORARY SURCHARGE": 3.535 })],
      HEADERS,
    );
    expect(r.articles[0]!.priceList.toString()).toBe("101");
    expect(r.articles[0]!.surcharge?.toString()).toBe("3.54");
  });

  it("SEGNALA quando la somma delle metà non ricostruisce il totale dichiarato", () => {
    // La spec dichiara questo invariante VERIFICATO su tutte e 3.456 le righe.
    // Qui smette di essere una misurazione di una volta e diventa un controllo
    // permanente: se il listino nuovo lo rompe, si vede all'import invece che in
    // bocca a un agente davanti a un cliente.
    const r = parseListinoSheet(
      [
        row({
          CODICE: "X1",
          DESCRIZIONE: "x",
          PREZZO: 100,
          "TEMPORARY SURCHARGE": 3.5,
          SOMMA: 999.99,
        }),
      ],
      HEADERS,
    );
    expect(r.articles).toHaveLength(1); // non blocca: segnala
    expect(r.totalMismatches).toEqual([
      { code: "X1", computed: "103.5", declared: "999.99" },
    ]);
  });

  it("non segnala nulla quando il totale torna, anche con la spazzatura float di Excel", () => {
    const r = parseListinoSheet(
      [
        row({
          CODICE: "X1",
          DESCRIZIONE: "x",
          PREZZO: 95.9,
          "TEMPORARY SURCHARGE": 3.3565,
          SOMMA: 99.25649999999999,
        }),
      ],
      HEADERS,
    );
    expect(r.totalMismatches).toEqual([]);
  });

  it("scarta la riga senza codice o senza prezzo, dicendo la riga e il perché", () => {
    const r = parseListinoSheet(
      [
        row({ CODICE: "", DESCRIZIONE: "senza codice", PREZZO: 10 }),
        row({ CODICE: "X2", DESCRIZIONE: "senza prezzo", PREZZO: "" }),
        row({ CODICE: "X3", DESCRIZIONE: "buona", PREZZO: 10 }),
      ],
      HEADERS,
    );
    expect(r.articles.map((a) => a.code)).toEqual(["X3"]);
    expect(r.skipped).toHaveLength(2);
    expect(r.skipped[0]).toMatchObject({ row: 2, reason: "codice mancante" });
    expect(r.skipped[1]).toMatchObject({ row: 3, reason: "prezzo mancante o non numerico" });
  });

  it("scarta una riga il cui codice si annulla nella normalizzazione", () => {
    // `---` non è un codice: senza questo controllo diventerebbe la chiave vuota
    // e si aggancerebbe a qualunque altra riga ugualmente degenere.
    const r = parseListinoSheet([row({ CODICE: "---", DESCRIZIONE: "x", PREZZO: 10 })], HEADERS);
    expect(r.articles).toHaveLength(0);
    expect(r.skipped[0]?.reason).toBe("codice privo di caratteri utili");
  });

  it("TROVA le collisioni di codice normalizzato invece di lasciarle a Postgres", () => {
    // Il vincolo @@unique([brand, code_norm]) le farebbe esplodere comunque, ma
    // con un errore di driver a metà import. Qui si sanno prima, e si sa QUALI.
    const r = parseListinoSheet(
      [
        row({ CODICE: "0CD41R-CM", DESCRIZIONE: "a", PREZZO: 10 }),
        row({ CODICE: "0CD41RCM", DESCRIZIONE: "b", PREZZO: 11 }),
        row({ CODICE: "PB01/Q", DESCRIZIONE: "c", PREZZO: 12 }),
      ],
      HEADERS,
    );
    expect(r.duplicateNorms).toEqual([
      { codeNorm: "0CD41RCM", codes: ["0CD41R-CM", "0CD41RCM"] },
    ]);
  });

  it("tratta l'EAN come testo, non come numero", () => {
    // Un EAN a 13 cifre letto come numero perde lo zero iniziale e, oltre i 15
    // digit, la precisione. Deve restare la stringa che era.
    const r = parseListinoSheet(
      [row({ CODICE: "X1", DESCRIZIONE: "x", PREZZO: 10, EAN: "0803343301234" })],
      HEADERS,
    );
    expect(r.articles[0]!.ean).toBe("0803343301234");
  });

  it("un EAN vuoto diventa null, non stringa vuota", () => {
    const r = parseListinoSheet([row({ CODICE: "X1", DESCRIZIONE: "x", PREZZO: 10 })], HEADERS);
    expect(r.articles[0]!.ean).toBeNull();
  });

  it("usa il codice come nome quando la descrizione manca", () => {
    // Meglio un nome uguale al codice che una riga senza nome: l'articolo esiste,
    // ha un prezzo, ed è ordinabile.
    const r = parseListinoSheet([row({ CODICE: "X1", DESCRIZIONE: "", PREZZO: 10 })], HEADERS);
    expect(r.articles[0]!.name).toBe("X1");
  });

  it("fallisce sull'intero foglio se mancano le colonne obbligatorie", () => {
    const r = parseListinoSheet([{ PIPPO: 1 }], ["PIPPO"]);
    expect(r.articles).toHaveLength(0);
    expect(r.fatal).toMatch(/colonne/i);
  });
});
