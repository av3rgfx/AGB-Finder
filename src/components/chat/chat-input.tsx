"use client";

import { useState } from "react";
import { SendHorizonal } from "lucide-react";

const MAX_LENGTH = 4000;

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const content = value.trim();
    if (!content || disabled) return;
    onSend(content);
    setValue("");
  };

  return (
    <form
      className="flex items-end gap-2 border-t border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label="Messaggio per l'assistente"
        placeholder="Chiedi all'assistente… (Invio per inviare)"
        rows={2}
        maxLength={MAX_LENGTH}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="flex-1 resize-none rounded border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        aria-label="Invia messaggio"
        className="inline-flex items-center gap-2 rounded bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 ease-out-quart hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
      >
        <SendHorizonal className="size-4" aria-hidden />
        Invia
      </button>
    </form>
  );
}
