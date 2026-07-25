"use client";

import { ChevronDown } from "lucide-react";

export interface ScrollToBottomProps {
  onClick: () => void;
  visible: boolean;
}

/**
 * Pillola flottante «Scorri in fondo», ancorata sopra la Composer (il chiamante deve
 * dare `position: relative` al contenitore della lista messaggi). `bottom-20` (5rem)
 * la tiene sempre sopra la barra di composizione, che è più bassa.
 */
export function ScrollToBottom({ onClick, visible }: ScrollToBottomProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scorri in fondo"
      className="absolute bottom-20 left-1/2 z-10 inline-flex min-h-10 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-xs font-medium text-ink shadow-pop transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <ChevronDown className="size-3.5" aria-hidden />
      Scorri in fondo
    </button>
  );
}
