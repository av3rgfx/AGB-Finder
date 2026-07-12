import { KitGenerationError, type KitLine } from "./types";

/** Sceglie la riga il cui range [min,max] contiene `value`; a parità vince lo span più stretto. */
export function pick<T extends { minH?: number; maxH?: number; minL?: number; maxL?: number }>(
  table: readonly T[], value: number, kind: "H" | "L", ruleId: string, label: string,
): T {
  let best: T | undefined;
  let bestSpan = Infinity;
  for (const row of table) {
    const min = kind === "H" ? (row.minH ?? 0) : (row.minL ?? 0);
    const max = kind === "H" ? (row.maxH ?? Infinity) : (row.maxL ?? Infinity);
    if (value < min || value > max) continue;
    const span = max - min;
    if (span < bestSpan) { best = row; bestSpan = span; }
  }
  if (!best)
    throw new KitGenerationError(
      `Nessuna variante ${label} per ${kind === "H" ? "altezza" : "larghezza"} ${value} mm: fuori campo di applicazione.`,
      ruleId,
    );
  return best;
}

/** Mappa una lista di parti fisse (o di gruppo) in righe KitLine con un ruleId comune. */
export function linesFromParts(
  parts: readonly { position: string; code: string; quantity: number; descr: string }[],
  ruleId: string,
): KitLine[] {
  return parts.map((p) => ({
    position: p.position, code: p.code, quantity: p.quantity, ruleId, ruleDescription: p.descr,
  }));
}

/** Lookup con guardia tipizzata: chiave assente → KitGenerationError (mai kit monco). */
export function requireKey<T>(map: Record<string, T>, key: string, ruleId: string, message: string): T {
  const v = map[key];
  if (v === undefined) throw new KitGenerationError(message, ruleId);
  return v;
}
