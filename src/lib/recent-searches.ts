// Rimedio READ-SIDE al logging as-you-type (prefissi, ri-log su refresh): dedup +
// collasso prefissi. RIMUOVIBILE quando il ticket "log solo ricerche committate"
// (spec §6) sarà fatto e il log conterrà solo query intenzionali.
interface SearchMeta {
  query?: unknown;
  results?: unknown;
}

export function deriveRecentSearches(
  rows: { metadata: unknown }[],
  opts: { limit?: number } = {},
): string[] {
  const limit = opts.limit ?? 8;
  const kept: string[] = []; // forma display, più recente prima
  const seen = new Set<string>(); // dedup lowercase

  for (const r of rows) {
    const meta = (r.metadata ?? {}) as SearchMeta;
    if (typeof meta.query !== "string") continue;
    const q = meta.query.trim().replace(/\s+/g, " ");
    if (!q) continue;
    if (typeof meta.results === "number" && meta.results === 0) continue;
    const lower = q.toLowerCase();
    if (seen.has(lower)) continue;
    // scarta q se prefisso stretto di una già tenuta (più recente)
    if (kept.some((k) => k.length > q.length && k.toLowerCase().startsWith(lower))) continue;
    seen.add(lower);
    kept.push(q);
    if (kept.length >= limit) break;
  }
  return kept;
}
