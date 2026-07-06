"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  PackageCheck,
  MessageSquare,
  Search,
  Bot,
  Plus,
  Package,
  Inbox,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatDate, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/kit/status-badge";

type Scope = "mine" | "team";
type StatKey = "richieste" | "kitGenerati" | "conversazioni" | "prodottiCercati";
interface Stat {
  total: number;
  today: number;
}

const KPI_META: { key: StatKey; label: string; icon: LucideIcon }[] = [
  { key: "richieste", label: "Richieste", icon: ClipboardList },
  { key: "kitGenerati", label: "Kit generati", icon: PackageCheck },
  { key: "conversazioni", label: "Conversazioni AI", icon: MessageSquare },
  { key: "prodottiCercati", label: "Prodotti cercati", icon: Search },
];

export function DashboardClient({ firstName, isAdmin }: { firstName: string; isAdmin: boolean }) {
  const [scope, setScope] = useState<Scope>("mine");
  const overview = api.dashboard.overview.useQuery({ scope: isAdmin ? scope : "mine" });

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Ciao{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-ink-subtle">Ecco una panoramica della tua attività.</p>
        </div>
        {isAdmin ? <ScopeToggle scope={scope} onChange={setScope} /> : null}
      </div>

      {overview.isError ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Errore nel caricamento della dashboard.{" "}
          <button
            type="button"
            onClick={() => void overview.refetch()}
            className="font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
          >
            Riprova
          </button>
        </div>
      ) : null}

      <section aria-label="Statistiche" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPI_META.map((k) => (
          <StatCard
            key={k.key}
            label={k.label}
            icon={k.icon}
            stat={overview.data?.stats[k.key]}
            loading={overview.isPending}
          />
        ))}
      </section>

      <RecentKits items={overview.data?.recentKits ?? []} loading={overview.isPending} />

      <Shortcuts />
    </div>
  );
}

function ScopeToggle({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  return (
    <div
      role="group"
      aria-label="Ambito dati"
      className="inline-flex rounded-md border border-line bg-surface p-0.5 text-sm"
    >
      {(["mine", "team"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={scope === s}
          onClick={() => onChange(s)}
          className={
            scope === s
              ? "rounded px-3 py-1.5 font-medium bg-brand text-white"
              : "rounded px-3 py-1.5 font-medium text-ink-subtle hover:text-ink"
          }
        >
          {s === "mine" ? "I miei" : "Team"}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  label,
  icon: Icon,
  stat,
  loading,
}: {
  label: string;
  icon: LucideIcon;
  stat?: Stat;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-line bg-surface p-5 shadow-card">
      <span className="grid size-8 place-items-center rounded-md bg-brand/[0.08] text-brand">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      {loading ? (
        <span className="mt-3 block h-9 w-16 animate-pulse rounded bg-surface-sunken" aria-hidden />
      ) : (
        <p className="mt-3 text-3xl font-bold tracking-tight text-ink tabular-nums">
          {stat?.total ?? "—"}
        </p>
      )}
      <p className="mt-0.5 text-sm text-ink-subtle">{label}</p>
      {!loading && stat && stat.today > 0 ? (
        <p className="mt-1 text-xs font-medium text-brand tabular-nums">+{stat.today} oggi</p>
      ) : null}
    </div>
  );
}

interface RecentKit {
  id: string;
  requestNumber: string;
  status: string;
  createdAt: Date | string;
  totalPrice: number | null;
  customerName: string | null;
}

function RecentKits({ items, loading }: { items: RecentKit[]; loading: boolean }) {
  return (
    <section className="rounded-md border border-line bg-surface shadow-card">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-ink">Ultime richieste kit</h2>
        <Link href="/richieste" className="text-sm font-medium text-brand hover:underline">
          Vedi tutte
        </Link>
      </header>
      {loading ? (
        <div className="flex flex-col" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
              <span className="h-3 w-28 animate-pulse rounded bg-surface-sunken" />
              <span className="h-3 flex-1 animate-pulse rounded bg-surface-sunken" />
              <span className="h-3 w-16 animate-pulse rounded bg-surface-sunken" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-surface-sunken text-ink-subtle">
            <Inbox className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-ink">Nessuna richiesta recente</p>
          <p className="max-w-xs text-sm text-ink-subtle">
            I kit che genererai appariranno qui, con cliente, data e stato.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((k) => (
            <li key={k.id}>
              <Link
                href={`/richieste/${k.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-sunken/50 focus-visible:outline-none focus-visible:bg-surface-sunken/50"
              >
                <div className="min-w-0">
                  <span className="font-mono text-sm text-ink">{k.requestNumber}</span>
                  <span className="ml-2 text-sm text-ink-subtle">
                    {k.customerName ?? "Cliente non assegnato"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="hidden text-sm text-ink-subtle sm:inline">{formatDate(k.createdAt)}</span>
                  <StatusBadge status={k.status} />
                  <span className="w-20 text-right text-sm font-medium tabular-nums text-ink">
                    {k.totalPrice === null ? "—" : formatPrice(k.totalPrice)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Shortcuts() {
  const links: { href: string; label: string; desc: string; icon: LucideIcon }[] = [
    { href: "/assistente", label: "Chiedi all'assistente", desc: "Cerca prodotti e genera risposte con l'AI", icon: Bot },
    { href: "/richieste/nuova", label: "Nuova richiesta kit", desc: "Genera la distinta componenti", icon: Plus },
    { href: "/archivio", label: "Cerca a catalogo", desc: "Sfoglia il catalogo prodotti AGB", icon: Package },
  ];
  return (
    <section aria-label="Scorciatoie" className="grid gap-4 sm:grid-cols-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="group flex flex-col gap-2 rounded-md border border-line bg-surface p-5 shadow-card transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span className="grid size-9 place-items-center rounded-md bg-brand/[0.08] text-brand">
            <l.icon className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-ink group-hover:text-brand">{l.label}</span>
          <span className="text-sm text-ink-subtle">{l.desc}</span>
        </Link>
      ))}
    </section>
  );
}
