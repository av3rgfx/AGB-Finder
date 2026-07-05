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
});
