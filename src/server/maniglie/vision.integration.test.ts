import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decodeVision } from "./vision-decode";
import { parseVision, BANDE_VISION_2026 } from "./vision-parse";
import { articoliVision } from "./vision-codici";

const pdf = process.env.VISION_PDF;
const dbUrl = process.env.INTEGRATION_DATABASE_URL;

/**
 * Gate sul documento VERO. I numeri stanno qui e non nelle fixture perché il
 * repo è pubblico e sono il listino di un fornitore: questo file gira solo con
 * `VISION_PDF` valorizzato, e in CI resta saltato.
 */
describe.skipIf(!pdf)("listino Vision 2026 — documento reale", () => {
  const blocchi = () => {
    const raw = execFileSync("pdftotext", ["-layout", pdf!, "-"], {
      maxBuffer: 64 * 1024 * 1024,
      encoding: "buffer",
    });
    return parseVision(decodeVision(raw), BANDE_VISION_2026);
  };

  it("le tre guardie passano su tutte e 37 le bande", () => {
    expect(blocchi()).toHaveLength(37);
  });

  it("produce 251 articoli e 19 modelli con righe escluse", () => {
    const { articoli, esclusi } = articoliVision(blocchi());
    expect(articoli).toHaveLength(251);
    expect(esclusi).toHaveLength(19);
    expect(new Set(esclusi.map((e) => e.finitura))).toEqual(new Set(["zirconium HPS/1"]));
  });

  it("i codici che COLOMBO ha già scritto nella pronta consegna ci sono tutti", () => {
    // Sono i «23 orfani»: codici in magazzino e non a listino, cioè il listino
    // nuovo arrivato sullo scaffale prima che a sistema. Quattro dei dodici sono
    // HPS/1 e restano fuori (`0AM15FISSOI1`, `0AM25FISSOI1`, `0AM41RHPS1`,
    // `0AM42DKSMI1`); questi otto no, e sono la prova della regola.
    const norm = new Set(articoliVision(blocchi()).articoli.map((a) => a.codeNorm));
    for (const c of [
      "0ID45FISSOCM", "0ID55FISSOCM", "0ID81RCM", "0ID81ROM",
      "0ID82DKSMCM", "0ID82DKSMOM", "0ID91RCM", "0ID92DKSMCM",
    ]) {
      expect(norm).toContain(c);
    }
  });

  it("nessuna descrizione inizia con MANIGLIA, e nessuna supera i 35 caratteri", () => {
    for (const a of articoliVision(blocchi()).articoli) {
      // «MANIGLIA» è fusa in MANIGLIA INCASSO: 144 righe finirebbero fra i
      // maniglioni a incasso e nessun conteggio andrebbe a zero.
      expect(a.name.split(" ")[0]).not.toBe("MANIGLIA");
      // 35 è il massimo dei 3.456 nomi esistenti.
      expect(a.name.length).toBeLessThanOrEqual(35);
    }
  });

  it("nessun codice si ripete", () => {
    const codici = articoliVision(blocchi()).articoli.map((a) => a.code);
    expect(new Set(codici).size).toBe(codici.length);
  });

  it("il prezzo di BT19 BZG in oromat è quello della pagina del prodotto", () => {
    // Il documento si contraddice — 53,60 a pagina 8, 53,70 a pagina 13 — ed è
    // un disaccordo DICHIARATO, non tollerato: uno nuovo fermerebbe l'import.
    const a = articoliVision(blocchi()).articoli.find((x) => x.code === "0BT19BZG6-OM");
    expect(a?.priceList.toString()).toBe("53.6");
  });
});

/**
 * Sentinella sul database vero, dopo l'import. È ciò che ha trovato il difetto
 * per cui i 17 codici già a listino tenevano il surcharge del 02/26 accanto al
 * prezzo del 05/26: `0BT13-CM` aveva 12,40 con 0,57, cioè il 4,6 %.
 */
describe.skipIf(!dbUrl)("composizione del prezzo — database reale", () => {
  // Il client si costruisce in `beforeAll` e non nel corpo del `describe`: il
  // corpo viene eseguito in fase di RACCOLTA anche quando `skipIf` è vero, e
  // senza la env il file esploderebbe invece di saltare — cioè il gate
  // fallirebbe per la ragione sbagliata, che in questo progetto è già successo.
  let db: PrismaClient;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: dbUrl });
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it("ogni surcharge dichiarato è il 3,5 % del suo prezzo, senza eccezioni", async () => {
    const storti = await db.$queryRaw<{ code: string }[]>`
      SELECT code FROM articles
      WHERE brand = 'COLOMBO' AND surcharge IS NOT NULL
        AND abs(surcharge - round(price_list * 0.035, 2)) > 0.01
    `;
    expect(storti).toEqual([]);
  });

  it("nessun articolo porta surcharge = 0: l'assenza si scrive NULL", async () => {
    // `0` e `null` danno lo stesso totale in `articleTotal`, ma `0` AFFERMA che
    // non c'è maggiorazione e cancella il discriminante che ritrova le righe
    // del listino 05/26.
    const zeri = await db.article.count({ where: { brand: "COLOMBO", surcharge: 0 } });
    expect(zeri).toBe(0);
  });

  it("gli articoli senza maggiorazione sono quelli del listino 05/26", async () => {
    const netti = await db.article.count({ where: { brand: "COLOMBO", surcharge: null } });
    expect(netti).toBe(251);
  });
});
