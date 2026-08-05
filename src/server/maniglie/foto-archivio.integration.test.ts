import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  abbinaFoto,
  ARCHIVI,
  chiaveFoto,
  finituraDiFoto,
  scattoDiProdotto,
  FILE_MODELLO,
  varianteZero,
  type FotoArchivio,
} from "./foto-archivio";
import { browseLabel } from "./curatela";
import { finituraDiCodice } from "./finiture";

/**
 * LA GUARDIA DELLA COPERTURA, sul catalogo vero.
 *
 * Girano insieme due cose che i test unitari non possono avere: i 3.456 codici
 * del listino `LP 02-26` e i 707 nomi dell'archivio COLOMBO. Senza, la tabella
 * degli archivi è un elenco di stringhe che nessuno confronta con la realtà.
 *
 * È la lezione del `widthMm: 550` del kit: una copertura che si restringe non fa
 * fallire nulla e nessun conteggio va a zero. Qui il pavimento è esplicito.
 *
 * L'indice delle foto arriva da un file JSON e NON dal repo: i nomi sono dati del
 * fornitore e il repo è pubblico. Si produce con
 *   `pnpm foto:colombo --dry-run --dump /tmp/foto.json`
 * e si passa in `COLOMBO_FOTO_INDEX`. Senza le due variabili il gate si salta,
 * dichiarandolo.
 */
const url = process.env.INTEGRATION_DATABASE_URL;
const indice = process.env.COLOMBO_FOTO_INDEX;
const attivo = Boolean(url) && Boolean(indice);

describe.skipIf(!attivo)("foto ↔ catalogo vero", () => {
  let db: PrismaClient;
  let articoli: { id: string; code: string; codeNorm: string; name: string }[];
  let foto: FotoArchivio[];
  let abbinati: Map<string, string>;
  /** chiave Blob → nome del file scelto: serve a rileggerne la finitura. */
  let nomePerChiave: Map<string, string>;

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    articoli = await db.article.findMany({
      where: { brand: "COLOMBO" },
      select: { id: true, code: true, codeNorm: true, name: true },
    });
    foto = JSON.parse(readFileSync(indice!, "utf8")) as FotoArchivio[];
    abbinati = abbinaFoto("COLOMBO", articoli, foto);
    nomePerChiave = new Map(
      foto
        .filter((f) => scattoDiProdotto(f.nome))
        .map((f) => [chiaveFoto(f.archivio, f.nome), f.nome]),
    );
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("gira sul listino vero, non sulle venti righe del seed", () => {
    expect(articoli.length).toBeGreaterThan(3000);
    expect(foto.length).toBeGreaterThan(600);
  });

  /**
   * ⚠️ Il pavimento è SOSTITUITO, non allentato. Diceva «almeno il 60%», e la
   * copertura scende di proposito a **46,5%** perché 511 foto mostravano la
   * finitura di un altro codice. Cambiare la soglia senza dirlo sarebbe stato
   * indistinguibile da un cedimento.
   *
   * Una regola che TOGLIE non deve poter scivolare verso lo zero senza che
   * nulla se ne accorga: è la lezione del `widthMm: 550` del kit, dove una
   * copertura ristretta non faceva fallire niente e nessun conteggio andava a
   * zero.
   */
  it("copre almeno il 40% dei codici, e almeno il 30% con finitura PROVATA", () => {
    expect(abbinati.size / articoli.length).toBeGreaterThan(0.4);

    const provati = articoli.filter((a) => {
      const chiave = abbinati.get(a.id);
      if (chiave === undefined) return false;
      const fc = finituraDiCodice(a.code);
      return fc !== null && finituraDiFoto(nomePerChiave.get(chiave)!) === fc;
    });
    expect(provati.length / articoli.length).toBeGreaterThan(0.3);
  });

  /**
   * IL PAVIMENTO DELLA REGOLA NUOVA, ed è la regola stessa misurata sul
   * catalogo vero invece che su fixture: nessun articolo può ricevere una foto
   * la cui finitura è provata DIVERSA dalla sua.
   *
   * È l'unico posto in cui «le foto non mentono più» è verificato su tutti e
   * 3.456 i codici contro tutti e 707 i file.
   */
  it("nessuna foto mostra una finitura provata diversa da quella dell'articolo", () => {
    const colpevoli = articoli
      .filter((a) => {
        const chiave = abbinati.get(a.id);
        if (chiave === undefined) return false;
        const fc = finituraDiCodice(a.code);
        if (fc === null) return false;
        const ff = finituraDiFoto(nomePerChiave.get(chiave)!);
        return ff !== null && ff !== fc;
      })
      .map((a) => a.code);
    expect(colpevoli).toEqual([]);
  });

  /**
   * Il caso segnalato da Andrea, sul catalogo vero: la MOOD Collection ha una
   * foto per colore in archivio, e col riconoscitore dei nomi ognuno prende la
   * sua. Prima erano 88 sbagliate su 96 in DUE e altrettante in ONE.
   */
  it("DUE e ONE tengono quasi tutte le foto: l'archivio ha un file per colore", () => {
    for (const g of ["DUE", "ONE"]) {
      const righe = articoli.filter((a) => browseLabel("COLOMBO", a.name) === g);
      const conFoto = righe.filter((a) => abbinati.has(a.id));
      // Misurato: DUE 96/120, ONE 98/124. Chi resta fuori è un colore che
      // l'archivio non fotografa, non un codice a cui abbiamo tolto la foto.
      expect(conFoto.length / righe.length, g).toBeGreaterThan(0.75);
    }
  });

  it("ogni file dichiarato esiste davvero nell'archivio", () => {
    // Un refuso nel nome del file non farebbe fallire nulla: quel gruppo
    // resterebbe semplicemente senza foto, e nessun conteggio andrebbe a zero.
    const nomi = new Set(foto.map((f) => `${f.archivio}/${f.nome}`));
    for (const chiave of Object.keys(FILE_MODELLO)) {
      expect(nomi.has(chiave), chiave).toBe(true);
    }
  });

  /**
   * ⚠️ I POMOLI GENERICI PERDONO LA FOTO, e il test è girato con la decisione
   * invece di essere allentato in silenzio.
   *
   * La PR #56 li aveva coperti al 100% (ROUND 20/20, SQUARE 23/23, CUT 11/11,
   * PUSH 5/5) agganciandoli per nome di file. Ma quei file — `round25_45`,
   * `square35_45` — non dicono NESSUNA finitura, e i codici che se li
   * contendono sono dieci o più: al più uno mostra la propria, gli altri no.
   *
   * È esattamente il caso `CC113Q ocean blue` senza il vantaggio di poterlo
   * dimostrare, ed è la regola scelta dall'utente il 2026-08-05 applicata alla
   * lettera. Recuperarli richiede foto per finitura, cioè un dato che COLOMBO
   * oggi non pubblica: è una domanda per il fornitore, non un rimedio nostro.
   */
  it("i pomoli generici restano senza foto: una foto sola, dieci finiture", () => {
    // Si contano gli articoli CON foto e non «n su m»: il denominatore cambia
    // se il gate gira su un database che il seed ha arricchito, e fallirebbe
    // per la ragione sbagliata.
    const conFoto = (g: string) =>
      articoli.filter((a) => browseLabel("COLOMBO", a.name) === g && abbinati.has(a.id)).length;
    expect(conFoto("ROUND")).toBe(0);
    expect(conFoto("SQUARE")).toBe(0);
    expect(conFoto("CUT")).toBe(0);
    expect(conFoto("PUSH")).toBe(0);
    // ROBOT: i tre pomoli ROBOTECH cadono, la maniglia CD41 tiene. Misurato 66
    // sul listino puro; qui è un pavimento perché il seed aggiunge righe finte
    // che si contendono le stesse foto — e contendendosele ne tolgono, il che
    // è la regola che funziona, non un difetto del gate.
    expect(conFoto("ROBOT")).toBeGreaterThan(50);
  });

  /**
   * POMOLO è il caso che ha fatto scoprire il difetto simmetrico: i suoi codici
   * sono `0CC15FISSOC01` — **senza trattino** — quindi `finituraDiCodice` non li
   * leggeva, e per la regola «chi non dichiara una finitura non può sbagliarla»
   * tenevano tutti la foto del pomolo ROSSO pur chiamandosi WHITE, BLACK,
   * SILVER. Alla lettera la segnalazione di Andrea, sopravvissuta perché il
   * lettore dell'ARTICOLO era più debole di quello della FOTO.
   *
   * Espresso come proprietà e non come numero: il seed del gate aggiunge righe
   * finte, e un conteggio esatto fallirebbe per la ragione sbagliata.
   */
  it("ogni POMOLO che tiene la foto può dimostrarla sua", () => {
    const pomoli = articoli.filter(
      (a) => browseLabel("COLOMBO", a.name) === "POMOLO" && abbinati.has(a.id),
    );
    expect(pomoli.length).toBeGreaterThan(0); // prima di affermare, guarda
    for (const a of pomoli) {
      const fc = finituraDiCodice(a.code);
      const ff = finituraDiFoto(nomePerChiave.get(abbinati.get(a.id)!)!);
      expect(fc === null || ff === null || ff === fc, a.code).toBe(true);
    }
  });

  it("ogni etichetta della tabella esiste davvero fra quelle dello sfoglio", () => {
    const esistenti = new Set(articoli.map((a) => browseLabel("COLOMBO", a.name)).filter(Boolean));
    for (const [archivio, voce] of Object.entries(ARCHIVI)) {
      if (voce.etichetta === null) continue;
      expect(esistenti.has(voce.etichetta), `${archivio} → ${voce.etichetta}`).toBe(true);
    }
  });

  it("ogni serie dichiarata aggancia almeno un codice a catalogo", () => {
    for (const [archivio, voce] of Object.entries(ARCHIVI)) {
      if (!voce.serie) continue;
      const n = articoli.filter((a) =>
        a.codeNorm.replace(/^0/, "").startsWith(voce.serie!),
      ).length;
      expect(n, `${archivio} → ${voce.serie}`).toBeGreaterThan(0);
    }
  });

  it("ogni chiave prodotta corrisponde a una foto che esiste davvero", () => {
    // `abbinaFoto` non inventa chiavi: se lo slug cambiasse forma, lo script
    // caricherebbe file che la route non chiede mai — e nulla andrebbe a zero.
    const vere = new Set(foto.map((f) => chiaveFoto(f.archivio, f.nome)));
    for (const chiave of new Set(abbinati.values())) {
      expect(vere.has(chiave), chiave).toBe(true);
    }
  });

  it("nessun articolo dei gruppi non decidibili prende una foto di modello", () => {
    // SPIDER, MILLA e TRAMA hanno due archivi ciascuno e l'accoppiamento non è
    // scritto da nessuna parte. Possono ricevere una foto SOLO dal gradino 3 —
    // il codice scritto da COLOMBO nel nome del file — che vale comunque, e
    // arriva sempre da un archivio di accessori.
    const perArchivio = new Map(
      foto.map((f) => [chiaveFoto(f.archivio, f.nome), f.archivio] as const),
    );
    for (const a of articoli) {
      const l = browseLabel("COLOMBO", a.name);
      if (l !== "SPIDER" && l !== "MILLA" && l !== "TRAMA") continue;
      const chiave = abbinati.get(a.id);
      if (chiave === undefined) continue;
      const archivio = perArchivio.get(chiave)!;
      expect(ARCHIVI[archivio]?.etichetta, `${a.code} → ${chiave}`).toBeNull();
    }
  });

  it("un articolo ZERO non riceve mai la foto liscia dello stesso modello", () => {
    const perArchivio = new Map(
      foto.map((f) => [chiaveFoto(f.archivio, f.nome), f] as const),
    );
    const articoliZero = articoli.filter((a) => varianteZero(a.name));
    expect(articoliZero.length).toBeGreaterThan(100); // 156 sul listino vero

    for (const a of articoliZero) {
      const chiave = abbinati.get(a.id);
      if (chiave === undefined) continue;
      const f = perArchivio.get(chiave)!;
      // Dal gradino 1 o 2 la foto DEVE essere una foto «zero»; dal gradino 3
      // arriva da un archivio senza etichetta, ed è un'affermazione sul codice.
      if (ARCHIVI[f.archivio]?.etichetta !== null) {
        expect(varianteZero(f.nome), `${a.code} (${a.name}) → ${chiave}`).toBe(true);
      }
    }
  });
});
