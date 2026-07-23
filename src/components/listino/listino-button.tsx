"use client";

import { FileSearch } from "lucide-react";
import { useListinoViewer } from "./listino-viewer-provider";

/** Pulsante «visualizza nel listino»; nascosto se il codice non ha pagina nota. */
export function ListinoButton({ code, page }: { code: string; page: number | null }) {
  const { open } = useListinoViewer();
  if (page == null) return null;
  return (
    <button
      type="button"
      onClick={() => open({ code, page })}
      aria-label={`Visualizza ${code} nel listino`}
      title="Visualizza nel listino"
      className="rounded p-1 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <FileSearch className="size-4" aria-hidden />
    </button>
  );
}
