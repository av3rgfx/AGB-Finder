import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  abbinaFoto,
  ARCHIVI,
  chiaveFoto,
  FILE_MODELLO,
  varianteZero,
  type FotoArchivio,
} from "./foto-archivio";
import { browseLabel } from "./curatela";

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

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    articoli = await db.article.findMany({
      where: { brand: "COLOMBO" },
      select: { id: true, code: true, codeNorm: true, name: true },
    });
    foto = JSON.parse(readFileSync(indice!, "utf8")) as FotoArchivio[];
    abbinati = abbinaFoto(articoli, foto);
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("gira sul listino vero, non sulle venti righe del seed", () => {
    expect(articoli.length).toBeGreaterThan(3000);
    expect(foto.length).toBeGreaterThan(600);
  });

  it("copre almeno il 60% dei codici", () => {
    const quota = abbinati.size / articoli.length;
    // Misurato: 61,3% (2.118 su 3.456). Il pavimento sta sotto di poco apposta —
    // deve accorgersi di un calo, non tollerarlo.
    expect(quota).toBeGreaterThan(0.6);
  });

  it("ogni file dichiarato esiste davvero nell'archivio", () => {
    // Un refuso nel nome del file non farebbe fallire nulla: quel gruppo
    // resterebbe semplicemente senza foto, e nessun conteggio andrebbe a zero.
    const nomi = new Set(foto.map((f) => `${f.archivio}/${f.nome}`));
    for (const chiave of Object.keys(FILE_MODELLO)) {
      expect(nomi.has(chiave), chiave).toBe(true);
    }
  });

  it("i pomoli generici sono coperti per intero", () => {
    const per = (g: string) => {
      const r = articoli.filter((a) => browseLabel(a.name) === g);
      return `${r.filter((a) => abbinati.has(a.id)).length}/${r.length}`;
    };
    expect(per("ROUND")).toBe("20/20");
    expect(per("SQUARE")).toBe("23/23");
    expect(per("CUT")).toBe("11/11");
    expect(per("PUSH")).toBe("5/5");
    expect(per("POMOLO")).toBe("18/18");
    // ROBOT: resta fuori il solo CD42 «senza mov.», che non ha una foto.
    expect(per("ROBOT")).toBe("111/129");
  });

  it("ogni etichetta della tabella esiste davvero fra quelle dello sfoglio", () => {
    const esistenti = new Set(articoli.map((a) => browseLabel(a.name)).filter(Boolean));
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
      const l = browseLabel(a.name);
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
