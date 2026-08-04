import { Prisma } from "@prisma/client";

/**
 * Il prezzo di un articolo a listino, in due metà.
 *
 * Andrea: «nel listino è presente il prezzo già sommato e l'agente deve vedere
 * quello». Si mostra il totale, ma si salvano `priceList` e `surcharge`
 * separatamente: il *temporary surcharge* del 3,5% è temporaneo per definizione, e
 * il giorno che sparisce serve sapere quale metà togliere. Verificato su tutte e
 * 3.456 le righe che arrotondare le due metà e sommarle dà lo stesso risultato
 * della colonna SOMMA arrotondata (zero differenze).
 *
 * Il totale è DERIVATO e non si persiste mai — stessa regola di `totalPrice` nel
 * kit: due totali a DB divergono al primo bug.
 */

/**
 * Somma le due metà e arrotonda a 2 decimali, in `Decimal` e mai in virgola
 * mobile: il 96% delle righe della colonna SOMMA ha più di due decimali e il 36%
 * ne ha 13-16 per errori float di Excel (`99,25649999999999`), quindi il file non
 * è mostrabile com'è. Un `toFixed(2)` su `104.535` restituirebbe `104.53`, perché
 * quel valore in binario è `104.53499999999999` — di qui il vincolo sul tipo.
 */
export function articleTotal(
  priceList: Prisma.Decimal,
  surcharge: Prisma.Decimal | null,
): Prisma.Decimal {
  return priceList
    .plus(surcharge ?? 0)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Legge una cella di prezzo del listino. SheetJS restituisce un numero nativo
 * quando la cella è numerica, ma un file esportato altrove può contenere testo
 * italiano (`1.234,56`, `€ 104,54`).
 *
 * Restituisce `null` su cella vuota o non numerica invece di ripiegare su zero:
 * il listino misurato non ha prezzi mancanti, ma un file futuro può averne, e un
 * prezzo inventato a zero verrebbe letto a voce a un cliente.
 */
export function parseListinoDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? new Prisma.Decimal(value) : null;
  }
  if (typeof value !== "string") return null;

  // Via simbolo di valuta, spazi (anche unificatori) e segni di formattazione.
  const cleaned = value.replace(/[€\s ]/g, "");
  if (cleaned === "") return null;

  // Separatore decimale = l'ULTIMO fra punto e virgola; l'altro è delle migliaia.
  // Copre sia `1.234,56` (italiano) sia `1234.56` (esportazione inglese).
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    normalized = cleaned.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".");
  } else {
    normalized = cleaned;
  }

  if (!/^-?\d*\.?\d+$/.test(normalized)) return null;
  try {
    return new Prisma.Decimal(normalized);
  } catch {
    return null;
  }
}
