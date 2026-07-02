const priceFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}
