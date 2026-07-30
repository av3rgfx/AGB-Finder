-- CreateEnum
CREATE TYPE "Entrata" AS ENUM ('E75', 'E15');

-- AlterTable
ALTER TABLE "kit_requests" ADD COLUMN     "entrata" "Entrata";

-- Backfill: fino a oggi l'entrata non era un input ma una COSTANTE del motore,
-- che ha emesso A50122.15.* su ogni distinta ARTECH senza eccezioni. Scrivere
-- E15 su quelle righe non è un'ipotesi: registra la costante che si è applicata.
-- È il caso opposto al backfill della geometria (20260730084816_kit_geometria),
-- dove le colonne legacy potevano dire aria 4 o sede 30 e assumere il pilota
-- avrebbe falsificato dati di produzione.
-- Le righe TOUR restano NULL: quel ramo non ha questo campo.
UPDATE "kit_requests" SET "entrata" = 'E15' WHERE "series" = 'ARTECH';
