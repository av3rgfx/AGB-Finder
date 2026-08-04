import { describe, expect, test } from "vitest";
import { browseLabel, sourceFirstWords } from "./curatela";

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
    expect(browseLabel(name)).toBe(atteso);
  });

  // Il codice dice quale dei due refusi è quale, e conferma Andrea: `ID61RSB`
  // è la serie del Robocinque base (la S usa `ID71*`), `CD92DK` è quella di
  // Robotre (Robot usa `CD4x`/`CD7x`). L'handoff dava ROBOTE per indecidibile.
  test("ROBOCINQUQ è il Robocinque base, non la S", () => {
    expect(browseLabel("ROBOCINQUQ ID61RSB ZERO OROPL.")).toBe("ROBOCINQUE");
  });

  test("ROBOTE è Robotre, e lo dice il suo codice CD92DK", () => {
    expect(browseLabel("ROBOTE CD92DK SENZA MOV. UMBER")).toBe("ROBOTRE");
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
    expect(browseLabel(name)).toBeNull();
  });

  // Andrea ha chiesto di togliere RONDELLA e non ha citato RONDELLE, che è la
  // stessa cosa al plurale. NON la tolgo di mia iniziativa: sulla sua tassonomia
  // la fonte di verità è lui. Il test fissa la scelta perché sia una decisione
  // visibile e non una dimenticanza.
  test("RONDELLE resta, perché Andrea non l'ha chiesta", () => {
    expect(browseLabel("RONDELLE BENZING")).toBe("RONDELLE");
  });
});

describe("browseLabel — divisioni", () => {
  test("la S di Robocinque S è un prodotto diverso, non una variante", () => {
    expect(browseLabel("ROBOCINQUE S ID71R CROMO")).toBe("ROBOCINQUE S");
  });

  test("senza la S resta il modello base", () => {
    expect(browseLabel("ROBOCINQUE ID61R CROMAT")).toBe("ROBOCINQUE");
  });

  // Sul listino vero Roboquattro S è scritto `S` 23 volte e `S'` 21: chi
  // guardasse solo la prima forma spaccherebbe il gruppo a metà in silenzio.
  test("l'apostrofo di ROBOQUATTRO S' è la stessa S", () => {
    expect(browseLabel("ROBOQUATTRO S' ID51R NEROMAT")).toBe("ROBOQUATTRO S");
  });

  // E una riga ha pure lo spazio mancante: `ROBOQUATTRO S'ID51RSB ZERO`.
  test("la S attaccata al codice dalla mancanza di uno spazio è la stessa S", () => {
    expect(browseLabel("ROBOQUATTRO S'ID51RSB ZERO")).toBe("ROBOQUATTRO S");
  });
});

/**
 * Il verso inverso: data un'etichetta curata, quali prime parole del listino la
 * producono. Serve al filtro SQL, che sa leggere solo la parola cruda.
 */
describe("sourceFirstWords", () => {
  test("un'etichetta fusa raccoglie anche la parola storta", () => {
    expect(sourceFirstWords("BOCCHETTA")).toEqual(["BOCCEHTTA", "BOCCHETTA"]);
  });

  test("un'etichetta divisa risale al gruppo da cui è stata staccata", () => {
    expect(sourceFirstWords("ROBOCINQUE S")).toEqual(["ROBOCINQUE"]);
  });

  test("il gruppo base di una divisione raccoglie anche il suo refuso", () => {
    expect(sourceFirstWords("ROBOCINQUE")).toEqual(["ROBOCINQUE", "ROBOCINQUQ"]);
  });

  // Senza questo, `?tipo=VITE` nell'URL rimetterebbe a schermo un gruppo che
  // abbiamo tolto dall'elenco: nascosto dalla vista, raggiungibile a mano.
  test("un'etichetta esclusa non ha sorgenti: non è raggiungibile nemmeno dall'URL", () => {
    expect(sourceFirstWords("VITE")).toEqual([]);
  });

  test("un'etichetta non toccata è la sua sola sorgente", () => {
    expect(sourceFirstWords("ALBA")).toEqual(["ALBA"]);
  });
});
