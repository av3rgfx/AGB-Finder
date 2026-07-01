import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, leadingIcon, trailingSlot, ...props },
  ref,
) {
  return (
    <div className="relative">
      {leadingIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-11 w-full rounded border bg-surface px-3.5 text-sm text-ink transition-colors duration-150 placeholder:text-ink-subtle",
          "focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25",
          "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-70",
          leadingIcon && "pl-10",
          trailingSlot && "pr-11",
          invalid
            ? "border-danger focus-visible:border-danger focus-visible:ring-danger/25"
            : "border-line-strong",
          className,
        )}
        {...props}
      />
      {trailingSlot && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailingSlot}</span>
      )}
    </div>
  );
});
