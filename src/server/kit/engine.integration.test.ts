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
      windowType: "ANTA_RIBALTA",
      widthMm: 550,
      heightMm: 1820,
      material: "LEGNO",
      geometry: "A12_I13_B20",
      entrata: "E15",
      seatConfig: "STANDARD",
      openingSide: "SINISTRA",
      openingDir: "TIRARE",
      finish: "ARGENTO",
      series: "ARTECH",
      supplementaryClosures: true,
    });
    expect(output.warnings).toEqual([]);
    expect(output.lines).toHaveLength(16);
    expect(output.lines.every((line) => line.unitPrice !== null)).toBe(true);
    // I NUMERI VERI, non `> 0`. La distinta reale AGB del 16/11/2021 è l'unico
    // riscontro esterno che questo progetto possieda: 16 righe, 21 pezzi,
    // 90,20 €. Asserire `toBeGreaterThan(0)` su quel totale era un test verde
    // che non verificava — un re-import che cambia un prezzo, o un codice
    // sostituito, passavano indisturbati.
    expect(output.lines.reduce((n, l) => n + l.quantity, 0)).toBe(21);
    expect(Number(output.totalPrice).toFixed(2)).toBe("90.20");
  });

  // Il gemello a entrata 7,5: stessa geometria, stesso tutto, cambia SOLO la
  // riga della cremonese (A50122.08.07 invece di A50122.15.07). È la prova che
  // l'entrata sia ortogonale alla geometria, fatta sui prezzi veri.
  it("il gemello a entrata 7,5 fa 96,29 €, e cambia solo la cremonese", async () => {
    const output = await new KitEngine(db).generate({
      windowType: "ANTA_RIBALTA",
      widthMm: 550,
      heightMm: 1820,
      material: "LEGNO",
      geometry: "A12_I13_B20",
      entrata: "E75",
      seatConfig: "STANDARD",
      openingSide: "SINISTRA",
      openingDir: "TIRARE",
      finish: "ARGENTO",
      series: "ARTECH",
      supplementaryClosures: true,
    });
    expect(output.warnings).toEqual([]);
    expect(output.lines).toHaveLength(16);
    expect(output.lines.reduce((n, l) => n + l.quantity, 0)).toBe(21);
    expect(Number(output.totalPrice).toFixed(2)).toBe("96.29");
    expect(output.lines.some((l) => l.code === "A50122.08.07")).toBe(true);
  });

  // PVC DISATTIVATO 2026-07-25: la composizione ARTECH PVC non esiste nel
  // listino 2026 (i codici material-specific compaiono solo nelle pagine
  // certificato ift p0013 (11) e p0395 (393), senza prezzo) → template
  // isActive:false nel seed + modulo che rifiuta. Qui si verifica la barriera
  // che scatta per prima con il DB reale: l'engine non trova nessun template
  // attivo e rifiuta prima ancora di raggiungere il modulo. Nessuna distinta
  // PVC monca può più uscire.
  const pvcInput = {
    windowType: "ANTA_RIBALTA",
    widthMm: 550,
    heightMm: 1820,
    material: "PVC",
    geometry: "A12_I13_B20",
    entrata: "E15",
    seatConfig: "STANDARD",
    openingSide: "SINISTRA",
    openingDir: "TIRARE",
    finish: "ARGENTO",
    series: "ARTECH",
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
    windowType: "ANTA_BATTENTE",
    widthMm: 600,
    heightMm: 1300,
    material: "LEGNO",
    geometry: "A12_I13_B20",
    entrata: "E15",
    seatConfig: "STANDARD",
    openingSide: "DESTRA",
    openingDir: "TIRARE",
    finish: "ARGENTO",
    series: "ARTECH",
  };

  it("il battente è disattivato: la generazione viene rifiutata", async () => {
    await expect(new KitEngine(db).generate(battenteInput)).rejects.toThrow(KitGenerationError);
  });

  it("il rifiuto battente arriva dal template spento, non da una distinta parziale", async () => {
    await expect(new KitEngine(db).generate(battenteInput)).rejects.toThrow(
      /Nessun template kit attivo/,
    );
  });

  // ── BILICO TOUR (2026-07-26) ────────────────────────────────────────────
  // È il controllo che conta davvero per una serie nuova: i test unitari
  // mockano `product.findMany`, quindi un codice assente dal catalogo sfugge —
  // è esattamente così che il PVC è arrivato in produzione con 4 righe su 12
  // senza prezzo. Qui ogni codice deve risolvere a un prodotto CON prezzo.
  const bilico3Lati = {
    windowType: "BILICO",
    series: "TOUR",
    material: "LEGNO",
    widthMm: 700,
    heightMm: 900,
    finish: "MARRONE RAL 8019",
    tourSchema: 2,
  };

  it("il bilico 3 lati risolve 7 codici reali, tutti con prezzo", async () => {
    const output = await new KitEngine(db).generate(bilico3Lati);
    expect(output.warnings).toEqual([]);
    expect(output.lines).toHaveLength(7);
    expect(output.lines.every((line) => line.unitPrice !== null)).toBe(true);
    expect(output.totalPrice).toBeGreaterThan(0);
  });

  it("il bilico 4 lati aggiunge le due aste di mano opposta", async () => {
    const output = await new KitEngine(db).generate({
      ...bilico3Lati,
      widthMm: 1500,
      heightMm: 1600,
      finish: "CROMATO OPACO",
      tourSchema: 5,
    });
    expect(output.warnings).toEqual([]);
    expect(output.lines).toHaveLength(9);
    expect(output.lines.every((line) => line.unitPrice !== null)).toBe(true);
  });

  it("lo schema 3 aggiunge il kit spessori, anch'esso a catalogo con prezzo", async () => {
    const output = await new KitEngine(db).generate({ ...bilico3Lati, tourSchema: 3 });
    expect(output.warnings).toEqual([]);
    const spessori = output.lines.find((line) => line.code === "T16635.04.01");
    expect(spessori?.unitPrice).toBeGreaterThan(0);
  });

  it("il bilico esiste solo per il legno: il PVC viene rifiutato", async () => {
    await expect(new KitEngine(db).generate({ ...bilico3Lati, material: "PVC" })).rejects.toThrow(
      KitGenerationError,
    );
  });
});
