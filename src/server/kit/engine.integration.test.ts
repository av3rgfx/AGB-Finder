import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedKitTemplates } from "../../../prisma/seed-kit";
import { KitEngine } from "./engine";
import { KitGenerationError } from "./types";

const url = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(url))("KitEngine — integrazione su catalogo reale", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await seedKitTemplates(db);
  }, 30_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  // È l'UNICO test che vede il catalogo vero: quello unitario mocka
  // product.findMany, quindi un codice inesistente a DB gli sfugge. Qui
  // `supplementaryClosures: true` è necessario per arrivare alle 16 righe della
  // distinta storica (dalla Fase 1g il default è OFF = 12 righe: l'atteso 16 era
  // rimasto indietro e il test sarebbe fallito al primo run con DB reale).
  it("la distinta golden risolve 16 codici reali senza warning", async () => {
    const output = await new KitEngine(db).generate({
      windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "LEGNO",
      airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
      openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
      supplementaryClosures: true,
    });
    expect(output.warnings).toEqual([]);
    expect(output.lines).toHaveLength(16);
    expect(output.lines.every((line) => line.unitPrice !== null)).toBe(true);
    expect(output.totalPrice).toBeGreaterThan(0);
  });

  // PVC DISATTIVATO 2026-07-25: la composizione ARTECH PVC non esiste nel
  // listino 2026 (i codici material-specific compaiono solo nelle pagine
  // certificato ift p0013 (11) e p0395 (393), senza prezzo) → template
  // isActive:false nel seed + modulo che rifiuta. Qui si verifica la barriera
  // che scatta per prima con il DB reale: l'engine non trova nessun template
  // attivo e rifiuta prima ancora di raggiungere il modulo. Nessuna distinta
  // PVC monca può più uscire.
  const pvcInput = {
    windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "PVC",
    airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
    openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
  };

  it("il PVC è disattivato: la generazione viene rifiutata", async () => {
    await expect(new KitEngine(db).generate(pvcInput)).rejects.toThrow(KitGenerationError);
  });

  it("il rifiuto PVC arriva dal template spento, non da una distinta parziale", async () => {
    await expect(new KitEngine(db).generate(pvcInput)).rejects.toThrow(
      /Nessun template kit attivo/,
    );
  });

  // BATTENTE DISATTIVATO 2026-07-25: lo schema di montaggio p0416 (414) elenca
  // 21 voci, il modulo ne generava 5 — mancava l'intero appoggio della cerniera
  // superiore (corpo articolazione, articolazione superiore anta semifissa,
  // supporti forbice), quindi l'anta non aveva punto di sospensione in alto.
  // Template isActive:false nel seed + modulo che rifiuta. Come per il PVC, con
  // il DB reale scatta per prima la barriera del template spento.
  const battenteInput = {
    windowType: "ANTA_BATTENTE", widthMm: 600, heightMm: 1300, material: "LEGNO",
    airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
    openingSide: "DESTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
  };

  it("il battente è disattivato: la generazione viene rifiutata", async () => {
    await expect(new KitEngine(db).generate(battenteInput)).rejects.toThrow(KitGenerationError);
  });

  it("il rifiuto battente arriva dal template spento, non da una distinta parziale", async () => {
    await expect(new KitEngine(db).generate(battenteInput)).rejects.toThrow(
      /Nessun template kit attivo/,
    );
  });
});
