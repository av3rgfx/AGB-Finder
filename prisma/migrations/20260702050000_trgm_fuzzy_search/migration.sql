-- pg_trgm: ricerca fuzzy per flessioni italiane (cerniera/Cerniere) che lo
-- stemmer 'italian' non copre (asimmetria: 'cerniere'→cern, 'cerniera'→cernier).
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Indice GIN trigram sull'espressione usata dal RAGEngine (name + short_description).
-- L'espressione DEVE combaciare esattamente con quella nelle query (word_similarity / <%).
CREATE INDEX "products_fuzzy_trgm_idx" ON "products"
  USING gin ((name || ' ' || coalesce(short_description, '')) gin_trgm_ops);
