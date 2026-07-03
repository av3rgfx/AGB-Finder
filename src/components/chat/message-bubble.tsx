import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Codici AGB nel testo (es. B00590.15.03, A50122): resi in monospace. */
const AGB_CODE = /\b([A-Z]\d{4,5}(?:\.[0-9A-Z]{2,3})*)\b/g;

function renderContent(content: string) {
  const parts = content.split(AGB_CODE);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="rounded bg-ink/[0.06] px-1 font-mono text-[0.92em]">
        {part}
      </code>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export interface MessageBubbleProps {
  role: "USER" | "ASSISTANT";
  content: string;
  status?: string;
  errorMessage?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}

export function MessageBubble({
  role,
  content,
  status,
  errorMessage,
  onRetry,
  retrying,
}: MessageBubbleProps) {
  if (status === "ERROR") {
    return (
      <div data-role={role} className="animate-chat-in flex justify-start">
        <div
          role="alert"
          className="max-w-[85%] rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink"
        >
          <p>{errorMessage ?? "Si è verificato un errore."}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="mt-2 inline-flex items-center gap-1.5 rounded border border-line-strong px-2.5 py-1 text-xs font-medium text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
            >
              <RotateCcw className={cn("size-3", retrying && "animate-spin")} aria-hidden />
              Riprova
            </button>
          )}
        </div>
      </div>
    );
  }

  const isUser = role === "USER";
  return (
    <div
      data-role={role}
      className={cn("animate-chat-in flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-md px-4 py-3 text-sm leading-relaxed text-ink",
          // DESIGN.md — Chat Message: utente a destra su N100; AI a sinistra su
          // Brand Orange Light con bordo sinistro brand 3px.
          isUser ? "bg-surface-sunken" : "border-l-[3px] border-brand bg-brand-light",
        )}
      >
        {renderContent(content)}
      </div>
    </div>
  );
}
