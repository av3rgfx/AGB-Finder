import { Prisma, type PrismaClient } from "@prisma/client";
import { normalizeArticleCode } from "./code-norm";
import { SQL_FIRST_WORD, SQL_SECOND_WORD } from "./taxonomy";
import { browseLabel, foldBrowseGroups, sourceFirstWords } from "./curatela";

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

/**
 * SFOGLIO, livello 1: le prime parole della descrizione, con quanti codici
 * ciascuna. È l'unico raggruppamento che copre il 100% del listino, e l'etichetta
 * è una parola scritta da COLOMBO — non una nostra classificazione.
 *
 * `GROUP BY` su un'espressione non è esprimibile in Prisma, ed è il motivo per
 * cui sta qui e non in un modulo nuovo: `CLAUDE.md` elenca DUE moduli autorizzati
 * al raw SQL, e questo è già uno dei due. La regola di dominio «qual è la
 * famiglia» invece NON è qui: è TypeScript puro in `browse.ts`, come la
 * disponibilità sta in `stock-status.ts`.
 *
 * ORDINE ALFABETICO, e non per numerosità (verdetto `/llm-council`, confermato
 * dall'utente). Ordinare per conteggio comunica *importanza* mentre misura la
 * proliferazione di finiture del fornitore: MANIGLIONE ha 338 codici ma 160
 * descrizioni distinte, quindi il numero grosso non è «il gruppo che conta di
 * più», è «il gruppo con più varianti di colore». Sarebbe un valore deciso dal
 * programma e mai dichiarato — la classe di difetto chiusa otto volte. In più
 * spingeva in fondo LARA (28), MILLA (28), VIOLA (35): i nomi che il cliente
 * PRONUNCIA, cioè l'unico appiglio dell'agente col cliente davanti.
 *
 * L'alfabetico non promette nulla, ed è quello che risolve gratis i doppioni:
 * misurato sui 114 gruppi veri, `ROS.` e `ROSETTA` finiscono ADIACENTI, il
 * grappolo `MANIG.*`/`MANIGLIA` è contiguo, `BOCCEHTTA` (refuso del fornitore)
 * cade subito prima di `BOCCHETTA`, e `ROBOTE` — refuso di cui non sappiamo se
 * sia ROBOT o ROBOTRE — atterra esattamente in mezzo ai due. La fusione la fa
 * l'occhio di chi guarda; noi non indoviniamo niente.
 *
 * `onlyIds` è il filtro «solo pronta consegna»: la REGOLA di disponibilità NON
 * entra qui: la applica `stock-status.ts` in Prisma e a questo raw SQL arriva
 * solo una lista di id già decisa. `[]` significa «nessun articolo disponibile»
 * e restituisce zero gruppi — che è diverso da `undefined`, cioè «non filtrare».
 *
 * L'ordinamento si fa in TypeScript e non in SQL di proposito: `ORDER BY` usa la
 * COLLATION del database, che può differire fra il Postgres locale e Neon, e
 * l'ordine adesso è una promessa fatta a schermo. (Misurato: oggi i due ordini
 * coincidono su tutti e 114 i gruppi — si fissa perché resti vero.)
 */
export async function browseFirstWords(
  db: PrismaClient,
  brand: string,
  onlyIds?: string[],
): Promise<{ word: string; count: number }[]> {
  if (onlyIds && onlyIds.length === 0) return [];
  const rows = await db.$queryRaw<{ w1: string; w2: string; n: bigint }[]>`
    SELECT ${Prisma.raw(SQL_FIRST_WORD.replace(/\bname\b/, "a.name"))} AS w1,
           ${Prisma.raw(SQL_SECOND_WORD.replace(/\bname\b/, "a.name"))} AS w2,
           COUNT(*)::bigint AS n
    FROM articles a
    WHERE a.brand = ${brand}
      ${onlyIds ? Prisma.sql`AND a.id IN (${Prisma.join(onlyIds)})` : Prisma.empty}
    GROUP BY 1, 2
  `;
  return foldBrowseGroups(
    rows.map((r) => ({ first: r.w1, second: r.w2, count: Number(r.n) })),
  );
}

/**
 * Le righe di un gruppo di primo livello, in ordine di codice. Volutamente
 * TUTTE: il gruppo più numeroso del listino vero è MANIGLIONE con 338 righe, e
 * leggerle intere è ciò che permette di raggruppare per famiglia in TypeScript
 * invece di riscrivere quella regola in SQL.
 */
export async function articleIdsByFirstWord(
  db: PrismaClient,
  brand: string,
  label: string,
  onlyIds?: string[],
): Promise<{ id: string; code: string; codeNorm: string; name: string }[]> {
  if (onlyIds && onlyIds.length === 0) return [];

  // Il `WHERE` sa leggere solo la parola cruda, quindi si allarga alle sorgenti
  // dell'etichetta (`ROSETTA` ← `ROS.` + `ROSETTA`) e si RESTRINGE dopo con la
  // stessa regola del livello 1. Il secondo passaggio non è ridondante: le due
  // metà di una divisione condividono la sorgente, e senza tornerebbero unite.
  const words = sourceFirstWords(label);
  if (words.length === 0) return [];

  const rows = await db.$queryRaw<{ id: string; code: string; codeNorm: string; name: string }[]>`
    SELECT a.id, a.code, a.code_norm AS "codeNorm", a.name
    FROM articles a
    WHERE a.brand = ${brand}
      AND ${Prisma.raw(SQL_FIRST_WORD.replace(/\bname\b/, "a.name"))} IN (${Prisma.join(words)})
      ${onlyIds ? Prisma.sql`AND a.id IN (${Prisma.join(onlyIds)})` : Prisma.empty}
    ORDER BY a.code ASC
  `;
  return rows.filter((r) => browseLabel(r.name) === label);
}
