"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { api } from "@/trpc/react";
import { formatDate, formatPrice } from "@/lib/format";
import { materialLabel, windowTypeLabel } from "@/lib/kit-labels";
import { StatusBadge } from "@/components/kit/status-badge";

export function RichiesteClient() {
  const list = api.kit.list.useQuery({});
  const items = list.data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Richieste Kit</h1>
        <Link
          href="/richieste/nuova"
          className="inline-flex items-center gap-1.5 rounded bg-brand px-3.5 py-2 text-sm font-medium text-white transition-colors duration-150 ease-out-quart hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Plus className="size-4" aria-hidden />
          Nuova richiesta
        </Link>
      </header>

      {list.isPending ? (
        <SkeletonTable />
      ) : list.isError ? (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          Errore durante il caricamento delle richieste. Riprova tra qualche istante.
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-sunken text-left text-xs font-semibold uppercase text-ink-subtle">
                <th className="px-4 py-2.5">Numero</th>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Tipologia / Serie / Materiale</th>
                <th className="px-4 py-2.5">Dimensioni</th>
                <th className="px-4 py-2.5">Stato</th>
                <th className="px-4 py-2.5 text-right">Totale</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <RequestRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface RequestListItem {
  id: string;
  requestNumber: string;
  windowType: string;
  series: string;
  material: string;
  widthMm: number;
  heightMm: number;
  status: string;
  totalComponents: number;
  totalPrice: number | null;
  createdAt: Date | string;
}

function RequestRow({ item }: { item: RequestListItem }) {
  const router = useRouter();
  const href = `/richieste/${item.id}`;

  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer border-t border-line transition-colors hover:bg-surface-sunken/50"
    >
      <td className="px-4 py-2.5">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-sm text-ink hover:text-brand focus-visible:outline-none focus-visible:underline"
        >
          {item.requestNumber}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-ink-subtle">{formatDate(item.createdAt)}</td>
      <td className="px-4 py-2.5 text-ink">
        {windowTypeLabel(item.windowType)} · {item.series} · {materialLabel(item.material)}
      </td>
      <td className="px-4 py-2.5 tabular-nums text-ink-subtle">
        {item.widthMm} × {item.heightMm} mm
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink">
        {item.totalPrice === null ? "—" : formatPrice(item.totalPrice)}
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-line-strong bg-surface p-10 text-center">
      <ClipboardList className="size-8 text-ink-subtle" aria-hidden />
      <p className="text-sm font-medium text-ink">Nessuna richiesta kit</p>
      <p className="max-w-md text-sm text-ink-subtle">
        Non hai ancora creato richieste di kit. Avvia una nuova richiesta per generare la distinta
        componenti in automatico.
      </p>
      <Link
        href="/richieste/nuova"
        className="mt-2 inline-flex items-center gap-1.5 rounded bg-brand px-3.5 py-2 text-sm font-medium text-white transition-colors duration-150 ease-out-quart hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <Plus className="size-4" aria-hidden />
        Nuova richiesta
      </Link>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-lg border border-line" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-line bg-surface px-4 py-3 last:border-b-0"
        >
          <span className="h-3 w-28 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 w-20 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 flex-1 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 w-16 animate-pulse rounded bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}
