export interface ArchivioFilters {
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  material?: string;
  inStockOnly?: boolean;
}

export interface ArchivioSearchState {
  query: string;
  filters: ArchivioFilters;
  page: number; // 1-based
}

function nonNegNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseSearchState(sp: URLSearchParams): ArchivioSearchState {
  const filters: ArchivioFilters = {};
  const cat = sp.get("cat");
  if (cat) filters.categoryId = cat;
  const pmin = nonNegNumber(sp.get("pmin"));
  if (pmin !== undefined) filters.priceMin = pmin;
  const pmax = nonNegNumber(sp.get("pmax"));
  if (pmax !== undefined) filters.priceMax = pmax;
  const mat = sp.get("mat");
  if (mat) filters.material = mat;
  if (sp.get("stock") === "1") filters.inStockOnly = true;

  const pRaw = Number(sp.get("p"));
  const page = Number.isInteger(pRaw) && pRaw >= 1 ? pRaw : 1;

  return { query: sp.get("q") ?? "", filters, page };
}

export function buildSearchQueryString(state: ArchivioSearchState): string {
  const sp = new URLSearchParams();
  const q = state.query.trim();
  if (q) sp.set("q", q);
  const f = state.filters;
  if (f.categoryId) sp.set("cat", f.categoryId);
  if (f.priceMin !== undefined) sp.set("pmin", String(f.priceMin));
  if (f.priceMax !== undefined) sp.set("pmax", String(f.priceMax));
  if (f.material) sp.set("mat", f.material);
  if (f.inStockOnly) sp.set("stock", "1");
  if (state.page > 1) sp.set("p", String(state.page));
  return sp.toString();
}

/** Chiave di ripristino scroll: NON include la vista (default al primo render dopo il Back). */
export function searchScrollKey(state: ArchivioSearchState): string {
  return buildSearchQueryString(state);
}
