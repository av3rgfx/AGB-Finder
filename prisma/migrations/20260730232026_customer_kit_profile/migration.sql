-- Profilo serramento del cliente: due colonne NULLABLE, NESSUN BACKFILL.
--
-- NULL = nessun profilo dichiarato, ed è lo stato legittimo di ogni riga
-- esistente: `customers` in produzione è vuota (il modello è stato senza router
-- né CRUD fino al 2026-07-30). È il caso opposto al backfill di
-- `kit_requests.entrata`, dove NULL avrebbe significato «dato rotto» perché il
-- motore aveva applicato una costante a tutte le righe ARTECH.
--
-- Gli enum "ArtechGeometry" ed "Entrata" esistono già (20260730084816 e
-- 20260730160444): qui non si creano tipi, si aggiungono due colonne.

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "kit_entrata" "Entrata",
ADD COLUMN     "kit_geometry" "ArtechGeometry";
