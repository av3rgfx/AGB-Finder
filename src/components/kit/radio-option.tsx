"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RadioOption({
  name,
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  name: string;
  label: string;
  // ReactNode e non string: gli hint dell'entrata citano codici prodotto, e la
  // regola inviolabile «codici in font monospace» richiede di avvolgerli in uno
  // <span> — impossibile dentro una stringa semplice. Tutti i chiamanti esistenti
  // passano stringhe, che sono già ReactNode: nessuno si rompe.
  hint?: ReactNode;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const hintId = useId();
  return (
    <label
      className={cn(
        "flex flex-col gap-0.5 rounded border px-3 py-2.5 text-sm transition-colors",
        disabled
          ? "cursor-not-allowed border-line bg-surface-sunken text-ink-subtle"
          : checked
            ? "cursor-pointer border-brand bg-brand-light text-brand"
            : "cursor-pointer border-line-strong text-ink hover:bg-surface-sunken",
      )}
    >
      <span className="flex items-center gap-2">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          // aria-label tiene l'hint fuori dal nome accessibile (che il <label>
          // avvolgente includerebbe); l'hint resta annunciato come descrizione.
          aria-label={hint ? label : undefined}
          aria-describedby={hint ? hintId : undefined}
          className="accent-brand"
        />
        {label}
      </span>
      {hint && (
        <span id={hintId} className="pl-6 text-xs text-ink-subtle">
          {hint}
        </span>
      )}
    </label>
  );
}