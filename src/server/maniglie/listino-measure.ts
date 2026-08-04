import { normalizeArticleCode } from "./code-norm";

/**
 * Le cinque misure di §7 della spec «Sfoglia», su un listino vero.
 *
 * Servono a decidere UNA cosa prima di scrivere interfaccia: se la prima parola
 * della descrizione del listino sia una tassonomia sfogliabile (≤ ~40 gruppi) o
 * un elenco di trecento parole, che non si sfoglia.
 *
 * Perché un modulo puro e non solo uno script: la misura (a) è la stessa cosa
 * che poi calcolerà un `GROUP BY` in `search.ts`, e le due definizioni di «prima
 * parola» devono coincidere — se qui si collassano gli spazi multipli e in SQL
 * no, il numero misurato non è il numero che l'agente vedrà. Il gemello SQL di
 * `firstWord` è:
 *
 *   split_part(regexp_replace(upper(trim(name)), '\s+', ' ', 'g'), ' ', 1)
 *
 * Nessun accesso a rete, disco o database: lo script gli passa le righe già
 * lette da `parseListinoSheet`.
 */

export interface MeasuredArticle {
  code: string;
  codeNorm: string;
  name: string;
}

export interface WordGroup {
  word: string;
  count: number;
  /** Fino a tre descrizioni intere, per poter guardare il gruppo a occhio. */
  examples: string[];
}

export interface ListinoMeasures {
  total: number;
  /** (a) quante prime parole distinte, e come sono distribuite. */
  firstWords: {
    distinct: number;
    groups: WordGroup[];
    /** Quante parole servono per coprire il 95% dei codici. */
    wordsFor95: number;
    /** Gruppi da un codice solo: è lì che si annidano refusi e nomi di modello. */
    singletons: number;
    /** Descrizioni con spazi doppi o tabulazioni: dicono se il gemello SQL ha bisogno della regexp. */
    irregularWhitespace: number;
  };
  /** (b) il secondo token della descrizione è la famiglia del codice? */
  secondTokenIsFamily: {
    matched: number;
    ratio: number;
    /**
     * Lo stesso rapporto, gruppo per gruppo. Un numero unico mescolerebbe le
     * maniglie — che una famiglia di modello ce l'hanno — con viti, molle e
     * bussole, che non ce l'hanno e non si sfogliano per modello.
     */
    byFirstWord: { word: string; total: number; matched: number; ratio: number }[];
    counterExamples: { code: string; name: string; token: string }[];
  };
  /** (c) e (d) le famiglie, contate sui soli secondi token che agganciano il codice. */
  families: {
    distinct: number;
    medianCodes: number;
    largest: WordGroup | null;
    groups: WordGroup[];
  };
  /** (e) la coda dopo l'ultimo separatore del codice: è la finitura, o non lo è. */
  tails: {
    withSeparator: number;
    distinct: number;
    groups: WordGroup[];
  };
}

/** Prima parola della descrizione, in maiuscolo. Spazi multipli collassati. */
export function firstWord(name: string): string {
  return name.trim().toUpperCase().split(/\s+/)[0] ?? "";
}

/** Secondo token della descrizione, in maiuscolo. `null` se la descrizione ha una parola sola. */
export function secondToken(name: string): string | null {
  const parts = name.trim().toUpperCase().split(/\s+/);
  return parts.length >= 2 ? parts[1]! : null;
}

/**
 * Coda dopo l'ULTIMO separatore del codice. `null` quando il codice non ha
 * separatori — la coda non esiste, e non è la stringa vuota: `0CD41RCB` è un
 * codice intero, non un codice con la finitura mancante.
 */
export function codeTail(code: string): string | null {
  const m = /[^A-Za-z0-9]([A-Za-z0-9]+)$/.exec(code.trim());
  return m ? m[1]!.toUpperCase() : null;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Raggruppa per parola, ordinato per frequenza decrescente e poi alfabetico. */
function group(entries: { word: string; example: string }[]): WordGroup[] {
  const map = new Map<string, WordGroup>();
  for (const { word, example } of entries) {
    const g = map.get(word) ?? { word, count: 0, examples: [] };
    g.count++;
    if (g.examples.length < 3) g.examples.push(example);
    map.set(word, g);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/**
 * Un token di un carattere solo aggancerebbe quasi qualunque codice per puro
 * caso: sotto i due caratteri non si conta come famiglia.
 */
const MIN_FAMILY_LEN = 2;

export function measureListino(articles: MeasuredArticle[]): ListinoMeasures {
  const total = articles.length;

  const firstWordGroups = group(
    articles.map((a) => ({ word: firstWord(a.name), example: a.name })),
  );

  let cumulative = 0;
  let wordsFor95 = 0;
  for (const g of firstWordGroups) {
    if (cumulative / total >= 0.95) break;
    cumulative += g.count;
    wordsFor95++;
  }

  const counterExamples: { code: string; name: string; token: string }[] = [];
  const familyEntries: { word: string; example: string }[] = [];
  const perWord = new Map<string, { word: string; total: number; matched: number }>();

  for (const a of articles) {
    const head = firstWord(a.name);
    const row = perWord.get(head) ?? { word: head, total: 0, matched: 0 };
    row.total++;

    const token = secondToken(a.name);
    const norm = token ? normalizeArticleCode(token) : "";
    if (token && norm.length >= MIN_FAMILY_LEN && a.codeNorm.includes(norm)) {
      familyEntries.push({ word: token, example: a.name });
      row.matched++;
    } else if (token) {
      counterExamples.push({ code: a.code, name: a.name, token });
    }
    perWord.set(head, row);
  }

  const familyGroups = group(familyEntries);
  const tailGroups = group(
    articles
      .map((a) => ({ tail: codeTail(a.code), name: a.name }))
      .filter((x): x is { tail: string; name: string } => x.tail !== null)
      .map((x) => ({ word: x.tail, example: x.name })),
  );

  return {
    total,
    firstWords: {
      distinct: firstWordGroups.length,
      groups: firstWordGroups,
      wordsFor95,
      singletons: firstWordGroups.filter((g) => g.count === 1).length,
      irregularWhitespace: articles.filter((a) => /\s\s|\t/.test(a.name.trim())).length,
    },
    secondTokenIsFamily: {
      matched: familyEntries.length,
      ratio: total === 0 ? 0 : familyEntries.length / total,
      byFirstWord: [...perWord.values()]
        .map((r) => ({ ...r, ratio: r.matched / r.total }))
        .sort((a, b) => b.total - a.total || a.word.localeCompare(b.word)),
      counterExamples,
    },
    families: {
      distinct: familyGroups.length,
      medianCodes: median(familyGroups.map((g) => g.count)),
      largest: familyGroups[0] ?? null,
      groups: familyGroups,
    },
    tails: {
      withSeparator: tailGroups.reduce((n, g) => n + g.count, 0),
      distinct: tailGroups.length,
      groups: tailGroups,
    },
  };
}
