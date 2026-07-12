import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedKitTemplates } from "../../../prisma/seed-kit";
import { KitEngine } from "./engine";

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

  it("la distinta golden risolve 16 codici reali senza warning", async () => {
    const output = await new KitEngine(db).generate({
      windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "LEGNO",
      airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
      openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
    });
    expect(output.warnings).toEqual([]);
    expect(output.lines).toHaveLength(16);
    expect(output.lines.every((line) => line.unitPrice !== null)).toBe(true);
    expect(output.totalPrice).toBeGreaterThan(0);
  });

  // PVC è PROVVISORIO (Task 3): NON si pretende zero-warning. I codici
  // material-specific dalla cert ift e quelli su "listino PVC e ALLUMINIO"
  // separato possono NON essere a catalogo → devono emergere come warning
  // (mai silenziosi). Serve all'esperto per vedere quali codici mancano.
  it("la distinta PVC provvisoria si genera e NON ha codici non prezzati silenziosi", async () => {
    const output = await new KitEngine(db).generate({
      windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "PVC",
      airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
      openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
    });
    expect(output.lines.length).toBeGreaterThan(0);
    const unpriced = output.lines.filter((line) => line.unitPrice === null);
    // Ogni codice senza prezzo DEVE avere un warning (nessun kit monco silenzioso).
    expect(output.warnings).toHaveLength(unpriced.length);
    for (const line of unpriced) expect(output.warnings.some((w) => w.includes(line.code))).toBe(true);
    // Diagnostica per la revisione: quanti/quali codici PVC restano da validare.
    console.log(
      `PVC provvisorio: ${output.lines.length - unpriced.length}/${output.lines.length} codici a listino;` +
        (unpriced.length ? ` da validare: ${unpriced.map((l) => l.code).join(", ")}` : " tutti risolti"),
    );
  });

  it("la distinta battente provvisoria si genera e segnala i codici non a listino", async () => {
    const output = await new KitEngine(db).generate({
      windowType: "ANTA_BATTENTE", widthMm: 600, heightMm: 1300, material: "LEGNO",
      airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
      openingSide: "DESTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
    });
    expect(output.lines).toHaveLength(5);
    const unpriced = output.lines.filter((line) => line.unitPrice === null);
    expect(output.warnings).toHaveLength(unpriced.length);
    console.log(
      `Battente provvisorio: ${output.lines.length - unpriced.length}/${output.lines.length} codici a listino` +
        (unpriced.length ? `; da validare: ${unpriced.map((l) => l.code).join(", ")}` : ""),
    );
  });
});
