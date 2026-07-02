import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { EmbeddingService } from "./embedding";

export interface SearchFilters {
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  material?: string;
  inStockOnly?: boolean;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
}

export interface SearchHit {
  id: string;
  agbCode: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  priceUnit: string;
  isAvailable: boolean;
  stockQuantity: number;
  categoryId: string;
  categoryName: string;
  textScore: number;
  vectorScore: number;
  score: number;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  queryTimeMs: number;
}

export interface RelatedHit {
  id: string;
  agbCode: string;
  name: string;
  basePrice: number;
  categoryName: string;
  isAvailable: boolean;
}

type RagDb = Pick<PrismaClient, "$queryRaw">;

const HIT_PROJECTION = Prisma.sql`
  p.id,
  p.agb_code            AS "agbCode",
  p.name,
  p.short_description   AS "shortDescription",
  p.base_price::float8  AS "basePrice",
  p.price_unit          AS "priceUnit",
  p.is_available        AS "isAvailable",
  p.stock_quantity      AS "stockQuantity",
  p.category_id         AS "categoryId",
  c.name                AS "categoryName"`;

function buildFilterSql(filters: SearchFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (filters.categoryId) conditions.push(Prisma.sql`p.category_id = ${filters.categoryId}`);
  if (filters.priceMin !== undefined)
    conditions.push(Prisma.sql`p.base_price >= ${filters.priceMin}`);
  if (filters.priceMax !== undefined)
    conditions.push(Prisma.sql`p.base_price <= ${filters.priceMax}`);
  if (filters.material) {
    conditions.push(
      Prisma.sql`p.specifications->>'materiale' ILIKE ${"%" + filters.material + "%"}`,
    );
  }
  if (filters.inStockOnly) conditions.push(Prisma.sql`p.is_available = true`);
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`AND ${Prisma.join(conditions, " AND ")}`;
}

/**
 * UNICO modulo dell'app autorizzato al raw SQL (regola di progetto): pgvector e
 * tsvector non sono esprimibili in Prisma Client. Tutto parametrizzato via
 * Prisma.sql — MAI interpolazione di stringhe.
 *
 * Degradazione graceful: senza EmbeddingService la ricerca usa solo il ramo
 * tsvector; con embeddings combina i punteggi (0.4 testo, 0.6 vettore).
 */
export class RAGEngine {
  constructor(
    private readonly db: RagDb,
    private readonly embeddings?: EmbeddingService,
  ) {}

  async search(
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {},
  ): Promise<SearchResult> {
    const startedAt = performance.now();
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const filterSql = buildFilterSql(filters);
    const codePrefix = query + "%";

    const embedding = this.embeddings ? await this.embeddings.generate(query) : null;
    const hits = embedding
      ? await this.hybridSearch(query, codePrefix, embedding, filterSql, limit, offset)
      : await this.textSearch(query, codePrefix, filterSql, limit, offset);

    // total = match del ramo testuale (il ramo vettoriale integra solo il ranking).
    const totalRows = await this.db.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT count(*)::int AS total
      FROM products p
      WHERE (p.search_vector @@ plainto_tsquery('italian', ${query})
             OR p.agb_code ILIKE ${codePrefix})
        ${filterSql}`);

    return {
      hits,
      total: totalRows[0]?.total ?? 0,
      queryTimeMs: Math.round(performance.now() - startedAt),
    };
  }

  private textSearch(
    query: string,
    codePrefix: string,
    filterSql: Prisma.Sql,
    limit: number,
    offset: number,
  ): Promise<SearchHit[]> {
    return this.db.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT ${HIT_PROJECTION},
        ts_rank(p.search_vector, plainto_tsquery('italian', ${query}))::float8 AS "textScore",
        0::float8 AS "vectorScore",
        (CASE WHEN p.agb_code ILIKE ${codePrefix} THEN 1.0 ELSE 0.0 END
          + ts_rank(p.search_vector, plainto_tsquery('italian', ${query})))::float8 AS score
      FROM products p
      JOIN product_categories c ON c.id = p.category_id
      WHERE (p.search_vector @@ plainto_tsquery('italian', ${query})
             OR p.agb_code ILIKE ${codePrefix})
        ${filterSql}
      ORDER BY score DESC, p.agb_code ASC
      LIMIT ${limit} OFFSET ${offset}`);
  }

  private hybridSearch(
    query: string,
    codePrefix: string,
    embedding: number[],
    filterSql: Prisma.Sql,
    limit: number,
    offset: number,
  ): Promise<SearchHit[]> {
    const vectorParam = `[${embedding.join(",")}]`;
    return this.db.$queryRaw<SearchHit[]>(Prisma.sql`
      WITH text_hits AS (
        SELECT p.id,
               ts_rank(p.search_vector, plainto_tsquery('italian', ${query}))::float8 AS text_score
        FROM products p
        WHERE p.search_vector @@ plainto_tsquery('italian', ${query})
           OR p.agb_code ILIKE ${codePrefix}
      ),
      vector_hits AS (
        SELECT p.id, (1 - (p.embedding <=> ${vectorParam}::vector))::float8 AS vector_score
        FROM products p
        WHERE p.embedding IS NOT NULL
        ORDER BY p.embedding <=> ${vectorParam}::vector
        LIMIT 100
      ),
      combined AS (
        SELECT COALESCE(t.id, v.id)        AS id,
               COALESCE(t.text_score, 0)   AS text_score,
               COALESCE(v.vector_score, 0) AS vector_score
        FROM text_hits t
        FULL OUTER JOIN vector_hits v ON v.id = t.id
      )
      SELECT ${HIT_PROJECTION},
        combined.text_score   AS "textScore",
        combined.vector_score AS "vectorScore",
        (CASE WHEN p.agb_code ILIKE ${codePrefix} THEN 1.0 ELSE 0.0 END
          + 0.4 * combined.text_score + 0.6 * combined.vector_score)::float8 AS score
      FROM combined
      JOIN products p ON p.id = combined.id
      JOIN product_categories c ON c.id = p.category_id
      WHERE TRUE ${filterSql}
      ORDER BY score DESC, p.agb_code ASC
      LIMIT ${limit} OFFSET ${offset}`);
  }

  /** Prodotti correlati: stessa categoria; ordina per similarità coseno se gli embedding esistono. */
  getRelated(productId: string, limit = 4): Promise<RelatedHit[]> {
    return this.db.$queryRaw<RelatedHit[]>(Prisma.sql`
      SELECT p.id,
             p.agb_code           AS "agbCode",
             p.name,
             p.base_price::float8 AS "basePrice",
             c.name               AS "categoryName",
             p.is_available       AS "isAvailable"
      FROM products src
      JOIN products p ON p.category_id = src.category_id AND p.id <> src.id
      JOIN product_categories c ON c.id = p.category_id
      WHERE src.id = ${productId}
      ORDER BY (CASE WHEN src.embedding IS NOT NULL AND p.embedding IS NOT NULL
                     THEN p.embedding <=> src.embedding END) ASC NULLS LAST,
               p.name ASC
      LIMIT ${limit}`);
  }
}
