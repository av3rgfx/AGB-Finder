import { describe, it, expect } from "vitest";
import {
  abbinaFoto,
  ARCHIVI,
  FILE_MODELLO,
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

  it("nessuna etichetta è dichiarata due volte senza una serie che le separi", () => {
    // È l'invariante che tiene in piedi il gradino 1: se due sorgenti finissero
    // sulla stessa etichetta senza serie, la foto verrebbe scelta a caso fra due
    // prodotti diversi — e nulla andrebbe a zero. Guarda ENTRAMBE le tabelle:
    // controllarne una sola lascerebbe scoperto proprio il caso misto.
    const perEtichetta = new Map<string, number>();
    for (const voce of [...Object.values(ARCHIVI), ...Object.values(FILE_MODELLO)]) {
      if (voce.etichetta === null || voce.serie) continue;
      perEtichetta.set(voce.etichetta, (perEtichetta.get(voce.etichetta) ?? 0) + 1);
    }
    expect([...perEtichetta.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });

  it("nessuna coppia (etichetta, serie) è dichiarata da due sorgenti", () => {
    const viste = new Set<string>();
    const doppie: string[] = [];
    for (const voce of [...Object.values(ARCHIVI), ...Object.values(FILE_MODELLO)]) {
      if (voce.etichetta === null || !voce.serie) continue;
      const k = `${voce.etichetta}|${voce.serie}`;
      if (viste.has(k)) doppie.push(k);
      viste.add(k);
    }
    expect(doppie).toEqual([]);
  });
});

describe("le regole per singolo FILE, dentro un archivio di accessori", () => {
  it("dichiarano etichetta e serie per i pomoli che il listino nomina", () => {
    // L'indice del listino COLOMBO, sezione «pomoli»: «130 round ID25»,
    // «131 round ID35», «132 square LC25», «133 square LC35», «124 cut MS15»,
    // «125 cut MS25», «128 robot CD45», «129 robot CD55», «129 robot CD65».
    expect(FILE_MODELLO["02_Pomoli/round25_45"]).toEqual({ etichetta: "ROUND", serie: "ID25" });
    expect(FILE_MODELLO["02_Pomoli/square35_45"]).toEqual({ etichetta: "SQUARE", serie: "LC35" });
    expect(FILE_MODELLO["02_Pomoli/cut15_45"]).toEqual({ etichetta: "CUT", serie: "MS15" });
    expect(FILE_MODELLO["02_Pomoli/robot45_45"]).toEqual({ etichetta: "ROBOT", serie: "CD45" });
  });

  it("un gruppo con un file solo non ha bisogno di una serie", () => {
    // PUSH: cinque codici, tutti LC55, e un unico `push_45.jpg`. Dichiarare una
    // serie qui sarebbe un vincolo che non separa nulla.
    expect(FILE_MODELLO["02_Pomoli/push_45"]).toEqual({ etichetta: "PUSH" });
  });

  it("il pomolo della MOOD Collection è scritto da entrambe le parti", () => {
    // Il listino dice «POMOLO ONE …» (CC15) e «POMOLO ONE Q …» (CC25); i file si
    // chiamano «pomolo one strawberry red» e «pomolo one q lime green».
    expect(FILE_MODELLO["02_Pomoli/pomolo one strawberry red"]).toEqual({
      etichetta: "POMOLO",
      serie: "CC15",
    });
    expect(FILE_MODELLO["02_Pomoli/pomolo one q lime green"]).toEqual({
      etichetta: "POMOLO",
      serie: "CC25",
    });
  });

  it("riguardano SOLO archivi che non hanno un'etichetta propria", () => {
    // Una regola per file dentro un archivio di modello sarebbe una seconda
    // verità sullo stesso insieme di foto.
    for (const chiave of Object.keys(FILE_MODELLO)) {
      const archivio = chiave.slice(0, chiave.indexOf("/"));
      expect(ARCHIVI[archivio]?.etichetta, chiave).toBeNull();
    }
  });

  it("i pomoli dei modelli che hanno già la loro maniglia restano fuori", () => {
    // `bold_45`, `daytona_45`, `drop_45`, `mapo_45`, `Moon_45`, `spider_45`:
    // quei gruppi sono già coperti dall'archivio della maniglia, e sapere quale
    // serie è il pomolo non è scritto da nessuna parte. Stessa ragione di
    // SPIDER/MILLA/TRAMA: un pomolo su un codice di maniglia non dà errori.
    for (const nome of ["bold_45", "daytona_45", "drop_45", "mapo_45", "Moon_45", "spider_45"]) {
      expect(FILE_MODELLO[`02_Pomoli/${nome}`], nome).toBeUndefined();
    }
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

  /**
   * Questo test diceva l'OPPOSTO — «non legge le parole per esteso, sono due
   * lingue e nessun elenco chiuso» — ed era la codifica di una limitazione, non
   * la sentinella di una scelta. L'elenco chiuso esiste: sono le 31 finiture
   * pubblicate, e le loro grafie reali stanno in `finiture.ts`.
   *
   * Costava caro: 268 file su 638 dicono la finitura a parole, ed è la ragione
   * per cui tutti gli otto `0CC31R-C0x` mostravano la maniglia blu.
   */
  it("legge anche le parole per esteso, ed erano 268 file su 638", () => {
    expect(finituraDiFoto("roboquattro cromo matte")).toBe("CM");
    expect(finituraDiFoto("due frontale bronze")).toBe("C02");
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
    const m = abbinaFoto("COLOMBO", [art("0AC11R-CR", "FEDRA AC11R CROMO")], fedra);
    expect(m.get("0AC11R-CR")).toBe("maniglie/colombo/01-fedra/fedra-2cr");
  });

  /**
   * Questo test diceva l'OPPOSTO: senza la propria finitura, l'articolo
   * ripiegava sulla prima foto del modello in ordine alfabetico. Era il difetto
   * segnalato da Andrea, in miniatura — un FEDRA vintage che mostra un FEDRA
   * oroplus, con la stessa sicurezza di una foto giusta.
   *
   * Dal 2026-08-05 la foto è contesa (OL e CR la reclamano insieme a VM) e
   * resta solo a chi la dimostra sua.
   */
  it("gradino 1: senza la sua finitura NON ripiega su quella di un altro", () => {
    const m = abbinaFoto("COLOMBO", [art("0AC11R-VM", "FEDRA AC11R VINTAGE SAT.")], fedra);
    expect(m.has("0AC11R-VM")).toBe(false);
  });

  /**
   * Ma se la foto non è contesa da nessuno resta, anche senza poter provare la
   * finitura: togliere qui non renderebbe più onesto niente, e il modello è
   * comunque quello giusto.
   */
  it("gradino 1: una foto che nessuno si contende resta", () => {
    const m = abbinaFoto("COLOMBO", [art("0AC11R-VM", "FEDRA AC11R VINTAGE SAT.")], [
      { archivio: "01_Fedra", nome: "Fedra_frontale" },
    ]);
    expect(m.get("0AC11R-VM")).toBe(chiaveFoto("01_Fedra", "Fedra_frontale"));
  });

  it("non usa mai uno scatto d'ambiente, nemmeno come ultima risorsa", () => {
    const m = abbinaFoto("COLOMBO", 
      [art("0AC11R-VM", "FEDRA AC11R VINTAGE SAT.")],
      [{ archivio: "01_Fedra", nome: "Fedra_def" }],
    );
    expect(m.size).toBe(0);
  });

  it("gradino 3: il codice scritto nel nome del file vince su tutto", () => {
    const m = abbinaFoto("COLOMBO", 
      [art("0ID313RS-CM", "MANIGLIONE ID313RS CROMAT")],
      [{ archivio: "03_Maniglioni_Pulls", nome: "ID313 RS_45" }],
    );
    expect(m.get("0ID313RS-CM")).toBe("maniglie/colombo/03-maniglioni-pulls/id313-rs-45");
  });

  it("fra due nomi che contengono il codice vince quello che dice di più", () => {
    const m = abbinaFoto("COLOMBO", 
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
    const m = abbinaFoto("COLOMBO", 
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
    const m = abbinaFoto("COLOMBO", 
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
    const m = abbinaFoto("COLOMBO", 
      [art("0CD41R-CR", "ROBOT CD41R CROMO"), art("0CD75R-CR", "ROBOT CD75R CROMO")],
      foto,
    );
    expect(m.get("0CD41R-CR")).toBe("maniglie/colombo/01-robot1-m/robot41-2cr");
    expect(m.get("0CD75R-CR")).toBe("maniglie/colombo/01-robot1-p/robot75-3cr");
  });

  it("una serie che non combacia non presta la foto", () => {
    // ROBOT CD45 è un pomolo che non ha un archivio proprio: nessuno dei due
    // archivi di ROBOT è suo, e prendersi il primo sarebbe una foto sbagliata.
    const m = abbinaFoto("COLOMBO", 
      [art("0CD45R-CR", "ROBOT CD45R CROMO")],
      [{ archivio: "01_Robot1_m", nome: "robot41_2CR" }],
    );
    expect(m.size).toBe(0);
  });

  it("un archivio senza etichetta non presta la sua foto a nessuno", () => {
    // SPIDER: due archivi, accoppiamento archivio↔serie non scritto.
    const m = abbinaFoto("COLOMBO", 
      [art("0MR11R-CM", "SPIDER MR11R CROMAT")],
      [{ archivio: "01_Spider_m", nome: "spider1_1CR" }],
    );
    expect(m.size).toBe(0);
  });

  it("un articolo che non si sfoglia può comunque avere la foto dal suo codice", () => {
    // `VITE` è esclusa dallo sfoglio (curatela), quindi non ha etichetta — ma il
    // gradino 3 è un'affermazione di COLOMBO su un codice, e vale lo stesso.
    const m = abbinaFoto("COLOMBO", 
      [art("0CD79BZG-CR", "VITE CD79BZG CROMO")],
      [{ archivio: "06_Complementi", nome: "CD79_BZG" }],
    );
    expect(m.get("0CD79BZG-CR")).toBe("maniglie/colombo/06-complementi/cd79-bzg");
  });

  it("un nucleo corto non aggancia per caso", () => {
    // `BR` (VIOLA AR21R VINTAGE LUCIDO) è un codice di due caratteri: sotto i
    // cinque, un nucleo comparirebbe dentro quasi qualunque nome di file.
    const m = abbinaFoto("COLOMBO", 
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
    expect(abbinaFoto("COLOMBO", [a], foto).get(a.id)).toBe(abbinaFoto("COLOMBO", [a], [...foto].reverse()).get(a.id));
  });
});

describe("abbinamento con le regole per file", () => {
  it("un pomolo generico prende la foto del suo file, non quella dell'archivio", () => {
    const m = abbinaFoto("COLOMBO", 
      [art("0ID25R-CR", "ROUND ID25R CROMO"), art("0ID35R-CR", "ROUND ID35R CROMO")],
      [
        { archivio: "02_Pomoli", nome: "round25_45" },
        { archivio: "02_Pomoli", nome: "round35_45" },
      ],
    );
    expect(m.get("0ID25R-CR")).toBe("maniglie/colombo/02-pomoli/round25-45");
    expect(m.get("0ID35R-CR")).toBe("maniglie/colombo/02-pomoli/round35-45");
  });

  it("i pomoli ROBOT non rubano la foto alla maniglia ROBOT", () => {
    const m = abbinaFoto("COLOMBO", 
      [art("0CD41R-CR", "ROBOT CD41R CROMO"), art("0CD45R-CR", "ROBOT CD45R CROMO")],
      [
        { archivio: "01_Robot1_m", nome: "robot41_2CR" },
        { archivio: "02_Pomoli", nome: "robot45_45" },
      ],
    );
    expect(m.get("0CD41R-CR")).toBe("maniglie/colombo/01-robot1-m/robot41-2cr");
    expect(m.get("0CD45R-CR")).toBe("maniglie/colombo/02-pomoli/robot45-45");
  });

  it("un file dell'archivio accessori senza regola non presta nulla per modello", () => {
    // `spider_45` è il pomolo Spider: il gruppo SPIDER non è decidibile, quindi
    // resta senza foto anche adesso.
    const m = abbinaFoto("COLOMBO", 
      [art("0MR11R-CM", "SPIDER MR11R CROMAT")],
      [{ archivio: "02_Pomoli", nome: "spider_45" }],
    );
    expect(m.size).toBe(0);
  });
});

/**
 * Le fusioni del 2026-08-05 mandano tre cremonesi dentro il gruppo della loro
 * maniglia (`HEIDI/PETER`→HEIDI, `LUNDCREM`→LUND). Senza guardia
 * erediterebbero la foto della maniglia — e la regola sulle finiture NON le
 * intercetta: `0CD32-UB` prenderebbe `Heidi_R_UB`, cioè finitura provata
 * GIUSTA e prodotto SBAGLIATO. È la stessa forma della trappola ZERO.
 *
 * La guardia è la `serie`, già usata per ROBOT (CD41/CD75) e MOOD (CC11/CC21).
 * ⚠️ La fonte qui è il LISTINO e non i nomi dei file: COLOMBO scrive
 * «HEIDI CD31R» contro «HEIDI/PETER CREM CD32». È scritta da lui, altrove.
 */
describe("le cremonesi non ereditano la foto della loro maniglia", () => {
  const foto: FotoArchivio[] = [
    { archivio: "01_Heidi", nome: "Heidi_R_UB" },
    { archivio: "01_Lund", nome: "lund_2CM" },
  ];

  it("la maniglia HEIDI la prende", () => {
    const m = abbinaFoto("COLOMBO", [art("0CD31R-UB", "HEIDI CD31R UMBER BRONZE")], foto);
    expect(m.get("0CD31R-UB")).toBe(chiaveFoto("01_Heidi", "Heidi_R_UB"));
  });

  it("la cremonese CD32 no, benché ora si elenchi sotto HEIDI", () => {
    const m = abbinaFoto("COLOMBO", [art("0CD32-UB", "HEIDI/PETER CREM CD32 UMBER")], foto);
    expect(m.has("0CD32-UB")).toBe(false);
  });

  it("la maniglia LUND la prende, la cremonese SE12 no", () => {
    const m = abbinaFoto(
      "COLOMBO",
      [art("0SE11R-CM", "LUND SE11R CROMAT"), art("0SE12-GM", "LUNDCREM SE12 GRAFITE MAT")],
      foto,
    );
    expect(m.get("0SE11R-CM")).toBe(chiaveFoto("01_Lund", "lund_2CM"));
    expect(m.has("0SE12-GM")).toBe(false);
  });

  /**
   * ⚠️ SCOPERTO MISURANDO LA GUARDIA, non prevedendolo: la `serie` toglie 11
   * foto e non 3, e le altre OTTO erano già sbagliate in produzione **prima**
   * della fusione di Andrea.
   *
   * Sono le cremonesi che COLOMBO scrive con lo SPAZIO (`LUND CREM SE12`) o
   * senza movimento (`HEIDI CD32DK SENZA MOV.`): la loro prima parola era già
   * LUND e HEIDI, quindi ricevevano la foto della maniglia da sempre, e nessun
   * conteggio andava a zero. La fusione non ha creato il difetto: l'ha reso
   * visibile portando qui anche i suoi fratelli scritti attaccati.
   */
  it("anche le cremonesi scritte con lo spazio, già sbagliate da prima", () => {
    const m = abbinaFoto(
      "COLOMBO",
      [
        art("0SE12-CM", "LUND CREM SE12 CROMAT"),
        art("0SE12DK/SM-CR", "LUND SE12DK SENZA MOV. CROMO"),
        art("0CD32DK/SM-OL", "HEIDI CD32DK SENZA MOV.OROPLUS"),
      ],
      foto,
    );
    expect(m.size).toBe(0);
  });
});

describe("finituraDiFoto legge entrambe le grafie di COLOMBO", () => {
  it("il codice, come prima", () => {
    expect(finituraDiFoto("Fedra_1OL")).toBe("OL");
    expect(finituraDiFoto("robot41_4NM_new")).toBe("NM");
  });

  // 268 file su 638: senza, l'archivio DUE sembrava avere una foto sola.
  it("e ora anche le parole", () => {
    expect(finituraDiFoto("due frontale capri blue")).toBe("C12");
    expect(finituraDiFoto("ama cromo matte")).toBe("CM");
  });

  it("un codice che COLOMBO non pubblica resta illeggibile, non indovinato", () => {
    // `OP` compare in 19 file e non è fra le 31: dedurre «Oroplus» sarebbe la
    // classe di errore che ha fatto disattivare i moduli kit PVC e battente.
    expect(finituraDiFoto("heidi_1OP")).toBeNull();
    expect(finituraDiFoto("Flessa_5NK")).toBeNull();
  });
});

/**
 * LA REGOLA (decisione dell'utente, 2026-08-05): **una foto contesa resta solo
 * a chi può dimostrare che è sua.**
 *
 * Andrea: «se mancano le foto delle giuste finiture è meglio togliere
 * direttamente le foto per quel prodotto, perché confondono e sono
 * fuorvianti». Misurato sul catalogo vero che aveva ragione con un margine:
 * 667 articoli si contendevano 72 file, quindi al più 72 mostravano la
 * finitura giusta e almeno 595 no. E si dimostra SENZA saper leggere la
 * finitura della foto — se n articoli di finiture diverse ricevono lo stesso
 * file, al più uno è giusto.
 */
describe("la foto contesa resta solo a chi la dimostra sua", () => {
  it("fra i contendenti resta solo quello provato", () => {
    // Un maniglione CC113/Q, dodici colori a listino e UNA foto in archivio:
    // è il caso che Andrea ha segnalato, al gradino 3.
    const m = abbinaFoto(
      "COLOMBO",
      ["C01", "C06", "C12"].map((f) =>
        art(`0CC113/Q-${f}`, "MANIGLIONE CC113 Q SINGOLO A/S"),
      ),
      [{ archivio: "03_Maniglioni_Pulls", nome: "CC113Q ocean blue" }],
    );
    expect([...m.keys()]).toEqual(["0CC113/Q-C06"]); // «ocean blue» è C06
  });

  it("una finitura provata DIVERSA non tiene la foto nemmeno da sola", () => {
    const m = abbinaFoto("COLOMBO", [art("0BD11R-NM", "ELLE BD11R NEROMAT RAL 9005")], [
      { archivio: "01_Elle", nome: "Elle_1CR" },
    ]);
    expect(m.size).toBe(0);
  });

  it("un file NON conteso resta anche se la sua finitura non si legge", () => {
    // `OP` non è fra le 31 pubblicate: la foto non afferma una finitura, e
    // nessun altro codice se la contende. Toglierla non renderebbe più onesto
    // niente.
    const m = abbinaFoto("COLOMBO", [art("0CD31R-OL", "HEIDI CD31R OROPLUS")], [
      { archivio: "01_Heidi", nome: "heidi_1OP" },
    ]);
    expect(m.get("0CD31R-OL")).toBe(chiaveFoto("01_Heidi", "heidi_1OP"));
  });

  it("un articolo senza coda di finitura non afferma nulla e tiene la foto", () => {
    const m = abbinaFoto("COLOMBO", [art("XKIT/PS", "KITPORTE SCORREVOLI OPER S/SER")], [
      { archivio: "06_Complementi", nome: "XKIT PS_45" },
    ]);
    expect(m.get("XKIT/PS")).toBe(chiaveFoto("06_Complementi", "XKIT PS_45"));
  });

  it("quando la foto della finitura giusta ESISTE, la contesa non si apre", () => {
    // È il caso DUE/ONE: l'archivio ha una foto per colore, e col
    // riconoscitore dei nomi ognuno prende la sua. Zero foto tolte.
    const m = abbinaFoto(
      "COLOMBO",
      [art("0CC31R-C12", "DUE CC31R CAPRI BLUE"), art("0CC31R-C09", "DUE CC31R LEMON YELLOW")],
      [
        { archivio: "01_Due", nome: "due frontale capri blue" },
        { archivio: "01_Due", nome: "due frontale lemon yellow" },
      ],
    );
    expect(m.get("0CC31R-C12")).toBe(chiaveFoto("01_Due", "due frontale capri blue"));
    expect(m.get("0CC31R-C09")).toBe(chiaveFoto("01_Due", "due frontale lemon yellow"));
  });
});
