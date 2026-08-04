import { describe, it, expect } from "vitest";
import {
  abbinaFoto,
  ARCHIVI,
  chiaveFoto,
  finituraDiFoto,
  scattoDiProdotto,
  varianteZero,
  type ArticoloDaAbbinare,
  type FotoArchivio,
} from "./foto-archivio";

describe("tabella degli archivi", () => {
  it("copre tutti e 79 gli archivi dell'area download", () => {
    expect(Object.keys(ARCHIVI)).toHaveLength(79);
  });

  it("la serie esiste solo dove un'etichetta ha più archivi", () => {
    // ROBOT, ONE e DUE: due archivi ciascuno, separati dalla serie di codice.
    expect(ARCHIVI["01_Robot1_m"]).toEqual({ etichetta: "ROBOT", serie: "CD41" });
    expect(ARCHIVI["01_Robot1_p"]).toEqual({ etichetta: "ROBOT", serie: "CD75" });
    expect(ARCHIVI["01_One"]).toEqual({ etichetta: "ONE", serie: "CC11" });
    expect(ARCHIVI["01_One Q"]).toEqual({ etichetta: "ONE", serie: "CC21" });
    expect(ARCHIVI["01_Due"]).toEqual({ etichetta: "DUE", serie: "CC31" });
    expect(ARCHIVI["01_Due Q"]).toEqual({ etichetta: "DUE", serie: "CC41" });
  });

  it("un archivio con etichetta unica NON dichiara una serie", () => {
    // La serie è il rimedio a un'ambiguità: metterla dove l'ambiguità non c'è
    // sarebbe un vincolo in più che può solo togliere foto in silenzio.
    expect(ARCHIVI["01_Fedra"]).toEqual({ etichetta: "FEDRA" });
    expect(ARCHIVI["01_Robot4"]).toEqual({ etichetta: "ROBOQUATTRO" });
  });

  it("gli archivi la cui serie NON è scritta da nessuna parte non hanno etichetta", () => {
    // MR11 vs MR15, LC31 vs LC41, LC71 vs LC81: l'ordinale della cartella non è
    // la serie, e nessuna fonte di COLOMBO le accoppia. Indovinare produrrebbe
    // una foto giusta di un prodotto sbagliato — che non dà errori né warning.
    for (const a of [
      "01_Spider_m",
      "01_Spider_p",
      "01_Milla_1",
      "01_Milla_2",
      "01_Trama_1",
      "01_Trama_2",
    ]) {
      expect(ARCHIVI[a], a).toEqual({ etichetta: null });
    }
  });

  it("i cinque prodotti non ancora a listino non hanno etichetta", () => {
    for (const a of ["00a_Laconica", "00b_Robot6", "00c_Robot6S", "00d_Halo", "00e_Kubo"]) {
      expect(ARCHIVI[a]?.etichetta, a).toBeNull();
    }
  });

  it("i sei archivi di accessori non si agganciano per etichetta", () => {
    // Lì il codice è scritto nel nome del file: ci pensa il gradino 3.
    for (const a of [
      "02_Pomoli",
      "03_Maniglioni_Pulls",
      "04_Incasso_Flush handles",
      "05_Blindate_Armored door",
      "06_Complementi",
      "07_Kombo_Box",
    ]) {
      expect(ARCHIVI[a]?.etichetta, a).toBeNull();
    }
  });

  it("nessuna etichetta è dichiarata da due archivi senza una serie che li separi", () => {
    // È l'invariante che tiene in piedi il gradino 1: se due archivi finissero
    // sulla stessa etichetta senza serie, la foto verrebbe scelta a caso fra due
    // prodotti diversi — e nulla andrebbe a zero.
    const perEtichetta = new Map<string, number>();
    for (const voce of Object.values(ARCHIVI)) {
      if (voce.etichetta === null || voce.serie) continue;
      perEtichetta.set(voce.etichetta, (perEtichetta.get(voce.etichetta) ?? 0) + 1);
    }
    expect([...perEtichetta.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });
});

describe("tipo di scatto", () => {
  it("scarta gli scatti d'ambiente", () => {
    // `Robo4_def.jpg`: 8268×7087, 34 MB, la maniglia su fondo colorato.
    expect(scattoDiProdotto("Robo4_def")).toBe(false);
    expect(scattoDiProdotto("Bold m_def")).toBe(false);
    expect(scattoDiProdotto("Mood 2_IMG_0033")).toBe(false);
    expect(scattoDiProdotto("03_Mood ocean")).toBe(false);
  });

  it("tiene gli scatti di prodotto", () => {
    expect(scattoDiProdotto("Fedra_1OL")).toBe(true);
    expect(scattoDiProdotto("bold_45")).toBe(true);
    expect(scattoDiProdotto("roboquattro cromo matte")).toBe(true);
    expect(scattoDiProdotto("ID313 RS_45")).toBe(true);
  });

  it("«def» dentro una parola non è il suffisso", () => {
    expect(scattoDiProdotto("defender_1CR")).toBe(true);
  });
});

describe("finitura dal nome del file", () => {
  it("legge la coda numerata quando è una delle 31", () => {
    expect(finituraDiFoto("Fedra_1OL")).toBe("OL");
    expect(finituraDiFoto("roboquattro-3CR")).toBe("CR");
    expect(finituraDiFoto("robot41_4NM_new")).toBe("NM");
    expect(finituraDiFoto("roboquattroS_5VM")).toBe("VM");
  });

  it("non legge le parole per esteso", () => {
    // `cromo` è scritto in italiano in 106 nomi e `bronze` in inglese in 18: due
    // lingue e nessun elenco chiuso. La finitura si legge SOLO dove COLOMBO ha
    // scritto il suo codice.
    expect(finituraDiFoto("roboquattro cromo matte")).toBeNull();
    expect(finituraDiFoto("due frontale bronze")).toBeNull();
  });

  it("i bicolori non sono una delle 31", () => {
    expect(finituraDiFoto("milla1_1OLOM")).toBeNull();
    expect(finituraDiFoto("trama2_1CMCR")).toBeNull();
  });

  it("una coda di due lettere che non è una finitura non conta", () => {
    expect(finituraDiFoto("pb03_NE")).toBeNull();
  });
});

describe("variante ZERO", () => {
  it("la riconosce da entrambi i lati, come parola intera", () => {
    expect(varianteZero("roboquattro zero frontale oroplus_new")).toBe(true);
    expect(varianteZero("ROBOQUATTRO ID41RSB ZERO")).toBe(true);
    expect(varianteZero("roboquattro-1OL")).toBe(false);
    expect(varianteZero("FEDRA AC11R CROMAT")).toBe(false);
  });

  it("non si fa ingannare da una sottostringa", () => {
    expect(varianteZero("zerbino")).toBe(false);
    expect(varianteZero("MEZZERO")).toBe(false);
  });
});

describe("chiave Blob", () => {
  it("è derivata dalla sorgente, tutta minuscola", () => {
    expect(chiaveFoto("01_Fedra", "Fedra_1OL")).toBe("maniglie/colombo/01-fedra/fedra-1ol");
    expect(chiaveFoto("01_Due Q", "dueq frontale black")).toBe(
      "maniglie/colombo/01-due-q/dueq-frontale-black",
    );
    expect(chiaveFoto("03_Maniglioni_Pulls", "ID313 RS_45")).toBe(
      "maniglie/colombo/03-maniglioni-pulls/id313-rs-45",
    );
  });

  it("gli accenti non lasciano trattini di troppo ai bordi", () => {
    expect(chiaveFoto("01_Alato", "Alatò_1CR")).toBe("maniglie/colombo/01-alato/alat-1cr");
  });
});

/** Un articolo come lo restituisce Prisma, senza ripetere `codeNorm` ogni volta. */
const art = (code: string, name: string): ArticoloDaAbbinare => ({
  id: code,
  code,
  codeNorm: code.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
  name,
});

describe("abbinamento articolo → foto", () => {
  const fedra: FotoArchivio[] = [
    { archivio: "01_Fedra", nome: "Fedra_1OL" },
    { archivio: "01_Fedra", nome: "Fedra_2CR" },
    { archivio: "01_Fedra", nome: "Fedra_def" },
  ];

  it("gradino 2: la finitura esatta vince sulla foto di modello", () => {
    const m = abbinaFoto([art("0AC11R-CR", "FEDRA AC11R CROMO")], fedra);
    expect(m.get("0AC11R-CR")).toBe("maniglie/colombo/01-fedra/fedra-2cr");
  });

  it("gradino 1: senza la sua finitura prende la foto del modello", () => {
    const m = abbinaFoto([art("0AC11R-VM", "FEDRA AC11R VINTAGE SAT.")], fedra);
    expect(m.get("0AC11R-VM")).toBe("maniglie/colombo/01-fedra/fedra-1ol");
  });

  it("non usa mai uno scatto d'ambiente, nemmeno come ultima risorsa", () => {
    const m = abbinaFoto(
      [art("0AC11R-VM", "FEDRA AC11R VINTAGE SAT.")],
      [{ archivio: "01_Fedra", nome: "Fedra_def" }],
    );
    expect(m.size).toBe(0);
  });

  it("gradino 3: il codice scritto nel nome del file vince su tutto", () => {
    const m = abbinaFoto(
      [art("0ID313RS-CM", "MANIGLIONE ID313RS CROMAT")],
      [{ archivio: "03_Maniglioni_Pulls", nome: "ID313 RS_45" }],
    );
    expect(m.get("0ID313RS-CM")).toBe("maniglie/colombo/03-maniglioni-pulls/id313-rs-45");
  });

  it("fra due nomi che contengono il codice vince quello che dice di più", () => {
    const m = abbinaFoto(
      [art("0PB1304-CR", "BLINDATA PB1304 CROMO")],
      [
        { archivio: "05_Blindate_Armored door", nome: "PB13" },
        { archivio: "05_Blindate_Armored door", nome: "PB1304" },
      ],
    );
    expect(m.get("0PB1304-CR")).toBe("maniglie/colombo/05-blindate-armored-door/pb1304");
  });

  it("la variante ZERO non riceve la foto liscia, e viceversa", () => {
    const foto: FotoArchivio[] = [
      { archivio: "01_Robot4", nome: "roboquattro-1OL" },
      { archivio: "01_Robot4", nome: "roboquattro zero frontale oroplus_new" },
    ];
    const m = abbinaFoto(
      [
        art("0ID41R-OL", "ROBOQUATTRO ID41R OROPLUS"),
        art("0ID41RSB/0-OL", "ROBOQUATTRO ID41RSB ZERO"),
      ],
      foto,
    );
    expect(m.get("0ID41R-OL")).toBe("maniglie/colombo/01-robot4/roboquattro-1ol");
    expect(m.get("0ID41RSB/0-OL")).toBe(
      "maniglie/colombo/01-robot4/roboquattro-zero-frontale-oroplus-new",
    );
  });

  it("un articolo ZERO senza foto ZERO resta senza foto", () => {
    const m = abbinaFoto(
      [art("0ID41RSB/0-OL", "ROBOQUATTRO ID41RSB ZERO")],
      [{ archivio: "01_Robot4", nome: "roboquattro-1OL" }],
    );
    expect(m.size).toBe(0);
  });

  it("la serie separa i due archivi di uno stesso gruppo", () => {
    const foto: FotoArchivio[] = [
      { archivio: "01_Robot1_m", nome: "robot41_2CR" },
      { archivio: "01_Robot1_p", nome: "robot75_3CR" },
    ];
    const m = abbinaFoto(
      [art("0CD41R-CR", "ROBOT CD41R CROMO"), art("0CD75R-CR", "ROBOT CD75R CROMO")],
      foto,
    );
    expect(m.get("0CD41R-CR")).toBe("maniglie/colombo/01-robot1-m/robot41-2cr");
    expect(m.get("0CD75R-CR")).toBe("maniglie/colombo/01-robot1-p/robot75-3cr");
  });

  it("una serie che non combacia non presta la foto", () => {
    // ROBOT CD45 è un pomolo che non ha un archivio proprio: nessuno dei due
    // archivi di ROBOT è suo, e prendersi il primo sarebbe una foto sbagliata.
    const m = abbinaFoto(
      [art("0CD45R-CR", "ROBOT CD45R CROMO")],
      [{ archivio: "01_Robot1_m", nome: "robot41_2CR" }],
    );
    expect(m.size).toBe(0);
  });

  it("un archivio senza etichetta non presta la sua foto a nessuno", () => {
    // SPIDER: due archivi, accoppiamento archivio↔serie non scritto.
    const m = abbinaFoto(
      [art("0MR11R-CM", "SPIDER MR11R CROMAT")],
      [{ archivio: "01_Spider_m", nome: "spider1_1CR" }],
    );
    expect(m.size).toBe(0);
  });

  it("un articolo che non si sfoglia può comunque avere la foto dal suo codice", () => {
    // `VITE` è esclusa dallo sfoglio (curatela), quindi non ha etichetta — ma il
    // gradino 3 è un'affermazione di COLOMBO su un codice, e vale lo stesso.
    const m = abbinaFoto(
      [art("0CD79BZG-CR", "VITE CD79BZG CROMO")],
      [{ archivio: "06_Complementi", nome: "CD79_BZG" }],
    );
    expect(m.get("0CD79BZG-CR")).toBe("maniglie/colombo/06-complementi/cd79-bzg");
  });

  it("un nucleo corto non aggancia per caso", () => {
    // `BR` (VIOLA AR21R VINTAGE LUCIDO) è un codice di due caratteri: sotto i
    // cinque, un nucleo comparirebbe dentro quasi qualunque nome di file.
    const m = abbinaFoto(
      [art("BR", "VIOLA AR21R VINTAGE LUCIDO")],
      [{ archivio: "06_Complementi", nome: "abrx_CR" }],
    );
    expect(m.get("BR")).toBeUndefined();
  });

  it("è deterministico: l'ordine di lettura degli zip non cambia la chiave", () => {
    const foto: FotoArchivio[] = [
      { archivio: "01_Fedra", nome: "Fedra_2CR" },
      { archivio: "01_Fedra", nome: "Fedra_1OL" },
    ];
    const a = art("0AC11R-VM", "FEDRA AC11R VINTAGE SAT.");
    expect(abbinaFoto([a], foto).get(a.id)).toBe(abbinaFoto([a], [...foto].reverse()).get(a.id));
  });
});
