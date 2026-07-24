"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { SendHorizonal, Square } from "lucide-react";

const MAX = 4000;
/** Cap in px del textarea auto-grow (~6 righe): usato sia da JS (scrollHeight) sia da CSS
 * (max-h-[168px] sotto) come backstop nel caso l'effetto non sia ancora girato. */
const MAX_HEIGHT_PX = 168;

export interface ComposerProps {
  onSend: (text: string) => void;
  streaming: boolean;
  onStop: () => void;
  disabled?: boolean;
}

/**
 * Barra di composizione sticky in fondo alla chat. Textarea auto-grow (1 → ~6 righe),
 * Invio invia / Shift+Invio va a capo, contatore caratteri oltre soglia, bottone
 * primario che diventa STOP mentre l'assistente sta rispondendo (`streaming`).
 */
export function Composer({ onSend, streaming, onStop, disabled }: ComposerProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT_PX) + "px";
  }, [value]);

  const submit = () => {
    const t = value.trim();
    if (!t || streaming || disabled) return;
    onSend(t);
    setValue("");
  };

  return (
    <form
      className="flex items-end gap-2 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex-1">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX}
          aria-label="Messaggio per l'assistente"
          placeholder="Chiedi all'assistente…"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-[168px] w-full resize-none rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        {value.length > 3500 && (
          <p className="mt-1 text-right text-xs text-ink-subtle">
            {value.length}/{MAX}
          </p>
        )}
      </div>
      {streaming ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Interrompi"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-line-strong text-danger transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Square className="size-4" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          aria-label="Invia messaggio"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-colors duration-150 ease-out-quart hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
        >
          <SendHorizonal className="size-4" aria-hidden />
        </button>
      )}
    </form>
  );
}
