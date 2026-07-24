const PREFIX = "archivio:scroll:";

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveScroll(key: string, y: number): void {
  if (!key) return;
  try {
    store()?.setItem(PREFIX + key, String(Math.round(y)));
  } catch {
    /* quota/private mode → no-op */
  }
}

export function loadScroll(key: string): number | null {
  if (!key) return null;
  try {
    const raw = store()?.getItem(PREFIX + key) ?? null;
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function clearScroll(key: string): void {
  try {
    store()?.removeItem(PREFIX + key);
  } catch {
    /* no-op */
  }
}

export interface RestoreGate {
  hasData: boolean;
  isPlaceholder: boolean;
  viewLoaded: boolean;
  categoriesReady: boolean;
  alreadyRestored: boolean;
  savedY: number | null;
}

export function shouldRestoreScroll(g: RestoreGate): boolean {
  return (
    g.hasData &&
    !g.isPlaceholder &&
    g.viewLoaded &&
    g.categoriesReady &&
    !g.alreadyRestored &&
    g.savedY !== null
  );
}
