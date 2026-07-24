/**
 * Valida il parametro `page` della route del listino prima di sostituirlo nel
 * template URL (anti-SSRF / path-injection). Accetta SOLO interi 1-based
 * canonici (niente zeri iniziali, segni, float, notazione esponenziale o spazi)
 * entro `[1, total]`. Qualsiasi altra forma → `null` (la route risponde 400).
 */
export function parsePageParam(raw: string | null, total: number): number | null {
  if (raw == null || !/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1 || n > total) return null;
  return n;
}
