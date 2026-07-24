export interface HasDate {
  updatedAt: Date;
}

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function groupConversations<T extends HasDate>(
  items: T[],
  now: Date
): { label: string; items: T[] }[] {
  const today = startOfDay(now).getTime();
  const day = 86_400_000;
  const buckets: { label: string; min: number; items: T[] }[] = [
    { label: "Oggi", min: today, items: [] },
    { label: "Ieri", min: today - day, items: [] },
    { label: "Ultimi 7 giorni", min: today - 7 * day, items: [] },
    { label: "Più vecchie", min: -Infinity, items: [] },
  ];
  for (const it of items) {
    const t = it.updatedAt.getTime();
    const bucket = buckets.find((b) => t >= b.min);
    (bucket ?? buckets[buckets.length - 1]!).items.push(it);
  }
  return buckets
    .filter((b) => b.items.length > 0)
    .map(({ label, items }) => ({ label, items }));
}
