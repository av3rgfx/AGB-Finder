-- Serie TOUR (bilico rettangolare): nuova tipologia + input per-ramo.
--
-- 1. Nuovo valore di WindowType.
ALTER TYPE "WindowType" ADD VALUE IF NOT EXISTS 'BILICO';

-- 2. Geometria e mano diventano NULLABLE: sono campi del solo ramo ARTECH.
--    Una riga TOUR li ha NULL per costruzione (l'unione discriminata zod
--    scarta i campi estranei al ramo). Nessuna riga esistente viene toccata:
--    tutte sono ARTECH e restano valorizzate.
ALTER TABLE "kit_requests" ALTER COLUMN "air_gap_mm" DROP NOT NULL;
ALTER TABLE "kit_requests" ALTER COLUMN "axis_offset_mm" DROP NOT NULL;
ALTER TABLE "kit_requests" ALTER COLUMN "rebate_mm" DROP NOT NULL;
ALTER TABLE "kit_requests" ALTER COLUMN "seat_mm" DROP NOT NULL;
ALTER TABLE "kit_requests" ALTER COLUMN "opening_side" DROP NOT NULL;
ALTER TABLE "kit_requests" ALTER COLUMN "opening_direction" DROP NOT NULL;

-- 3. Schema di montaggio TOUR (1-5). Solo questo: listello, asse, battuta,
--    modello di cerniera e guarnizione si DERIVANO dallo schema in codice e
--    non vanno persistiti (seconda fonte di verità). L'asse dello schema 3
--    è 17,5 e non sarebbe nemmeno rappresentabile in un INTEGER.
ALTER TABLE "kit_requests" ADD COLUMN "tour_schema" INTEGER;
