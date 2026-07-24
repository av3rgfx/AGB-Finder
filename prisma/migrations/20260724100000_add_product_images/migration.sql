-- CreateTable: foto prodotto estratte dal listino PDF (feature «immagini prodotto»).
-- Tabella separata da products: i byte non vengono mai tirati dentro le query di catalogo.
CREATE TABLE "product_images" (
    "agb_code" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_images_pkey" PRIMARY KEY ("agb_code")
);
