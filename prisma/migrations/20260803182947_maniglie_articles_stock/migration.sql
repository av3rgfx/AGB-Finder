-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "code_norm" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_list" DECIMAL(12,2) NOT NULL,
    "surcharge" DECIMAL(12,2),
    "ean" TEXT,
    "catalog_page" INTEGER,
    "image_url" TEXT,
    "last_listing_at" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_imports" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_by_id" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "matched_count" INTEGER NOT NULL,
    "orphan_count" INTEGER NOT NULL,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "stock_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lines" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "raw_code" TEXT NOT NULL,
    "code_norm" TEXT NOT NULL,
    "article_id" TEXT,

    CONSTRAINT "stock_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "articles_brand_idx" ON "articles"("brand");

-- CreateIndex
CREATE UNIQUE INDEX "articles_brand_code_key" ON "articles"("brand", "code");

-- CreateIndex
CREATE UNIQUE INDEX "articles_brand_code_norm_key" ON "articles"("brand", "code_norm");

-- CreateIndex
CREATE INDEX "stock_imports_brand_cancelled_at_imported_at_idx" ON "stock_imports"("brand", "cancelled_at", "imported_at");

-- CreateIndex
CREATE INDEX "stock_lines_import_id_idx" ON "stock_lines"("import_id");

-- CreateIndex
CREATE INDEX "stock_lines_article_id_idx" ON "stock_lines"("article_id");

-- CreateIndex
CREATE INDEX "stock_lines_code_norm_idx" ON "stock_lines"("code_norm");

-- AddForeignKey
ALTER TABLE "stock_imports" ADD CONSTRAINT "stock_imports_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lines" ADD CONSTRAINT "stock_lines_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "stock_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lines" ADD CONSTRAINT "stock_lines_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Ricerca articoli: SOLO Postgres (tsvector + trigram).
-- Niente embedding e niente RAG: i 3.456 codici COLOMBO nello stesso indice
-- semantico farebbero citare maniglie a domande sui serramenti, e peserebbero
-- su Gemini, provider unico con 429 già ricorrenti.
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX "articles_search_vector_idx" ON "articles" USING GIN ("search_vector");

-- Il nome passa dallo stemmer italiano; i CODICI no: 'simple' li lascia interi,
-- perché su `0CD41R-CM` lo stemmer italiano non ha nulla da stemmare e le sue
-- regole rischiano solo di mutilarli.
CREATE OR REPLACE FUNCTION update_article_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('italian', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple',  COALESCE(NEW.code, '')), 'B') ||
    setweight(to_tsvector('simple',  COALESCE(NEW.code_norm, '')), 'C') ||
    setweight(to_tsvector('simple',  COALESCE(NEW.ean, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER article_search_vector_update
  BEFORE INSERT OR UPDATE ON "articles"
  FOR EACH ROW
  EXECUTE FUNCTION update_article_search_vector();

-- Trigram sul nome: il listino ha refusi digitati a mano (`BOCCEHTTA` su 2
-- codici, `ROBOCINQUQ` su 1). La sola ricerca full-text NON li trova; questo
-- ramo sì. È lo stesso motivo per cui il ramo trigram esiste già sui prodotti AGB.
CREATE INDEX "articles_name_trgm_idx" ON "articles"
  USING gin ("name" gin_trgm_ops);

-- Trigram sul codice normalizzato: permette di cercare un pezzo di codice
-- («41R») senza conoscerne l'inizio. L'indice unico (brand, code_norm) copre
-- solo il prefisso, e solo a marca nota.
CREATE INDEX "articles_code_norm_trgm_idx" ON "articles"
  USING gin ("code_norm" gin_trgm_ops);
