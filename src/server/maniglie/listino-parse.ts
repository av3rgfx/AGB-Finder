import type { Prisma } from "@prisma/client";
import { normalizeArticleCode } from "./code-norm";
import { articleTotal, parseListinoDecimal } from "./price";

/**
 * Lettura del listino xlsx di una marca del reparto maniglie.
 *
 * Le colonne si riconoscono per NOME e non per posizione: il listino di Andrea è
 * «un vecchio modello» e ne arriverà uno aggiornato, quindi la posizione delle
 * colonne non è un contratto su cui appoggiarsi. Se mancano le colonne
 * obbligatorie l'import non parte affatto, invece di importare metà dati.
 *
 * Modulo puro: nessun accesso a rete, disco o database. Lo script ops gli passa
 * le righe già lette da SheetJS.
 */

export interface ListinoColumns {
  code: string;
  name: string;
  priceList: string;
  surcharge: string | null;
  declaredTotal: string | null;
  ean: string | null;
}

export interface ListinoArticle {
  code: string;
  codeNorm: string;
  name: string;
  priceList: Prisma.Decimal;
  surcharge: Prisma.Decimal | null;
  ean: string | null;
}

export interface ListinoParseResult {
  articles: ListinoArticle[];
  skipped: { row: number; reason: string; raw: unknown }[];
  /** Righe in cui priceList + surcharge non ricostruisce la colonna SOMMA. */
  totalMismatches: { code: string; computed: string; declared: string }[];
  /** Codici diversi che si riducono alla stessa chiave di aggancio. */
  duplicateNorms: { codeNorm: string; codes: string[] }[];
  /** Valorizzato solo se il foglio è inutilizzabile in blocco. */
  fatal: string | null;
}

/** Sinonimi accettati, in ordine di preferenza. Confronto su testo normalizzato. */
const SYNONYMS = {
  code: ["codice", "codicearticolo", "articolo", "cod", "code"],
  name: ["descrizione", "denominazione", "desc", "description"],
  priceList: ["prezzo", "prezzolistino", "listino", "price"],
  surcharge: ["temporarysurcharge", "surcharge", "maggiorazione", "sovrapprezzo"],
  declaredTotal: ["somma", "totale", "total"],
  ean: ["ean", "barcode", "codiceabarre", "ean13"],
} as const;

const squash = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Punteggio decrescente: combaciata esatta, poi prefisso, poi contenuta. Serve a
 * non far vincere «SOMMA PREZZO» su «PREZZO» per il solo fatto di contenerlo.
 */
function pick(headers: string[], candidates: readonly string[]): string | null {
  let best: { header: string; score: number } | null = null;
  for (const header of headers) {
    const h = squash(header);
    if (!h) continue;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]!;
      // Le candidate più avanti nella lista valgono meno, così «prezzo» batte «listino».
      const rank = candidates.length - i;
      let score = 0;
      if (h === c) score = 300 + rank;
      else if (h.startsWith(c)) score = 200 + rank;
      else if (h.includes(c)) score = 100 + rank;
      if (score && (!best || score > best.score)) best = { header, score };
    }
  }
  return best?.header ?? null;
}

export function resolveListinoColumns(headers: string[]): ListinoColumns | null {
  const code = pick(headers, SYNONYMS.code);
  const name = pick(headers, SYNONYMS.name);
  const priceList = pick(headers, SYNONYMS.priceList);
  if (!code || !name || !priceList) return null;

  const taken = new Set([code, name, priceList]);
  const takeOnce = (cands: readonly string[]) => {
    const found = pick(
      headers.filter((h) => !taken.has(h)),
      cands,
    );
    if (found) taken.add(found);
    return found;
  };

  return {
    code,
    name,
    priceList,
    surcharge: takeOnce(SYNONYMS.surcharge),
    declaredTotal: takeOnce(SYNONYMS.declaredTotal),
    ean: takeOnce(SYNONYMS.ean),
  };
}

const asText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v.trim() : String(v).trim();
};

export function parseListinoSheet(
  rows: Record<string, unknown>[],
  headers: string[],
): ListinoParseResult {
  const empty: ListinoParseResult = {
    articles: [],
    skipped: [],
    totalMismatches: [],
    duplicateNorms: [],
    fatal: null,
  };

  const cols = resolveListinoColumns(headers);
  if (!cols) {
    return {
      ...empty,
      fatal:
        "Colonne obbligatorie non trovate: servono un codice, una descrizione e un prezzo. " +
        `Intestazioni lette: ${headers.join(" · ")}`,
    };
  }

  const result: ListinoParseResult = { ...empty, articles: [], skipped: [] };
  const seen = new Map<string, string[]>();

  rows.forEach((raw, i) => {
    // +2: la riga 1 del foglio è l'intestazione, e gli umani contano da 1.
    const rowNumber = i + 2;
    const code = asText(raw[cols.code]);
    if (!code) {
      result.skipped.push({ row: rowNumber, reason: "codice mancante", raw });
      return;
    }
    const codeNorm = normalizeArticleCode(code);
    if (!codeNorm) {
      result.skipped.push({ row: rowNumber, reason: "codice privo di caratteri utili", raw });
      return;
    }
    const priceList = parseListinoDecimal(raw[cols.priceList]);
    if (!priceList) {
      result.skipped.push({ row: rowNumber, reason: "prezzo mancante o non numerico", raw });
      return;
    }

    const surchargeRaw = cols.surcharge ? parseListinoDecimal(raw[cols.surcharge]) : null;
    // Si arrotondano ENTRAMBE le metà qui: le colonne a DB sono Decimal(12,2), e
    // lasciar arrotondare Postgres significherebbe controllare l'invariante su
    // numeri diversi da quelli poi salvati.
    const price2 = priceList.toDecimalPlaces(2);
    const surcharge2 = surchargeRaw ? surchargeRaw.toDecimalPlaces(2) : null;

    if (cols.declaredTotal) {
      const declared = parseListinoDecimal(raw[cols.declaredTotal]);
      if (declared) {
        const computed = articleTotal(price2, surcharge2);
        const declared2 = declared.toDecimalPlaces(2);
        if (!computed.equals(declared2)) {
          result.totalMismatches.push({
            code,
            computed: computed.toString(),
            declared: declared2.toString(),
          });
        }
      }
    }

    const ean = cols.ean ? asText(raw[cols.ean]) : "";
    const name = asText(raw[cols.name]) || code;

    seen.set(codeNorm, [...(seen.get(codeNorm) ?? []), code]);
    result.articles.push({
      code,
      codeNorm,
      name,
      priceList: price2,
      surcharge: surcharge2,
      ean: ean || null,
    });
  });

  for (const [codeNorm, codes] of seen) {
    if (codes.length > 1) result.duplicateNorms.push({ codeNorm, codes });
  }

  return result;
}
