import { describe, it, expect } from "vitest";
import {
  codiceSenzaFinitura,
  contaFiniture,
  FINITURE,
  FINITURE_PER_CODICE,
  finituraDiCodice,
  finituraDiTesto,
} from "./finiture";

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
    // `CR8` è un bicolore CROMO/CROMAT: esiste nel listino (33 codici) ma COLOMBO
    // non lo pubblica fra le finiture. Inventare una categoria sulle code non
    // riconosciute è esattamente ciò che la scheda misure vieta.
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

describe("conteggio per finitura", () => {
  it("conta solo le code ufficiali, nell'ordine in cui COLOMBO le pubblica", () => {
    const n = contaFiniture([
      "0AC11R-CR",
      "0AC11R-CM",
      "0AC11RY-CR",
      "0CD41R-OL",
      "0CD41R-CR8", // bicolore: non è fra le 31
      "CB22DKSMSXCR8", // senza trattino
    ]);
    expect(n).toEqual([
      { codice: "OL", nome: "Oroplus", colore: "#F8EAB4", count: 1 },
      { codice: "CR", nome: "Cromo", colore: "#EAE7E6", count: 2 },
      { codice: "CM", nome: "Cromat", colore: "#D6D4D4", count: 1 },
    ]);
  });

  it("una finitura senza codici non compare: sceglierla darebbe uno schermo vuoto", () => {
    expect(contaFiniture(["0AC11R-CR"]).map((f) => f.codice)).toEqual(["CR"]);
  });

  it("su un elenco vuoto non c'è niente da offrire", () => {
    expect(contaFiniture([])).toEqual([]);
  });
});

/**
 * COLOMBO scrive la finitura nei nomi dei file dell'archivio in DUE modi: col
 * suo codice (`Fedra_1OL`) oppure A PAROLE (`due frontale capri blue`). Il
 * secondo caso non era letto, e sono 268 file su 638 — è la ragione per cui
 * tutti gli otto `0CC31R-C0x` mostravano la maniglia blu.
 *
 * ⚠️ Il match ingenuo sarebbe stato PEGGIO del silenzio: `Cromo` è sottostringa
 * di «cromo matte», che è **Cromat**. La prova sta nell'archivio stesso — in
 * `01_Ama` COLOMBO scrive «cromat» sulla variante zero e «cromo matte» su
 * quella liscia, stessa finitura, due generazioni di nomi. Quindi: match più
 * lungo, grafie ricavate dal vocabolario chiuso delle 195 code, bicolori
 * rifiutati.
 */
describe("finituraDiTesto", () => {
  it.each([
    ["due frontale capri blue", "C12"],
    ["dueq frontale lemon yellow", "C09"],
    ["oneq frontale strawberry red", "C07"],
    ["Laconica_still_01 Oroplus", "OL"],
    ["Laconica_still_06 Cherry", "CH"],
    ["R6S_still_05 Biancomat", "BI"],
    ["Laconica_still_05 Dark green", "DG"],
  ])("«%s» è %s", (nome, atteso) => {
    expect(finituraDiTesto(nome)).toBe(atteso);
  });

  // I quattro casi in cui un nome ufficiale è PREFISSO di un altro: vince il
  // più lungo, o si affermerebbe la finitura sbagliata con la stessa sicurezza
  // di quella giusta.
  it.each([
    ["Laconica_still_04 Umber bronze", "UB"], //      non C02 «Bronze»
    ["R6_still_04 Silvermat", "SM"], //               non C04 «Silver»
    ["Laconica_still_03 Grafite Mat", "GM"], //       non GL «Grafite»
    ["electra verticale vintage matte", "VM"], //     non VL «Vintage»
  ])("«%s» è %s e non il nome più corto che ci sta dentro", (nome, atteso) => {
    expect(finituraDiTesto(nome)).toBe(atteso);
  });

  // Le grafie, tutte ricavate dal vocabolario reale dei nomi file.
  it.each([
    ["ama cromo matte", "CM"], //                     lo dice 01_Ama
    ["gryps frontale oro matte", "OM"],
    ["elle frontale nero matte", "NM"],
    ["robocinque zero frontale bianco matte", "BI"],
    ["robocinque verticale matte white", "BI"], //    ordine invertito
    ["flessa nickel matte", "NI"], //                 Nikelmat all'inglese
  ])("«%s» è %s", (nome, atteso) => {
    expect(finituraDiTesto(nome)).toBe(atteso);
  });

  // Un bicolore non è una delle 31 pubblicate: dichiararne una sarebbe
  // inventare, ed è la stessa ragione per cui `CR8` e `OL9` non sono a tabella.
  it.each(["963 verticale cromo-cromo matte 2", "alba cromo-cromo matte"])(
    "«%s» è un bicolore, quindi nessuna",
    (nome) => {
      expect(finituraDiTesto(nome)).toBeNull();
    },
  );

  it("il cromo liscio resta Cromo, e non va confuso col matte", () => {
    expect(finituraDiTesto("Kubo_ID45_frontal_Cromo")).toBe("CR");
  });

  it.each(["Fedra_def", "Robot m verticale", "Laconica_shadow"])(
    "«%s» non nomina nessuna finitura",
    (nome) => {
      expect(finituraDiTesto(nome)).toBeNull();
    },
  );
});

/**
 * ⚠️ IL TRATTINO NON È OBBLIGATORIO, e prima lo era.
 *
 * 237 codici del listino non ce l'hanno, e 126 di loro finiscono comunque con
 * una delle 31. Il difetto non era estetico: chi non dichiara una finitura, per
 * la regola della foto contesa, non può sbagliarla — quindi «POMOLO ONE WHITE»
 * teneva la foto del pomolo ROSSO, cioè alla lettera la segnalazione da cui è
 * nata questa sessione.
 */
describe("finituraDiCodice — la coda senza trattino", () => {
  it.each([
    ["0CC15FISSOC01", "C01"], // POMOLO ONE WHITE
    ["0CC15FISSOC07", "C07"], // POMOLO ONE STRAWBERRY
    ["0AM32DKSMSXOL", "OL"], //  MADI … SENZA MOV. OROP.
    ["0AM32DKSMSXOM", "OM"], //  … OROM.
    ["0BD12DKF/SMCM", "CM"], //  ELLE … BASSO SENZA MOV.
    ["0CB52DKSMSXNI", "NI"], //  FLESSA … SX SENZA MOV.
  ])("«%s» è %s", (code, atteso) => {
    expect(finituraDiCodice(code)).toBe(atteso);
  });

  // I bicolori non sono fra le 31 e restano fuori, col trattino o senza.
  it.each(["0CB22DK/SMCR8", "0CB22DK/SMOL9", "0CB26-CM5"])("«%s» non è una delle 31", (code) => {
    expect(finituraDiCodice(code)).toBeNull();
  });

  it("una coda che non è una finitura resta null", () => {
    expect(finituraDiCodice("XGRANO 5MA")).toBeNull();
    expect(finituraDiCodice("0ID51RSB")).toBeNull();
  });

  it("il taglio della coda funziona in entrambe le forme", () => {
    expect(codiceSenzaFinitura("0ID41R-CR")).toBe("0ID41R");
    expect(codiceSenzaFinitura("0CC15FISSOC01")).toBe("0CC15FISSO");
    expect(codiceSenzaFinitura("XKIT/PS")).toBe("XKIT/PS");
  });
});
