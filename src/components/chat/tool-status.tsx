import { Loader2 } from "lucide-react";

/**
 * Chip inline mostrato mentre l'assistente esegue un tool (es. ricerca a catalogo),
 * es. «Sto cercando nel catalogo…». `role="status"` annuncia il testo agli screen
 * reader senza rubare il focus. Lo spinner usa `animate-spin` (utility di default di
 * Tailwind): il blocco `prefers-reduced-motion` globale in `globals.css` azzera già
 * `animation-duration` su `*`, quindi è inerte senza bisogno di un guard locale —
 * stesso pattern di `Button` (`loading`) e del retry in `message-bubble.tsx`.
 */
export function ToolStatus({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-full border border-info/30 bg-info/10 px-3 py-1.5 text-xs font-medium text-info"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}
