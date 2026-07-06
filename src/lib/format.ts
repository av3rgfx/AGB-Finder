const priceFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeZone: "Europe/Rome" }); // Date sempre in fuso italiano: app B2B italiana, server (Vercel) in UTC.

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

/**
 * Istante UTC corrispondente alla mezzanotte odierna a Roma (DST inclusa).
 * Il server (Vercel) è in UTC, ma "oggi" per l'utente è il giorno di calendario
 * italiano: serve ai conteggi "oggi" della dashboard.
 */
export function startOfTodayRome(now: Date = new Date()): Date {
  // Data-calendario di Roma per `now`, es. "2026-07-06".
  const romeDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  // Mezzanotte di quella data interpretata come UTC, poi corretta dell'offset di Roma.
  const asUtc = new Date(`${romeDate}T00:00:00Z`);
  const romeShown = new Date(asUtc.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  const utcShown = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = romeShown.getTime() - utcShown.getTime();
  return new Date(asUtc.getTime() - offsetMs);
}
