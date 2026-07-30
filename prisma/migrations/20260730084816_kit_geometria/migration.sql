-- CreateEnum
CREATE TYPE "ArtechGeometry" AS ENUM ('A4_I85_B15', 'A4_I9_B18', 'A4_I13_B18', 'A12_I9_B18', 'A12_I9_B20', 'A12_I13_B18', 'A12_I13_B20');

-- CreateEnum
CREATE TYPE "SeatConfig" AS ENUM ('STANDARD', 'SEDE_30');

-- AlterTable
ALTER TABLE "kit_requests" ADD COLUMN     "engine_version" TEXT,
ADD COLUMN     "geometry" "ArtechGeometry",
ADD COLUMN     "seat_config" "SeatConfig" DEFAULT 'STANDARD',
ADD COLUMN     "superseded_by_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "kit_requests_superseded_by_id_key" ON "kit_requests"("superseded_by_id");

-- AddForeignKey
ALTER TABLE "kit_requests" ADD CONSTRAINT "kit_requests_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "kit_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: le righe kit_requests esistenti (create prima di questa migrazione)
-- restano con "geometry" NULL se non valorizzate qui. `kitInputFromRequest`
-- (src/server/kit/from-request.ts) rifiuta una riga ARTECH con geometry NULL —
-- senza questo backfill quelle righe diventerebbero non rigenerabili.
--
-- Tutte le righe ARTECH esistenti sono del pilota anta-ribalta (distinta reale
-- AGB del 16/11/2021): aria 12 / interasse 13 / battuta 20 → A12_I13_B20.
UPDATE "kit_requests"
SET "geometry" = 'A12_I13_B20', "seat_config" = 'STANDARD'
WHERE "series" = 'ARTECH' AND "geometry" IS NULL;

-- Le righe TOUR non hanno geometria ARTECH (il ramo TOUR dell'unione zod non la
-- prevede): restano NULL per costruzione, non per dimenticanza.
