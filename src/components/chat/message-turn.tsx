"use client";

import { useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownMessage } from "./markdown-message";
import { InlineProducts } from "./inline-products";
import type { ChatProductSummary } from "@/lib/chat/chat-events";

/** Stesso set di valori di `MessageStatus` in schema.prisma, duplicato come tipo letterale
 * per non importare dal client i tipi generati da Prisma (pattern già in uso in
 * `chat-events.ts` / `error-banner.tsx` per gli shape lato server). */
export type MessageTurnStatus = "PENDING" | "SENT" | "ERROR" | "STREAMING";

export interface MessageTurnProps {
  role: "USER" | "ASSISTANT";
  content: string;
  status?: MessageTurnStatus;
  errorMessage?: string | null;
  products?: ChatProductSummary[];
  /** True mentre QUESTO turno assistant sta ricevendo testo in streaming (cursore lampeggiante,
   * niente azioni Copia/Rigenera finché non si ferma). */
  streaming?: boolean;
  /** Rigenera la risposta: usato sia dall'azione «Rigenera» su una risposta completata sia dal
   * retry sullo stato ERROR — nel chiamante è lo stesso flusso (`mode: "regenerate"`). */
  onRegenerate?: () => void;
  /** True mentre una rigenerazione è già in corso: disabilita il bottone e ne anima l'icona. */
  regenerating?: boolean;
}

/**
 * Un turno della conversazione. Utente: pill compatta allineata a destra su
 * `surface-sunken`. Assistente: blocco full-width SENZA bolla e senza bordo sinistro
 * colorato (decisione di design approvata dall'utente, sostituisce `message-bubble.tsx`) —
 * un piccolo marchio "Assistente" (pallino brand + testo), poi il markdown, poi i prodotti
 * citati (`InlineProducts`), poi la riga di azioni.
 */
export function MessageTurn({
  role,
  content,
  status,
  errorMessage,
  products = [],
  streaming = false,
  onRegenerate,
  regenerating = false,
}: MessageTurnProps) {
  if (role === "USER") {
    return (
      <div data-role="USER" className="animate-chat-in flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-surface-sunken px-4 py-2.5 text-sm leading-relaxed text-ink">
          {content}
        </p>
      </div>
    );
  }

  if (status === "ERROR") {
    return (
      <div data-role="ASSISTANT" data-status="ERROR" className="animate-chat-in">
        <AssistantMark />
        <div
          role="alert"
          className="mt-1.5 flex flex-col items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
        >
          <p>{errorMessage ?? "Si è verificato un errore."}</p>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded border border-line-strong px-3 text-xs font-medium text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
            >
              <RotateCcw className={cn("size-3.5", regenerating && "animate-spin")} aria-hidden />
              Riprova
            </button>
          )}
        </div>
      </div>
    );
  }

  const showActions = !streaming && content.length > 0;

  return (
    <div data-role="ASSISTANT" className="group animate-chat-in">
      <AssistantMark />
      <div className="mt-1.5">
        <MarkdownMessage content={content} />
        {streaming && (
          <span
            aria-hidden
            className="chat-caret ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse bg-ink/50"
          />
        )}
      </div>
      <InlineProducts products={products} />
      {showActions && (
        <div
          className={cn(
            "mt-2 flex items-center gap-1 transition-opacity duration-150 ease-out-quart",
            // Desktop (>= sm): azioni nascoste finché non si passa il mouse/focus sul turno —
            // su mobile (< sm, hard rule del progetto) restano SEMPRE visibili perché l'hover
            // non esiste al tocco.
            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          )}
        >
          <CopyButton content={content} />
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className="inline-flex min-h-10 items-center gap-1.5 rounded px-2 text-xs font-medium text-ink-subtle transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
            >
              <RotateCcw className={cn("size-3.5", regenerating && "animate-spin")} aria-hidden />
              Rigenera
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AssistantMark() {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-ink-subtle">
      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
      Assistente
    </div>
  );
}

/** Copia il markdown grezzo della risposta (non il testo renderizzato) — pattern di
 * `CopyCodeButton`/`CodeBlock`: stato locale, feedback 2s, nessuna eccezione se la
 * clipboard non è disponibile. */
function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non disponibile: nessun feedback, il testo resta selezionabile
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Risposta copiata" : "Copia risposta"}
      className="inline-flex min-h-10 items-center gap-1.5 rounded px-2 text-xs font-medium text-ink-subtle transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copiato" : "Copia"}
    </button>
  );
}
