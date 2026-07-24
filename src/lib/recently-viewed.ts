const KEY = "archivio:recently-viewed";
const CAP = 8;

export interface ViewedProduct {
  id: string;
  agbCode: string;
  name: string;
}

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getViewed(): ViewedProduct[] {
  const s = store();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (v): v is ViewedProduct =>
        !!v &&
        typeof (v as ViewedProduct).id === "string" &&
        typeof (v as ViewedProduct).agbCode === "string" &&
        typeof (v as ViewedProduct).name === "string",
    );
  } catch {
    return [];
  }
}

export function pushViewed(p: ViewedProduct): void {
  const s = store();
  if (!s) return;
  try {
    const list = getViewed().filter((v) => v.id !== p.id);
    list.unshift({ id: p.id, agbCode: p.agbCode, name: p.name });
    s.setItem(KEY, JSON.stringify(list.slice(0, CAP)));
  } catch {
    // quota/private mode → no-op
  }
}
