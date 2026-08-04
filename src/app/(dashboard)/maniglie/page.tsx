import { Suspense } from "react";
import type { Metadata } from "next";
import { ManiglieClient } from "./maniglie-client";

export const metadata: Metadata = { title: "Disponibilità — UFPtrade" };

/**
 * Reparto maniglie. Il titolo è «Disponibilità» e non «Archivio»: nel reparto
 * serramenti «Archivio» esiste già ed è un'altra cosa (il catalogo AGB). Due
 * voci con lo stesso nome costringerebbero a ricordare quale delle due si sta
 * guardando.
 */
export default function ManigliePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <h1 className="text-xl font-semibold text-ink">Disponibilità</h1>
      <Suspense
        fallback={<div className="h-[46px] animate-pulse rounded bg-surface-sunken" aria-hidden />}
      >
        <ManiglieClient />
      </Suspense>
    </div>
  );
}
