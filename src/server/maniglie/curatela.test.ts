import { describe, expect, test } from "vitest";
import {
  browseLabel,
  foldBrowseGroups,
  sourceFirstWords,
  vociCuratela,
} from "./curatela";

/**
 * Le regole vengono da Andrea, che rifornisce il magazzino e ha usato lo sfoglio
 * vero. Ogni caso qui sotto è una riga ESISTENTE del listino `LP 02-26`: le
 * etichette sono quelle misurate, non quelle che Andrea ha scritto a memoria
 * (`ROBOCINQUQ` e non «RobocinqueQ», `NOTTOLIN` e non «NOTTLIN», `KITPORTE`
 * attaccato). Se il listino nuovo le scrivesse diversamente, questi test
 * diventano rossi — ed è il punto: una fusione che non aggancia più nulla è
 * invisibile a schermo, perché nessun conteggio va a zero.
 */

describe("browseLabel — fusioni", () => {
  test.each([
    ["BOCCEHTTA CD41 CROMAT", "BOCCHETTA"],
    ["NOTTOLIN DB19BZG6 CROMO", "NOTTOLINO"],
    ["KITPORTE SCORREVOLI OPER S/SER", "KIT"],
    ["DUMMY/C ROSETTA STRETTA", "DUMMY"],
    ["MOV.GRATZ QUADRO 7 CON PERNI", "MOVIMENTO"],
    ["MOV.MARTELLINA QUADRO 6", "MOVIMENTO"],
    ["ROS. OTT. + SOTTOR. NYLON + 5", "ROSETTA"],
  ])("%s si elenca sotto %s", (name, atteso) => {
    expect(browseLabel("COLOMBO", name)).toBe(atteso);
  });

  // Il codice dice quale dei due refusi è quale, e conferma Andrea: `ID61RSB`
  // è la serie del Robocinque base (la S usa `ID71*`), `CD92DK` è quella di
  // Robotre (Robot usa `CD4x`/`CD7x`). L'handoff dava ROBOTE per indecidibile.
  test("ROBOCINQUQ è il Robocinque base, non la S", () => {
    expect(browseLabel("COLOMBO", "ROBOCINQUQ ID61RSB ZERO OROPL.")).toBe("ROBOCINQUE");
  });

  test("ROBOTE è Robotre, e lo dice il suo codice CD92DK", () => {
    expect(browseLabel("COLOMBO", "ROBOTE CD92DK SENZA MOV. UMBER")).toBe("ROBOTRE");
  });
});

describe("browseLabel — rimozioni", () => {
  test.each([
    "VITE M4x25 TC+",
    "VITI SEZIONATE PER MANIGLIONI",
    "RONDELLA IN NYLON",
    "DADO M4 ZINCATO",
    "CHIAVE A BRUGOLA",
  ])("%s non si sfoglia", (name) => {
    expect(browseLabel("COLOMBO", name)).toBeNull();
  });

  // Il test qui diceva l'opposto — «RONDELLE resta, perché Andrea non l'ha
  // chiesta» — ed era una scelta deliberata: sulla tassonomia di Andrea la
  // fonte di verità era lui. Ma a schermo c'era già scritto «viti, dadi,
  // chiavi e rondelle non si sfogliano», mentre esclusa era solo RONDELLA:
  // la frase era FALSA, e il titolare l'ha chiesto il 2026-08-05. Il test è
  // girato insieme alla decisione, perché codificava il comportamento vecchio.
  test("RONDELLE non si sfoglia: la pagina lo dichiarava già", () => {
    expect(browseLabel("COLOMBO", "RONDELLE BENZING")).toBeNull();
  });
});

describe("browseLabel — divisioni", () => {
  test("la S di Robocinque S è un prodotto diverso, non una variante", () => {
    expect(browseLabel("COLOMBO", "ROBOCINQUE S ID71R CROMO")).toBe("ROBOCINQUE S");
  });

  test("senza la S resta il modello base", () => {
    expect(browseLabel("COLOMBO", "ROBOCINQUE ID61R CROMAT")).toBe("ROBOCINQUE");
  });

  // Sul listino vero Roboquattro S è scritto `S` 23 volte e `S'` 21: chi
  // guardasse solo la prima forma spaccherebbe il gruppo a metà in silenzio.
  test("l'apostrofo di ROBOQUATTRO S' è la stessa S", () => {
    expect(browseLabel("COLOMBO", "ROBOQUATTRO S' ID51R NEROMAT")).toBe("ROBOQUATTRO S");
  });

  // E una riga ha pure lo spazio mancante: `ROBOQUATTRO S'ID51RSB ZERO`.
  test("la S attaccata al codice dalla mancanza di uno spazio è la stessa S", () => {
    expect(browseLabel("COLOMBO", "ROBOQUATTRO S'ID51RSB ZERO")).toBe("ROBOQUATTRO S");
  });
});

/**
 * Il verso inverso: data un'etichetta curata, quali prime parole del listino la
 * producono. Serve al filtro SQL, che sa leggere solo la parola cruda.
 */
describe("sourceFirstWords", () => {
  test("un'etichetta fusa raccoglie anche la parola storta", () => {
    expect(sourceFirstWords("COLOMBO", "BOCCHETTA")).toEqual(["BOCCEHTTA", "BOCCHETTA"]);
  });

  test("un'etichetta divisa risale al gruppo da cui è stata staccata", () => {
    expect(sourceFirstWords("COLOMBO", "ROBOCINQUE S")).toEqual(["ROBOCINQUE"]);
  });

  test("il gruppo base di una divisione raccoglie anche il suo refuso", () => {
    expect(sourceFirstWords("COLOMBO", "ROBOCINQUE")).toEqual(["ROBOCINQUE", "ROBOCINQUQ"]);
  });

  // Senza questo, `?tipo=VITE` nell'URL rimetterebbe a schermo un gruppo che
  // abbiamo tolto dall'elenco: nascosto dalla vista, raggiungibile a mano.
  test("un'etichetta esclusa non ha sorgenti: non è raggiungibile nemmeno dall'URL", () => {
    expect(sourceFirstWords("COLOMBO", "VITE")).toEqual([]);
  });

  test("un'etichetta non toccata è la sua sola sorgente", () => {
    expect(sourceFirstWords("COLOMBO", "ALBA")).toEqual(["ALBA"]);
  });
});

/**
 * Il livello 1 conta in SQL e cura in TypeScript: il `GROUP BY` non sa nulla di
 * fusioni e divisioni, e la regola di dominio non deve finire in una query.
 */
describe("foldBrowseGroups", () => {
  test("le due etichette della rosetta diventano una voce sola, con la somma", () => {
    expect(
      foldBrowseGroups("COLOMBO", [
        { first: "ROS.", second: "OTT.", count: 58 },
        { first: "ROSETTA", second: "PB01", count: 47 },
      ]),
    ).toEqual([{ word: "ROSETTA", count: 105 }]);
  });

  test("un gruppo diviso conta le sue due metà separatamente", () => {
    expect(
      foldBrowseGroups("COLOMBO", [
        { first: "ROBOCINQUE", second: "ID61R", count: 49 },
        { first: "ROBOCINQUE", second: "S", count: 54 },
      ]),
    ).toEqual([
      { word: "ROBOCINQUE", count: 49 },
      { word: "ROBOCINQUE S", count: 54 },
    ]);
  });

  test("un'etichetta esclusa non compare, e non lascia una voce a zero", () => {
    expect(foldBrowseGroups("COLOMBO", [{ first: "VITE", second: "M4X25", count: 21 }])).toEqual([]);
  });

  test("l'ordine è alfabetico italiano, come la schermata promette", () => {
    expect(
      foldBrowseGroups("COLOMBO", [
        { first: "ZELDA", second: "MM11R", count: 26 },
        { first: "ALBA", second: "LC91R", count: 21 },
      ]).map((g) => g.word),
    ).toEqual(["ALBA", "ZELDA"]);
  });
});

/**
 * Le fusioni chieste dal titolare il 2026-08-05, dopo aver usato lo sfoglio
 * vero. Cercate confrontando TUTTE e 102 le etichette a coppie, non ricordate:
 * lui ne aveva citate due, e la ricerca sistematica ne ha trovate sette.
 */
describe("browseLabel — le fusioni del 2026-08-05", () => {
  test.each([
    // Misurato: 56 righe su 57 di `MANIG.`, 4 su 4, 28 su 28, 1 su 1 dicono
    // «INCASSO». La voce fusa lo dice, o prometterebbe tutte le maniglie e ne
    // conterebbe 90 mentre le 129 di ROBOT stanno in un'altra voce.
    ["MANIG. INCASSO CB111CF CROMAT", "MANIGLIA INCASSO"],
    ["MANIG.INCASSO CD511 BRONZO AN.", "MANIGLIA INCASSO"],
    ["MANIGLIA INCASSO ID411", "MANIGLIA INCASSO"],
    ["MANIGLIE INCASSO Q PER A/S", "MANIGLIA INCASSO"],
    ["MANIGLIONI AM213Y ACC.A/S CRMT", "MANIGLIONE"],
    ["PL.OTT. 85mm. + SOTTOPL.NYLON", "PL."],
    ["PL.OTT.YALE 93mm+SOTTOPL.NYLON", "PL."],
    ["RG ADAPTOR PER DUMMY", "DUMMY"],
  ])("«%s» si elenca sotto %s", (name, atteso) => {
    expect(browseLabel("COLOMBO", name)).toBe(atteso);
  });

  test("MANIG.CD213 NON entra fra le maniglie da incasso: è uno scorrevole", () => {
    expect(browseLabel("COLOMBO", "MANIG.CD213 SCOR.COMPLAN. CM")).toBe("MANIG.CD213");
  });

  /**
   * Fonderlo in LUND farebbe ereditare a una CREMONESE la foto di una maniglia:
   * `abbinaFoto` assegna le foto di modello per etichetta di sfoglio, e LUND ha
   * un archivio fotografico. Una foto che esiste, si vede benissimo, ed è di un
   * altro prodotto — la lezione che il progetto ha già pagato con la variante
   * ZERO. Verificato caso per caso: è l'unica delle sette con questa
   * conseguenza.
   */
  test("LUNDCREM resta fuori da LUND: erediterebbe la foto sbagliata", () => {
    expect(browseLabel("COLOMBO", "LUNDCREM SE12 GRAFITE MAT")).toBe("LUNDCREM");
  });

  test("PLACCA non si fonde con PL.: stessa parola, due prodotti", () => {
    // PL.* sono placche in ottone `PB02*` con sottoplacca in nylon; PLACCA è
    // la placca dei maniglioni, codici `0AM113PL*`.
    expect(browseLabel("COLOMBO", "PLACCA AM113 CROMAT")).toBe("PLACCA");
  });

  test("le sorgenti dell'etichetta fusa comprendono tutte e quattro le grafie", () => {
    expect(sourceFirstWords("COLOMBO", "MANIGLIA INCASSO")).toEqual([
      "MANIG.",
      "MANIG.INCASSO",
      "MANIGLIA",
      "MANIGLIA INCASSO",
      "MANIGLIE",
    ]);
  });

  test("PL. resta una sorgente di se stessa, oltre alle due fuse", () => {
    expect(sourceFirstWords("COLOMBO", "PL.")).toEqual(["PL.", "PL.OTT.", "PL.OTT.YALE"]);
  });
});

/**
 * Il reparto ospiterà almeno altre quattro marche (HOPPE, OLIVARI, DND,
 * GHIDINI), ognuna con le sue etichette storte. Senza la chiave per marca, il
 * giorno di HOPPE le correzioni scritte guardando il listino COLOMBO si
 * applicherebbero in silenzio alle sue: nessun conteggio andrebbe a zero.
 */
describe("la curatela è per marca", () => {
  test("una marca senza curatela non riceve le correzioni di COLOMBO", () => {
    expect(browseLabel("HOPPE", "ROS. OTT. + SOTTOR. NYLON + 5")).toBe("ROS.");
    expect(browseLabel("HOPPE", "VITE M4x25 TC+")).toBe("VITE");
    expect(browseLabel("HOPPE", "ROBOQUATTRO S' ID51R NEROMAT")).toBe("ROBOQUATTRO");
  });

  test("nemmeno il verso inverso attraversa le marche", () => {
    expect(sourceFirstWords("HOPPE", "ROSETTA")).toEqual(["ROSETTA"]);
    expect(foldBrowseGroups("HOPPE", [{ first: "VITE", second: "M4X25", count: 3 }])).toEqual([
      { word: "VITE", count: 3 },
    ]);
  });

  test("vociCuratela elenca le prime parole citate dalle tabelle di quella marca", () => {
    expect(vociCuratela("COLOMBO")).toContain("BOCCEHTTA");
    expect(vociCuratela("COLOMBO")).toContain("RONDELLE");
    expect(vociCuratela("COLOMBO")).toContain("MANIG.");
    expect(vociCuratela("HOPPE")).toEqual([]);
  });
});
