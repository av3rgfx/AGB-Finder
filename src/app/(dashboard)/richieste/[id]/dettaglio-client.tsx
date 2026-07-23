"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { api } from "@/trpc/react";
import { formatPrice } from "@/lib/format";
import {
  hingeSideLabel,
  materialLabel,
  openingDirLabel,
  windowTypeLabel,
} from "@/lib/kit-labels";
import { StatusBadge } from "@/components/kit/status-badge";
import { DistintaTable } from "@/components/kit/distinta-table";
import { Button } from "@/components/ui/button";

/** Estrae i warning dal JSON `generatedKit` (Prisma.JsonValue non tipizzato). */
function getWarnings(generatedKit: unknown): string[] {
  if (generatedKit && typeof generatedKit === "object" && "warnings" in generatedKit) {
    const warnings = (generatedKit as { warnings?: unknown }).warnings;
    if (Array.isArray(warnings)) return warnings.filter((w): w is string => typeof w === "string");
  }
  return [];
}

export function DettaglioClient({ id }: { id: string }) {
  const utils = api.useUtils();
  const request = api.kit.get.useQuery({ id });

  const generate = api.kit.generate.useMutation({
    onSuccess: () => {
      void utils.kit.get.invalidate({ id });
      void utils.kit.list.invalidate();
    },
  });

  if (request.isPending) {
    return (
      <div
        className="mx-auto h-64 max-w-4xl animate-pulse rounded-md border border-line bg-surface-sunken"
        aria-hidden
      />
    );
  }

  if (request.isError) {
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-4xl flex-col items-start gap-3 rounded-md border border-danger/30 bg-danger/5 p-6"
      >
        <p className="text-sm text-danger">Richiesta non trovata o errore di caricamento.</p>
        <Link href="/richieste" className="text-sm font-medium text-brand hover:underline">
          ← Torna alle richieste
        </Link>
      </div>
    );
  }

  const r = request.data;
  const warnings = getWarnings(r.generatedKit);
  const hasDistinta = r.components.length > 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href="/richieste"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-subtle transition-colors hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden /> Richieste
      </Link>

      <header className="flex flex-col gap-3 rounded-md border border-line bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-lg font-semibold text-ink">{r.requestNumber}</h1>
          <StatusBadge status={r.status} />
        </div>
        <p className="text-sm text-ink-subtle">
          {windowTypeLabel(r.windowType)} · {r.series}
          {r.totalComponents > 0 && (
            <>
              {" "}
              · {r.totalComponents} {r.totalComponents === 1 ? "componente" : "componenti"} ·{" "}
              {r.totalPrice === null ? "—" : formatPrice(r.totalPrice)}
            </>
          )}
        </p>
      </header>

      <section aria-labelledby="specifiche-heading" className="flex flex-col gap-3">
        <h2 id="specifiche-heading" className="text-sm font-semibold text-ink">
          Specifiche
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-line bg-surface p-6 text-sm sm:grid-cols-3">
          <Spec label="Dimensioni" value={`${r.widthMm} × ${r.heightMm} mm`} />
          <Spec label="Materiale" value={materialLabel(r.material)} />
          <Spec label="Serie" value={r.series} />
          <Spec label="Mano" value={hingeSideLabel(r.openingSide)} />
          <Spec label="Apertura" value={openingDirLabel(r.openingDir)} />
          <Spec label="Finitura" value={r.finish} />
          <Spec label="Aria" value={`${r.airGapMm} mm`} />
          <Spec label="Asse" value={`${r.axisOffsetMm} mm`} />
          <Spec label="Battuta" value={`${r.rebateMm} mm`} />
          <Spec label="Sede" value={`${r.seatMm} mm`} />
        </dl>
      </section>

      <section aria-labelledby="distinta-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="distinta-heading" className="text-sm font-semibold text-ink">
            Distinta componenti
          </h2>
          <Button
            variant="secondary"
            size="sm"
            loading={generate.isPending}
            onClick={() => generate.mutate({ kitRequestId: id })}
          >
            <RefreshCw className="size-4" aria-hidden />
            Rigenera
          </Button>
        </div>

        {generate.isError && (
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
          >
            {generate.error.message}
          </div>
        )}

        {/* Se la distinta non ha componenti risolti i warning non passano per
            DistintaTable (che non viene renderizzata): li mostriamo comunque,
            altrimenti un kit totalmente non a listino sparirebbe senza traccia. */}
        {!hasDistinta && warnings.length > 0 && (
          <div
            role="alert"
            className="rounded border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink"
          >
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        {hasDistinta ? (
          <DistintaTable
            components={r.components.map((c) => ({
              ...c,
              listinoPage: c.product?.listinoPage ?? null,
            }))}
            totalPrice={r.totalPrice ?? 0}
            warnings={warnings}
          />
        ) : (
          <div className="rounded-md border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-subtle">
            Distinta non ancora generata. Usa «Rigenera» per calcolare i componenti dal catalogo.
          </div>
        )}
      </section>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
