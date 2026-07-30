-- CreateEnum
CREATE TYPE "ArtechGeometry" AS ENUM ('A4_I85_B15', 'A4_I9_B18', 'A4_I13_B18', 'A12_I9_B18', 'A12_I9_B20', 'A12_I13_B18', 'A12_I13_B20');

-- CreateEnum
CREATE TYPE "SeatConfig" AS ENUM ('STANDARD', 'SEDE_30');

-- AlterTable
ALTER TABLE "kit_requests" ADD COLUMN     "engine_version" TEXT,
ADD COLUMN     "geometry" "ArtechGeometry",
ADD COLUMN     "seat_config" "SeatConfig",
ADD COLUMN     "superseded_by_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "kit_requests_superseded_by_id_key" ON "kit_requests"("superseded_by_id");

-- AddForeignKey
ALTER TABLE "kit_requests" ADD CONSTRAINT "kit_requests_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "kit_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: la geometria si RICAVA dalle colonne legacy, non si assume.
--
-- PERCHÉ NON SI PUÒ ASSUMERE «sono tutte del pilota». La vecchia guardia
-- `assertPilotGeometry` rifiutava le geometrie non-pilota **alla generazione, non
-- alla creazione**, e il wizard esponeva quattro campi numerici liberi (zod:
-- aria 4-20, interasse 9-20, battuta 15-30, sede 12-30). Una riga `DRAFT` con
-- geometria qualunque è quindi l'esito ATTESO del vecchio flusso, non un caso
-- limite. Timbrarle tutte `A12_I13_B20` produrrebbe una distinta **plausibile e
-- sbagliata** — lo stesso difetto che `no-silent-fields.test.ts` esiste per
-- impedire (aria 4 che riceve in silenzio i codici dell'aria 12).
--
-- Le tre quote sono ancora **nella stessa riga** (`air_gap_mm`, `axis_offset_mm`,
-- `rebate_mm`): la geometria non va indovinata, va letta. Le sei combinazioni sotto
-- sono quelle di `GEOMETRIE` in `src/server/kit/artech-geometrie.ts` — fonte di
-- verità dei valori. La settima, `A4_I85_B15`, è **irraggiungibile** dallo storico:
-- il suo interasse è 8,5 e `axis_offset_mm` è un `Int` (min 9).
--
-- CIÒ CHE NON SI RICONOSCE RESTA NULL. `kitInputFromRequest`
-- (src/server/kit/from-request.ts) rifiuta una riga ARTECH con `geometry` NULL: per
-- quelle righe si conserva esattamente il comportamento di prima, cioè un rifiuto
-- esplicito su una richiesta che non era comunque generabile (`assertPilotGeometry`
-- l'avrebbe respinta). Meglio un errore leggibile che una distinta inventata.
UPDATE "kit_requests"
SET
  "geometry" = (
    CASE
      WHEN "air_gap_mm" = 4  AND "axis_offset_mm" = 9  AND "rebate_mm" = 18 THEN 'A4_I9_B18'
      WHEN "air_gap_mm" = 4  AND "axis_offset_mm" = 13 AND "rebate_mm" = 18 THEN 'A4_I13_B18'
      WHEN "air_gap_mm" = 12 AND "axis_offset_mm" = 9  AND "rebate_mm" = 18 THEN 'A12_I9_B18'
      WHEN "air_gap_mm" = 12 AND "axis_offset_mm" = 9  AND "rebate_mm" = 20 THEN 'A12_I9_B20'
      WHEN "air_gap_mm" = 12 AND "axis_offset_mm" = 13 AND "rebate_mm" = 18 THEN 'A12_I13_B18'
      WHEN "air_gap_mm" = 12 AND "axis_offset_mm" = 13 AND "rebate_mm" = 20 THEN 'A12_I13_B20'
    END
  )::"ArtechGeometry",
  -- La sede era un input libero e ora è una famiglia di schemi: 30 mm è l'unica
  -- che AGB tratta come famiglia a sé («schemi sede 30 mm», NB su 22 pagine).
  -- Si mappa dal dato, non dal default: una riga legacy con `seat_mm = 30` deve
  -- diventare `SEDE_30` e farsi rifiutare da `assertSeatConfigSupportata` (manca
  -- l'incontro DSS 13x30 a listino), non passare in silenzio per standard.
  -- `seat_mm` NULL → NULL: «non dichiarata» resta «non dichiarata»; il default
  -- STANDARD è dello schema zod e lo applica `kitInputFromRequest`.
  "seat_config" = (
    CASE
      WHEN "seat_mm" = 30 THEN 'SEDE_30'
      WHEN "seat_mm" IS NOT NULL THEN 'STANDARD'
    END
  )::"SeatConfig"
WHERE "series" = 'ARTECH' AND "geometry" IS NULL;

-- Le righe TOUR non hanno geometria ARTECH (il ramo TOUR dell'unione zod non la
-- prevede) e restano NULL su entrambe le colonne: la `WHERE` sopra le esclude e
-- **nessuna delle due colonne ha un `DEFAULT` a livello DB**, proprio perché un
-- default le avrebbe valorizzate tutte in silenzio.
