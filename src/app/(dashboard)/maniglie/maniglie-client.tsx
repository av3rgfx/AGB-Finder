"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";
import type { ArticleSummary } from "@/server/api/routers/article";
import { api } from "@/trpc/react";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/maniglie/stock-badge";
import { StockDate } from "@/components/maniglie/stock-date";
import { formatPrice } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";

/** Il listino COLOMBO ha 3.456 codici: si mostra una pagina, non l'archivio. */
const PAGE_SIZE = 20;

export function ManiglieClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // L'URL è la fonte della ricerca: così una ricerca si condivide e il tasto
  // indietro funziona (stesso patto dell'Archivio serramenti).
  const committed = (searchParams.get("q") ?? "").trim();
  const [queryInput, setQueryInput] = useState(committed);
  const debounced = useDebouncedValue(queryInput.trim(), 300);

  // `written` distingue le scritture NOSTRE da quelle di chi naviga: senza,
  // il campo verrebbe risincronizzato anche dalla scrittura che ha appena
  // fatto lui, sovrascrivendo ciò che si sta digitando.
  const written = useRef(committed);

  useEffect(() => {
    if (debounced === written.current) return;
    written.current = debounced;
    router.replace(debounced ? `${pathname}?q=${encodeURIComponent(debounced)}` : pathname, {
      scroll: false,
    });
    // SOLO su `debounced`: l'URL si scrive quando cambia ciò che si è digitato,
    // mai per un altro motivo. Con `router`/`pathname` fra le dipendenze un
    // qualunque re-render riscriverebbe l'URL con la query PRECEDENTE, e il
    // tasto indietro rimbalzerebbe subito in avanti (verificato da un test).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Indietro/avanti (o un link condiviso aperto a pagina già montata): l'URL
  // cambia senza passare da qui → il campo si riallinea a ciò che si vede.
  useEffect(() => {
    if (committed === written.current) return;
    written.current = committed;
    setQueryInput(committed);
  }, [committed]);

  const search = api.article.search.useQuery(
    { query: committed, limit: PAGE_SIZE },
    {
      enabled: committed.length > 0,
      placeholderData: keepPreviousData,
      staleTime: 5 * 60_000,
    },
  );

  const hits = search.data?.hits ?? [];
  const total = search.data?.total ?? 0;
  const cercando = committed.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        aria-label="Cerca un articolo"
        placeholder="Codice, nome o EAN"
        leadingIcon={<Search className="size-5" aria-hidden />}
        value={queryInput}
        onChange={(e) => setQueryInput(e.target.value)}
        // 46px: bersaglio comodo col dito. `text-base` evita lo zoom automatico
        // di iOS sui campi sotto i 16px.
        className="h-[46px] text-base sm:text-sm"
      />

      {/* LA DATA STA QUI, UNA VOLTA SOLA: è una proprietà dell'import, non
          della riga. Presente anche a zero risultati. */}
      {search.data ? (
        <StockDate importedAt={search.data.stockUpdates[0]?.importedAt ?? null} />
      ) : cercando && search.isPending ? (
        <div className="h-10 animate-pulse rounded bg-surface-sunken" aria-hidden />
      ) : null}

      <section aria-label="Risultati" aria-busy={search.isFetching} className="flex flex-col gap-3">
        {!cercando ? (
          <EmptyState
            title="Cerca un articolo"
            detail={
              <>
                Digita un codice (<code className="font-mono text-ink-muted">0CD41R-CM</code>), un
                nome o un EAN.
              </>
            }
          />
        ) : search.isPending ? (
          <SkeletonList />
        ) : search.isError ? (
          <div role="alert" className="rounded-md border border-[#EBC9C9] bg-[#FBEDED] p-4">
            <p className="text-sm font-medium text-ink">Ricerca non riuscita</p>
            <p className="mt-1 text-sm text-ink-muted">Riprova fra qualche istante.</p>
          </div>
        ) : hits.length === 0 ? (
          <EmptyState
            title={`Nessun articolo per «${committed}»`}
            detail={
              <>
                Controlla il codice, oppure cerca per nome. I separatori non contano:{" "}
                <code className="font-mono text-ink-muted">0CD41RCM</code> e{" "}
                <code className="font-mono text-ink-muted">0CD41R-CM</code> trovano lo stesso
                articolo.
              </>
            }
          />
        ) : (
          <>
            <p className="text-sm text-ink-subtle" aria-live="polite">
              {total === 1 ? "1 articolo" : `${total} articoli`}
              {hits.length < total ? ` · mostrati i primi ${hits.length}` : null}
            </p>
            <ul className="list-none overflow-hidden rounded-md border border-line">
              {hits.map((articolo) => (
                <ArticoloRow key={articolo.id} articolo={articolo} />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Riga risultato. A 375px: miniatura · (codice, nome, stato impilati) · prezzo.
 * Da `sm` in su il blocco centrale diventa `display: contents`, così codice,
 * nome e stato entrano nelle colonne della griglia e le righe si allineano in
 * verticale senza un secondo markup.
 */
function ArticoloRow({ articolo }: { articolo: ArticleSummary }) {
  return (
    <li className="relative grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-line bg-surface px-3 py-2.5 transition-colors duration-150 last:border-b-0 hover:bg-surface-sunken sm:grid-cols-[44px_150px_1fr_172px_92px] sm:gap-4 sm:px-4 sm:py-3">
      <Foto url={articolo.imageUrl} />
      <div className="flex min-w-0 flex-col gap-1 sm:contents">
        <span className="min-w-0 truncate font-mono text-xs text-ink-subtle">{articolo.code}</span>
        <span className="min-w-0 truncate text-sm font-medium text-ink">{articolo.name}</span>
        <StockBadge inStock={articolo.inStock} />
      </div>
      <span className="text-sm font-semibold tabular-nums text-ink sm:justify-self-end">
        {formatPrice(articolo.total)}
      </span>
      {/* Stretched link: tutta la riga porta alla scheda. */}
      <Link
        href={`/maniglie/${articolo.id}`}
        aria-label={`${articolo.code} — ${articolo.name}`}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
      />
    </li>
  );
}

/**
 * Miniatura. Il 15% dei codici è minuteria che nessun catalogo fotografa: la
 * foto mancante è la normalità, non un errore, e si disegna come un segnaposto
 * neutro — mai come un messaggio.
 */
function Foto({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded border border-line bg-surface-sunken"
      >
        <Package className="size-4 text-ink-subtle" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto su Vercel Blob, URL esterno non ottimizzabile
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-11 shrink-0 rounded border border-line bg-white object-contain"
    />
  );
}

function EmptyState({ title, detail }: { title: string; detail: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface p-8 text-center sm:p-10">
      <Search className="size-8 text-ink-subtle" aria-hidden />
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-md text-sm text-ink-subtle">{detail}</p>
    </div>
  );
}

/** Skeleton, non spinner (DESIGN.md). */
function SkeletonList() {
  return (
    <div className="overflow-hidden rounded-md border border-line" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-line bg-surface px-3 py-2.5 last:border-b-0 sm:grid-cols-[44px_150px_1fr_172px_92px] sm:gap-4 sm:px-4 sm:py-3"
        >
          <span className="size-11 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 w-24 animate-pulse rounded bg-surface-sunken" />
          <span className="hidden h-3 w-full animate-pulse rounded bg-surface-sunken sm:block" />
          <span className="hidden h-5 w-28 animate-pulse rounded bg-surface-sunken sm:block" />
          <span className="h-3 w-14 animate-pulse justify-self-end rounded bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}
