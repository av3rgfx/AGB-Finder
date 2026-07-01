/**
 * Single source of truth for the product embedding model + dimension.
 *
 * The pgvector column in schema.prisma (`vector(768)`) MUST equal EMBEDDING_DIM.
 * Gemini `gemini-embedding-001` (MRL) is requested with `outputDimensionality`
 * pinned to this value; embeddings must be L2-normalized before insert because
 * non-3072 outputs are not pre-normalized and search uses cosine distance.
 */
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIM = 768;
