"use client";

import { cn } from "@/lib/utils";

const SUGGESTIONS = ["cerniera anta ribalta", "maniglia", "B00590"];
const chipClass =
  "rounded-full border border-line-strong bg-surface px-3 py-1 text-xs text-ink transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

function isCode(q: string) {
  return /^[A-Z]\d/.test(q);
}

export function RecentSearches({
  recent,
  onPick,
}: {
  recent: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
          <h3 id="recent-heading" className="text-xs font-medium text-ink-muted">
            Ricerche recenti
          </h3>
          <ul className="flex flex-wrap gap-2">
            {recent.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => onPick(q)}
                  className={cn(chipClass, isCode(q) && "font-mono")}
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="suggestions-heading" className="flex flex-col gap-2">
        <h3 id="suggestions-heading" className="text-xs font-medium text-ink-muted">
          Prova a cercare
        </h3>
        <ul className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => onPick(q)}
                className={cn(chipClass, isCode(q) && "font-mono")}
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
