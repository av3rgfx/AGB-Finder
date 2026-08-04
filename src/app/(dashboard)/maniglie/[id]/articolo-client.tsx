"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { api } from "@/trpc/react";
import { CopyCodeButton } from "@/components/product/copy-code-button";
import { StockBadge } from "@/components/maniglie/stock-badge";
import { formatStockDate } from "@/components/maniglie/stock-date";
import { formatPrice } from "@/lib/format";

export function ArticoloClient({ id }: { id: string }) {
  const articolo = api.article.getById.useQuery({ id });

  if (articolo.isPending) return <Skeleton />;
  if (articolo.isError || !articolo.data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <IndietroLink />
        <div role="alert" className="rounded-md border border-[#EBC9C9] bg-[#FBEDED] p-4">
          <p className="text-sm font-medium text-ink">Articolo non trovato</p>
          <p className="mt-1 text-sm text-ink-muted">
            Controlla il collegamento, oppure torna alla disponibilità e cerca il codice.
          </p>
        </div>
      </div>
    );
  }

  const a = articolo.data;
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <IndietroLink />

      <div className="flex flex-col gap-5 rounded-md border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-start sm:gap-6 sm:p-6">
        <Foto url={a.imageUrlLarge} />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CopyCodeButton code={a.code} />
          </div>

          <h1 className="text-lg font-semibold text-ink sm:text-xl">{a.name}</h1>

          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-[27px] font-bold tabular-nums leading-tight text-ink">
              {formatPrice(a.total)}
            </span>
            <span className="text-xs text-ink-subtle">IVA esclusa</span>
          </p>

          {/* Qui la data sta SULLA RIGA: c'è un solo articolo, quindi non c'è
              ripetizione da evitare — e uno stato di magazzino senza la sua
              data è un'affermazione senza scadenza. */}
          <p className="flex flex-wrap items-center gap-2">
            <StockBadge inStock={a.inStock} />
            <span className="text-xs text-ink-subtle">
              {a.stockUpdatedAt
                ? `al ${formatStockDate(a.stockUpdatedAt)}`
                : "nessuna pronta consegna caricata"}
            </span>
          </p>
        </div>
      </div>

      <section aria-labelledby="specifiche" className="flex flex-col gap-2">
        <h2 id="specifiche" className="text-sm font-semibold text-ink">
          Specifiche
        </h2>
        {/* Nessun campo vuoto viene disegnato: una riga con un trattino è un
            dato mancante travestito da dato. */}
        <dl className="overflow-hidden rounded-md border border-line bg-surface text-sm">
          <Riga label="Marca" value={a.brand} />
          {a.ean ? <Riga label="EAN" value={<span className="font-mono">{a.ean}</span>} /> : null}
          {a.catalogPage != null ? (
            <Riga label="Catalogo" value={`Pagina ${a.catalogPage}`} />
          ) : null}
        </dl>
      </section>
    </article>
  );
}

function IndietroLink() {
  return (
    <Link
      href="/maniglie"
      className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-ink-subtle transition-colors duration-150 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <ArrowLeft className="size-4" aria-hidden /> Catalogo
    </Link>
  );
}

function Riga({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-2.5 last:border-b-0">
      <dt className="shrink-0 text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-right text-ink">{value}</dd>
    </div>
  );
}

/**
 * Foto d'articolo, servita da `/api/article-image` (Blob privato, dietro auth).
 * Assente o non caricata → segnaposto neutro, mai un errore: il 42% dei codici
 * una foto non ce l'ha, ed è la normalità.
 */
function Foto({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  const box = "h-40 w-40 shrink-0 rounded border border-line object-contain sm:h-48 sm:w-48";
  if (!url || failed) {
    return (
      <span
        aria-hidden
        className={`${box} mx-auto grid place-items-center bg-surface-sunken sm:mx-0`}
      >
        <Package className="size-8 text-ink-subtle" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
    <img
      src={url}
      alt=""
      onError={() => setFailed(true)}
      className={`${box} mx-auto bg-white sm:mx-0`}
    />
  );
}

/** Skeleton, non spinner (DESIGN.md). */
function Skeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5" aria-hidden>
      <span className="h-4 w-32 animate-pulse rounded bg-surface-sunken" />
      <div className="flex flex-col gap-5 rounded-md border border-line bg-surface p-4 sm:flex-row sm:p-6">
        <span className="mx-auto h-40 w-40 animate-pulse rounded bg-surface-sunken sm:mx-0 sm:h-48 sm:w-48" />
        <div className="flex flex-1 flex-col gap-3">
          <span className="h-7 w-40 animate-pulse rounded bg-surface-sunken" />
          <span className="h-5 w-full max-w-xs animate-pulse rounded bg-surface-sunken" />
          <span className="h-8 w-28 animate-pulse rounded bg-surface-sunken" />
          <span className="h-6 w-44 animate-pulse rounded bg-surface-sunken" />
        </div>
      </div>
      <span className="h-24 w-full animate-pulse rounded-md bg-surface-sunken" />
    </div>
  );
}
