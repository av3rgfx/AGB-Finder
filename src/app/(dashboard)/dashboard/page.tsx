import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { headers } from "next/headers";
import {
  ClipboardList,
  PackageCheck,
  Timer,
  Search,
  Bot,
  Paperclip,
  Send,
  Inbox,
} from "lucide-react";
import { auth } from "@/server/auth/config";

export const metadata: Metadata = { title: "Dashboard — UFPtrade" };

interface Stat {
  label: string;
  value: string;
  icon: LucideIcon;
}

const STATS: Stat[] = [
  { label: "Richieste oggi", value: "0", icon: ClipboardList },
  { label: "Kit generati", value: "0", icon: PackageCheck },
  { label: "Tempo risparmiato", value: "—", icon: Timer },
  { label: "Prodotti cercati", value: "0", icon: Search },
];

function StatCard({ label, value, icon: Icon }: Stat) {
  return (
    <div className="rounded-md border border-line bg-surface p-5 shadow-card">
      <span className="grid size-8 place-items-center rounded-md bg-brand/[0.08] text-brand">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-0.5 text-sm text-ink-subtle">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const firstName = session?.user.firstName ?? "";

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Ciao{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-ink-subtle">Ecco una panoramica della tua attività.</p>
      </div>

      <section aria-label="Statistiche" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </section>

      <section className="rounded-md border border-line bg-surface shadow-card">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Ultime richieste kit</h2>
        </header>
        <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-surface-sunken text-ink-subtle">
            <Inbox className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-ink">Nessuna richiesta recente</p>
          <p className="max-w-xs text-sm text-ink-subtle">
            I kit che genererai appariranno qui, con cliente, data e stato.
          </p>
        </div>
      </section>

      <section className="rounded-md border border-brand/15 bg-brand-light p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Bot className="size-6 text-brand" aria-hidden />
          <h2 className="text-base font-semibold text-ink">Come posso aiutarti?</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Cerca codice", "Genera kit", "Analizza email"].map((action) => (
            <span
              key={action}
              className="rounded border border-brand/40 bg-surface px-3 py-1.5 text-sm font-medium text-brand"
            >
              {action}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-line-strong bg-surface px-3">
          <Paperclip className="size-[18px] text-ink-subtle" aria-hidden />
          <input
            aria-label="Messaggio all'assistente"
            disabled
            placeholder="Descrivi il prodotto o incolla un'email…"
            className="h-11 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none disabled:cursor-not-allowed"
          />
          <span className="grid size-8 place-items-center rounded bg-brand text-white">
            <Send className="size-4" aria-hidden />
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-subtle">
          L&apos;assistente AI sarà disponibile a breve.
        </p>
      </section>
    </div>
  );
}
