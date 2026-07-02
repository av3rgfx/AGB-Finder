import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/server/db";
import { getEmbeddingService, type EmbeddingService } from "./embedding";

/**
 * RAGEngine — hybrid product search.
 *
 * ⚠️ THE ONLY MODULE ALLOWED TO USE RAW SQL (project rule): pgvector operators
 * (`<=>`) and Postgres full-text (`plainto_tsquery`) have no Prisma-client
 * equivalent. Everything is parameterized via Prisma.sql — never interpolate
 * user input into SQL text.
 *
 * Fase 1b: embeddings are null in the DB and no EmbeddingService is wired →
 * the engine runs the tsvector-only branch. When embeddings arrive (BullMQ
 * batch, Fase ≥1c) the hybrid branch activates without code changes.
 */

export interface SearchFilters {
  categoryId?: string;
  material?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface SearchHit {
  id: string;
  agbCode: string;
  sku: string;
  name: string;
  description: string | null;
  basePrice: number;
  discountedPrice: number | null;
  stockQuantity: number;
  isAvailable: boolean;
  imageUrls: string[];
  specifications: unknown;
  categoryName: string;
  categorySlug: string;
  textScore: number;
  vectorScore: number;
}

export interface RelatedHit {
  id: string;
  agbCode: string;
  name: string;
  basePrice: number;
  imageUrls: string[];
}

const TEXT_WEIGHT = 0.4;
const VECTOR_WEIGHT = 0.6;

export class RAGEngine {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly embeddings: EmbeddingService | null = null,
  ) {}

  private filterSql(f: SearchFilters): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`p.is_available = true`];
    if (f.categoryId) parts.push(Prisma.sql`p.category_id = ${f.categoryId}`);
    if (f.material) parts.push(Prisma.sql`p.specifications->>'materiale' = ${f.material}`);
    if (f.minPrice !== undefined) parts.push(Prisma.sql`p.base_price >= ${f.minPrice}`);
    if (f.maxPrice !== undefined) parts.push(Prisma.sql`p.base_price <= ${f.maxPrice}`);
    if (f.inStock) parts.push(Prisma.sql`p.stock_quantity > 0`);
    return Prisma.join(parts, " AND ");
  }

  async search(
    query: string,
    filters: SearchFilters = {},
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{ hits: SearchHit[]; queryTimeMs: number }> {
    const start = Date.now();
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;
    const where = this.filterSql(filters);

    const queryEmbedding = this.embeddings
      ? await this.embeddings.generate(query, "RETRIEVAL_QUERY")
      : null;

    const select = Prisma.sql`
      p.id, p.agb_code as "agbCode", p.sku, p.name, p.description,
      p.base_price::float8 as "basePrice", p.discounted_price::float8 as "discountedPrice",
      p.stock_quantity as "stockQuantity", p.is_available as "isAvailable",
      p.image_urls as "imageUrls", p.specifications,
      c.name as "categoryName", c.slug as "categorySlug"`;

    let hits: SearchHit[];
    if (!queryEmbedding) {
      // Full-text only (Fase 1b default: embedding column is null everywhere).
      hits = await this.prisma.$queryRaw<SearchHit[]>`
        SELECT ${select},
          ts_rank(p.search_vector, plainto_tsquery('italian', ${query}))::float8 as "textScore",
          0::float8 as "vectorScore"
        FROM products p
        JOIN product_categories c ON p.category_id = c.id
        WHERE p.search_vector @@ plainto_tsquery('italian', ${query}) AND ${where}
        ORDER BY "textScore" DESC, p.agb_code ASC
        LIMIT ${limit} OFFSET ${offset}`;
    } else {
      // Hybrid: weighted tsvector (0.4) + cosine similarity (0.6), per architecture doc.
      const vec = `[${queryEmbedding.join(",")}]`;
      hits = await this.prisma.$queryRaw<SearchHit[]>`
        SELECT ${select},
          COALESCE(ts_rank(p.search_vector, plainto_tsquery('italian', ${query})), 0)::float8 as "textScore",
          COALESCE(1 - (p.embedding <=> ${vec}::vector), 0)::float8 as "vectorScore"
        FROM products p
        JOIN product_categories c ON p.category_id = c.id
        WHERE (p.search_vector @@ plainto_tsquery('italian', ${query})
               OR (p.embedding IS NOT NULL AND p.embedding <=> ${vec}::vector < 0.7))
          AND ${where}
        ORDER BY (COALESCE(ts_rank(p.search_vector, plainto_tsquery('italian', ${query})), 0) * ${TEXT_WEIGHT}
                + COALESCE(1 - (p.embedding <=> ${vec}::vector), 0) * ${VECTOR_WEIGHT}) DESC,
                p.agb_code ASC
        LIMIT ${limit} OFFSET ${offset}`;
    }

    return { hits, queryTimeMs: Date.now() - start };
  }

  /** Same-category related products: vector distance when embeddings exist, else name order. */
  async getRelated(productId: string, limit = 5): Promise<RelatedHit[]> {
    return this.prisma.$queryRaw<RelatedHit[]>`
      SELECT p.id, p.agb_code as "agbCode", p.name,
             p.base_price::float8 as "basePrice", p.image_urls as "imageUrls"
      FROM products p, products ref
      WHERE ref.id = ${productId} AND p.id != ref.id AND p.category_id = ref.category_id
        AND p.is_available = true
      ORDER BY (p.embedding <=> ref.embedding) ASC NULLS LAST, p.name ASC
      LIMIT ${limit}`;
  }
}

/** Runtime singleton — tsvector-only while GEMINI_API_KEY is unset. */
export const ragEngine = new RAGEngine(db, getEmbeddingService());
