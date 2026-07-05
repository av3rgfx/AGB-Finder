import { cn } from "@/lib/utils";

const LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Bozza", className: "bg-surface-sunken text-ink-subtle" },
  PENDING_GENERATION: { label: "In coda", className: "bg-brand-light text-brand" },
  GENERATING: { label: "In generazione", className: "bg-brand-light text-brand" },
  COMPLETED: { label: "Completato", className: "bg-success/10 text-success" },
  REVIEWED: { label: "Revisionato", className: "bg-success/10 text-success" },
  SENT_TO_CUSTOMER: { label: "Inviato", className: "bg-brand-light text-brand" },
  APPROVED: { label: "Approvato", className: "bg-success/10 text-success" },
  REJECTED: { label: "Rifiutato", className: "bg-danger/10 text-danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = LABELS[status] ?? { label: status, className: "bg-surface-sunken text-ink-subtle" };
  return (
    <span className={cn("inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium", entry.className)}>
      {entry.label}
    </span>
  );
}
