// Catalogo sintetico: 50 prodotti REALI dal listino AGB 2026 (trascritti a mano).
// Per dev/test senza il PDF da 39 MB. Idempotente. Embedding: null (Fase ≥1c).
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import type { ParsedRow } from "../src/server/catalog/parse-listino";
import { upsertCatalog, type ImportReport } from "../src/server/catalog/import-catalog";

type SeedInput = Partial<ParsedRow> & Pick<ParsedRow, "agbCode" | "priceCents" | "category">;

const row = (partial: SeedInput): ParsedRow => ({
  subcategory: null,
  groupTitle: null,
  material: null,
  finish: null,
  dimension: null,
  hand: null,
  packBox: null,
  packCarton: null,
  discountClass: null,
  attributes: {},
  rawLine: "seed",
  ...partial,
});

// ── SERRATURE · Incontri - Sicurezza (pag. 118) ──────────────────────────────
const serrature = (partial: SeedInput): ParsedRow =>
  row({
    subcategory: "Incontri - Sicurezza",
    groupTitle: "Larghezza 22 mm, bordo tondo spessore 3 mm",
    material: "ACCIAIO",
    dimension: "238 mm",
    packBox: 25,
    packCarton: 250,
    discountClass: "A2",
    ...partial,
  });

// ── CERNIERE · Per porte a filo (pag. 282) ───────────────────────────────────
const cerniereCompact = (partial: SeedInput): ParsedRow =>
  row({
    subcategory: "Per porte a filo",
    groupTitle: "COMPACT - Confezione per una porta",
    material: "ACCIAIO",
    finish: "Nichelato opaco",
    packBox: 1,
    packCarton: 20,
    discountClass: "C1",
    ...partial,
  });

const cerniere2R = (partial: SeedInput): ParsedRow =>
  row({
    subcategory: "Per porte a filo",
    groupTitle: "2R - Confezione per una porta",
    material: "ACCIAIO",
    packBox: 1,
    packCarton: 1,
    discountClass: "C1",
    ...partial,
  });

// ── ARTECH · Cremonesi · Anta ribalta (entrata 7,5) ──────────────────────────
const artech = (partial: SeedInput): ParsedRow =>
  row({
    subcategory: "Cremonesi",
    groupTitle: "Anta ribalta - altezza maniglia fissa",
    packBox: 10,
    packCarton: 10,
    discountClass: "F3",
    ...partial,
  });

// ── CILINDRI · Modello Scudo DCK ─────────────────────────────────────────────
const cilindri = (partial: SeedInput): ParsedRow =>
  row({
    subcategory: "Modello Scudo DCK - Chiave a duplicazione controllata",
    groupTitle: "Chiave - Chiave",
    material: "OTTONE NICHELATO OPACO",
    packBox: 1,
    packCarton: 5,
    discountClass: "B4",
    ...partial,
  });

// ── FERRAMENTA PER IMPOSTE · Abaco - Spagnolette ─────────────────────────────
const imposte = (partial: SeedInput): ParsedRow =>
  row({
    subcategory: "Abaco - Spagnolette",
    groupTitle: "Asta di chiusura",
    material: "ACCIAIO",
    packBox: 10,
    packCarton: 10,
    discountClass: "E1",
    ...partial,
  });

// ── MULTIPUNTO · Sicurtop POSEIDON ───────────────────────────────────────────
const multipunto = (partial: SeedInput): ParsedRow =>
  row({
    subcategory: "Sicurtop POSEIDON - Interasse 85 mm",
    groupTitle: "Frontale 16 mm",
    packBox: 5,
    packCarton: 5,
    discountClass: "G2",
    ...partial,
  });

/* eslint-disable prettier/prettier */
export const SEED_ROWS: ParsedRow[] = [
  // SERRATURE (5)
  serrature({ agbCode: "B00590.15.03", priceCents: 123, finish: "Ottonato lucido", category: "SERRATURE" }),
  serrature({ agbCode: "B00590.15.06", priceCents: 135, finish: "Nichelato lucido", category: "SERRATURE" }),
  serrature({ agbCode: "B00590.15.22", priceCents: 97, finish: "Bronzato opaco vern.", category: "SERRATURE" }),
  serrature({ agbCode: "B00590.15.34", priceCents: 207, finish: "Cromato opaco", category: "SERRATURE" }),
  serrature({
    agbCode: "B00590.30.03", priceCents: 105, finish: "Ottonato lucido", category: "SERRATURE",
    groupTitle: "Larghezza 22 mm, bordo tondo spessore 2 mm", discountClass: "A1",
  }),
  // CERNIERE (11)
  cerniereCompact({ agbCode: "E10073.10.16", priceCents: 5159, hand: "DX", category: "CERNIERE" }),
  cerniereCompact({ agbCode: "E10073.11.16", priceCents: 5159, hand: "SX", category: "CERNIERE" }),
  row({
    agbCode: "E09010.10.05", priceCents: 277, category: "CERNIERE",
    subcategory: "Per porte a filo", groupTitle: "Kit 6 viti per cerniera COMPACT",
    packBox: 50, packCarton: 50, discountClass: "C1",
  }),
  cerniere2R({ agbCode: "E10006.41.03", priceCents: 3668, finish: "Ottonato lucido", dimension: "41 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.44.03", priceCents: 3668, finish: "Ottonato lucido", dimension: "44 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.45.03", priceCents: 3668, finish: "Ottonato lucido", dimension: "45 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.41.06", priceCents: 3838, finish: "Nichelato lucido", dimension: "41 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.44.06", priceCents: 3838, finish: "Nichelato lucido", dimension: "44 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.45.06", priceCents: 3838, finish: "Nichelato lucido", dimension: "45 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.41.34", priceCents: 4175, finish: "Cromato opaco", dimension: "41 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.41.93", priceCents: 4175, finish: "Nero semilucido", dimension: "41 mm", category: "CERNIERE" }),
  // ARTECH (10) — dimensione = campo HBB (altezza battuta) in mm
  artech({ agbCode: "A50122.08.02", priceCents: 1709, dimension: "610-810", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.03", priceCents: 1728, dimension: "794-1010", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.04", priceCents: 1795, dimension: "994-1210", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.05", priceCents: 1914, dimension: "1194-1410", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.06", priceCents: 1992, dimension: "1394-1610", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.07", priceCents: 2212, dimension: "1594-1810", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.17", priceCents: 2212, dimension: "1634-1810", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.08", priceCents: 2397, dimension: "1794-2110", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.09", priceCents: 2706, dimension: "1994-2310", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.10", priceCents: 2893, dimension: "2194-2510", category: "ARTECH" }),
  // CILINDRI (8) — dimensione = lunghezza totale (X-Y)
  cilindri({ agbCode: "C10016.25.25", priceCents: 10452, dimension: "60 (30-30)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.25.30", priceCents: 10621, dimension: "65 (30-35)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.25.35", priceCents: 10621, dimension: "70 (30-40)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.30.30", priceCents: 10621, dimension: "70 (35-35)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.25.40", priceCents: 11185, dimension: "75 (30-45)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.30.35", priceCents: 11185, dimension: "75 (35-40)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.25.45", priceCents: 11185, dimension: "80 (30-50)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.30.40", priceCents: 11185, dimension: "80 (35-45)", category: "CILINDRI" }),
  // FERRAMENTA PER IMPOSTE (8)
  imposte({ agbCode: "H00900.01.93", priceCents: 389, finish: "Black Powerage", dimension: "1000", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.02.93", priceCents: 439, finish: "Black Powerage", dimension: "1200", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.03.93", priceCents: 503, finish: "Black Powerage", dimension: "1400", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.04.93", priceCents: 551, finish: "Black Powerage", dimension: "1600", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.05.93", priceCents: 604, finish: "Black Powerage", dimension: "1800", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.06.93", priceCents: 673, finish: "Black Powerage", dimension: "2000", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.01.21", priceCents: 419, finish: "Silver Powerage", dimension: "1000", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.02.21", priceCents: 473, finish: "Silver Powerage", dimension: "1200", category: "FERRAMENTA PER IMPOSTE" }),
  // MULTIPUNTO (8) — dimensione = entrata; altezza/punti chiusura in attributes
  multipunto({ agbCode: "W11200.35.12", priceCents: 13357, dimension: "35", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.40.12", priceCents: 13357, dimension: "40", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.45.12", priceCents: 13357, dimension: "45", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.50.12", priceCents: 13357, dimension: "50", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.55.12", priceCents: 13357, dimension: "55", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.60.12", priceCents: 13357, dimension: "60", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.70.12", priceCents: 13357, dimension: "70", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.35.13", priceCents: 13357, dimension: "35", attributes: { altezza: "2400 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
];
/* eslint-enable prettier/prettier */

export function seedCatalog(db: PrismaClient): Promise<ImportReport> {
  return upsertCatalog(db, SEED_ROWS);
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]!).href;

if (isDirectRun) {
  const db = new PrismaClient();
  seedCatalog(db)
    .then((report) =>
      console.log(`✓ Seed catalogo: ${report.products} prodotti, ${report.categories} categorie`),
    )
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => void db.$disconnect());
}
