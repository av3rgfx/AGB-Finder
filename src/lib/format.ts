const priceFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeZone: "Europe/Rome" }); // Date sempre in fuso italiano: app B2B italiana, server (Vercel) in UTC.

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}
