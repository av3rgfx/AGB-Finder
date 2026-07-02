const SPEC_LABELS: Record<string, string> = {
  finitura: "Finitura",
  materiale: "Materiale",
  dimensione: "Dimensione",
  mano: "Mano",
  confezione: "Confezione",
  classeSconto: "Classe sconto",
  sottocategoria: "Sottocategoria",
  gruppo: "Gruppo",
};

interface Confezione {
  scatola: number | null;
  cartone: number | null;
}

function formatValue(key: string, value: unknown): string | null {
  if (key === "confezione" && value && typeof value === "object") {
    const { scatola, cartone } = value as Confezione;
    const parts = [
      scatola !== null ? `${scatola} pz/scatola` : null,
      cartone !== null ? `${cartone} pz/cartone` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  return typeof value === "string" ? value : null;
}

export function SpecTable({ specifications }: { specifications: unknown }) {
  if (!specifications || typeof specifications !== "object") return null;
  const entries = Object.entries(specifications as Record<string, unknown>)
    .filter(([key]) => key in SPEC_LABELS)
    .map(([key, value]) => [SPEC_LABELS[key]!, formatValue(key, value)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);
  if (entries.length === 0) return null;

  return (
    <dl className="grid grid-cols-1 overflow-hidden rounded-md border border-line bg-surface sm:grid-cols-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5 border-b border-line p-3 last:border-b-0">
          <dt className="text-xs font-medium text-ink-subtle">{label}</dt>
          <dd className="text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
