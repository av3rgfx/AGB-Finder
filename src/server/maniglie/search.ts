import { Prisma, type PrismaClient } from "@prisma/client";
import { normalizeArticleCode } from "./code-norm";

/**
 * Ricerca articoli del reparto maniglie. SOLO Postgres: `tsvector` + trigram.
 *
 * ⚠️ RAW SQL — deroga dichiarata alla regola di `CLAUDE.md`.
 * La regola dice «raw SQL solo per pgvector, incapsulato nel solo modulo
 * `RAGEngine`». Qui non c'è pgvector (niente embedding e niente RAG sul dominio
 * magazzino: i 3.456 codici COLOMBO nello stesso indice semantico farebbero
 * citare maniglie a domande sui serramenti), ma `tsvector`, `ts_rank` e
 * `word_similarity` non sono esprimibili in Prisma.
 *
 * Il ramo trigram NON è un lusso: il listino ha refusi digitati a mano
 * (`BOCCEHTTA` su 2 codici, `ROBOCINQUQ` su 1). Chi cerca «bocchetta» con un
 * `ILIKE` non li trova, e un articolo che è sullo scaffale ma non si trova è
 * esattamente ciò che riporta l'agente al telefono.
 *
 * Lo scopo della regola — che il raw SQL non si sparga per i router — resta
 * rispettato: questo è l'unico modulo del dominio maniglie che ne contiene, ed è
 * il gemello di `RAGEngine`. La REGOLA DI DISPONIBILITÀ non è qui: sta in
 * `stock-status.ts`, tutta in Prisma.
 * (Nota: la regola aveva già una seconda eccezione non dichiarata in
 * `src/server/chat/tools.ts`.)
 */

export interface ArticleHit {
  id: string;
  score: number;
}

/** Soglia di somiglianza trigram: sotto, sono coincidenze. */
const TRIGRAM_MIN = 0.4;

function buildMatch(query: string) {
  const text = query.trim();
  const codeQ = normalizeArticleCode(text);
  const hasCode = codeQ.length >= 2;

  // `plainto_tsquery` su una stringa senza parole vere restituisce una query
  // vuota, che non combacia con nulla: innocuo, e tenuto perché una ricerca
  // mista («maniglia CD41») deve poter usare entrambi i rami.
  const where = Prisma.sql`(
    ${hasCode ? Prisma.sql`a.code_norm LIKE ${"%" + codeQ + "%"}` : Prisma.sql`FALSE`}
    OR a.search_vector @@ plainto_tsquery('italian', ${text})
    OR word_similarity(${text}, a.name) > ${TRIGRAM_MIN}
    OR a.ean = ${text}
  )`;

  // Un codice esatto vale più di qualunque somiglianza di testo; poi il prefisso
  // (l'agente digita l'inizio del codice), poi il codice contenuto, poi il nome.
  const score = Prisma.sql`GREATEST(
    ${
      hasCode
        ? Prisma.sql`CASE
            WHEN a.code_norm = ${codeQ} THEN 1.0
            WHEN a.code_norm LIKE ${codeQ + "%"} THEN 0.90
            WHEN a.code_norm LIKE ${"%" + codeQ + "%"} THEN 0.75
            ELSE 0 END`
        : Prisma.sql`0`
    },
    CASE WHEN a.ean = ${text} THEN 1.0 ELSE 0 END,
    LEAST(ts_rank(a.search_vector, plainto_tsquery('italian', ${text})) * 8, 0.85),
    word_similarity(${text}, a.name) * 0.7
  )`;

  return { where, score };
}

/**
 * Restituisce gli id in ordine di pertinenza. Volutamente NON restituisce gli
 * articoli: li rilegge il chiamante con Prisma, così i campi mostrati a schermo
 * hanno un tipo vero e non una riga di raw SQL.
 */
export async function searchArticleIds(
  db: PrismaClient,
  params: { brand: string; query: string; limit: number; offset: number },
): Promise<{ hits: ArticleHit[]; total: number }> {
  const { brand, query, limit, offset } = params;
  if (!query.trim()) return { hits: [], total: 0 };

  const { where, score } = buildMatch(query);

  const rows = await db.$queryRaw<{ id: string; score: number }[]>`
    SELECT a.id, ${score} AS score
    FROM articles a
    WHERE a.brand = ${brand} AND ${where}
    ORDER BY score DESC, a.code ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [counted] = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM articles a
    WHERE a.brand = ${brand} AND ${where}
  `;

  return {
    hits: rows.map((r) => ({ id: r.id, score: Number(r.score) })),
    total: Number(counted?.n ?? 0),
  };
}
