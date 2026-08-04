"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";
import type { ArticleSummary } from "@/server/api/routers/article";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/maniglie/stock-badge";
import { StockDate } from "@/components/maniglie/stock-date";
import {
  FiltriSfoglia,
  SenzaFamiglia,
  SfogliaFamiglie,
  SfogliaGruppi,
} from "@/components/maniglie/sfoglia";
import { formatPrice } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { loadScroll, saveScroll } from "@/lib/archivio-scroll";

/** Il listino COLOMBO ha 3.456 codici: si mostra una pagina, non l'archivio. */
const PAGE_SIZE = 20;

export function ManiglieClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // L'URL è la fonte della ricerca E dello sfoglio: così una schermata si
  // condivide e il tasto indietro funziona (stesso patto dell'Archivio
  // serramenti). Niente stato nascosto: dove si è, è scritto nella barra.
  const committed = (searchParams.get("q") ?? "").trim();
  const tipo = (searchParams.get("tipo") ?? "").trim();
  const famiglia = (searchParams.get("fam") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("p") ?? "1") || 1);

  const [queryInput, setQueryInput] = useState(committed);
  const debounced = useDebouncedValue(queryInput.trim(), 300);

  // `written` distingue le scritture NOSTRE da quelle di chi naviga: senza,
  // il campo verrebbe risincronizzato anche dalla scrittura che ha appena
  // fatto lui, sovrascrivendo ciò che si sta digitando.
  const written = useRef(committed);

  useEffect(() => {
    if (debounced === written.current) return;
    written.current = debounced;
    // Digitare abbandona lo sfoglio: `tipo`, `fam` e `p` NON si conservano, o
    // la ricerca uscirebbe filtrata da un gruppo che non si vede più.
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

  const cercando = committed.length > 0;
  const sfogliando = !cercando && tipo.length > 0;

  // Livello 1: i gruppi. Solo quando non si sta né cercando né sfogliando.
  const gruppi = api.article.browseGroups.useQuery(
    {},
    { enabled: !cercando && !tipo, staleTime: 5 * 60_000 },
  );

  // Livello 2: le famiglie del gruppo. Non serve se si è già scesi a una.
  const famiglie = api.article.browseFamilies.useQuery(
    { tipo },
    { enabled: sfogliando && !famiglia, staleTime: 5 * 60_000 },
  );

  // Un gruppo senza famiglie non ha livello 2: si passa direttamente ai codici.
  // 21 gruppi su 114 sono così (KIT, ROS.…), e mostrargli un livello vuoto
  // sarebbe un passaggio che non divide nulla.
  const senzaLivello2 = famiglie.data?.families.length === 0;

  const search = api.article.search.useQuery(
    {
      ...(cercando ? { query: committed } : { tipo, ...(famiglia ? { famiglia } : {}) }),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
    {
      enabled: cercando || (sfogliando && (Boolean(famiglia) || senzaLivello2)),
      placeholderData: keepPreviousData,
      staleTime: 5 * 60_000,
    },
  );

  // La data dell'ultimo import, indipendente da ricerca e sfoglio: la pagina la
  // mostra anche appena aperta, quando non c'è ancora nulla da datare ma c'è
  // già una domanda a cui rispondere.
  const stockInfo = api.article.stockInfo.useQuery({}, { staleTime: 5 * 60_000 });

  const hits = search.data?.hits ?? [];
  const total = search.data?.total ?? 0;
  const mostraCodici = cercando || (sfogliando && (Boolean(famiglia) || senzaLivello2));

  const setPage = useCallback(
    (p: number) => {
      const next = new URLSearchParams(searchParams.toString());
      if (p <= 1) next.delete("p");
      else next.set("p", String(p));
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useScrollRestore(`${committed}|${tipo}|${famiglia}|${page}`, Boolean(search.data ?? gruppi.data));

  // Una fonte sola per «di quando è questo dato»: i risultati quando ci sono
  // (portano la data dell'import che li ha valutati), `stockInfo` altrimenti.
  const dataImport = search.data
    ? (search.data.stockUpdates[0]?.importedAt ?? null)
    : (stockInfo.data?.importedAt ?? null);
  const dataPronta = Boolean(search.data ?? stockInfo.data);

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
          della riga — ripeterla su venti righe identiche sarebbe rumore.
          È presente SEMPRE: prima di cercare, sfogliando, coi risultati e a
          zero risultati. «Di quando è questo dato?» non dipende dall'aver
          trovato qualcosa, e un agente che promette la consegna sulla base di
          un file di due settimane fa non ha un bug, ha un cliente arrabbiato.
          È STICKY perché adesso le liste sono lunghe: sfogliando MANIGLIONE il
          banner in cima uscirebbe dallo schermo dopo una passata di pollice, e
          resterebbero pallini verdi senza la data che li autorizza. */}
      {dataPronta ? (
        <StockDate importedAt={dataImport} className="sticky top-0 z-10" />
      ) : (
        <div className="h-10 animate-pulse rounded bg-surface-sunken" aria-hidden />
      )}

      {sfogliando ? <FiltriSfoglia tipo={tipo} famiglia={famiglia} /> : null}

      <section
        aria-label={sfogliando ? "Sfoglia" : "Risultati"}
        aria-busy={search.isFetching || gruppi.isFetching || famiglie.isFetching}
        className="flex flex-col gap-3"
      >
        {!cercando && !tipo ? (
          gruppi.isPending ? (
            <SkeletonList />
          ) : gruppi.isError ? (
            <Errore titolo="Gruppi non caricati" />
          ) : (
            <SfogliaGruppi groups={gruppi.data?.groups ?? []} />
          )
        ) : sfogliando && !famiglia && famiglie.isPending ? (
          <SkeletonList />
        ) : sfogliando && famiglie.isError ? (
          <Errore titolo="Famiglie non caricate" />
        ) : (
          <>
            {sfogliando && !famiglia && famiglie.data && famiglie.data.families.length > 0 ? (
              <>
                <SfogliaFamiglie tipo={tipo} families={famiglie.data.families} />
                {famiglie.data.loose.length > 0 ? (
                  <>
                    <SenzaFamiglia count={famiglie.data.loose.length} />
                    <ul className="list-none overflow-hidden rounded-md border border-line">
                      {famiglie.data.loose.map((articolo) => (
                        <ArticoloRow key={articolo.id} articolo={articolo} />
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : null}

            {mostraCodici ? (
              search.isPending ? (
                <SkeletonList />
              ) : search.isError ? (
                <Errore titolo="Ricerca non riuscita" />
              ) : hits.length === 0 ? (
                <EmptyState
                  title={
                    cercando ? `Nessun articolo per «${committed}»` : "Nessun codice in questo gruppo"
                  }
                  detail={
                    cercando ? (
                      <>
                        Controlla il codice, oppure cerca per nome. I separatori non contano:{" "}
                        <code className="font-mono text-ink-muted">0CD41RCM</code> e{" "}
                        <code className="font-mono text-ink-muted">0CD41R-CM</code> trovano lo stesso
                        articolo.
                      </>
                    ) : (
                      <>Torna indietro e scegli un altro gruppo.</>
                    )
                  }
                />
              ) : (
                <>
                  <p className="text-sm text-ink-subtle" aria-live="polite">
                    {total === 1 ? "1 articolo" : `${total} articoli`}
                  </p>
                  <ul className="list-none overflow-hidden rounded-md border border-line">
                    {hits.map((articolo) => (
                      <ArticoloRow key={articolo.id} articolo={articolo} />
                    ))}
                  </ul>
                  <Pagination page={page} total={total} onChange={setPage} />
                </>
              )
            ) : null}
          </>
        )}
      </section>

      {!cercando && !tipo && gruppi.data ? (
        <p className="text-xs text-ink-subtle">
          Oppure cerca direttamente un codice (
          <code className="font-mono">0CD41R-CM</code>), un nome o un EAN.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Paginazione in URL, come nell'archivio serramenti: nessun accumulo in memoria,
 * quindi il tasto indietro torna alla pagina giusta e un link condiviso apre
 * ciò che vedeva chi l'ha mandato.
 */
function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const offset = (page - 1) * PAGE_SIZE;
  const from = offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  return (
    <nav aria-label="Paginazione" className="flex items-center justify-between gap-4">
      <p className="text-sm tabular-nums text-ink-subtle">
        {from}–{to} di {total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Precedente
        </Button>
        <Button variant="secondary" size="sm" disabled={to >= total} onClick={() => onChange(page + 1)}>
          Successiva
        </Button>
      </div>
    </nav>
  );
}

/**
 * Ripristino della posizione tornando dalla scheda, RIUSANDO
 * `src/lib/archivio-scroll.ts`: per l'archivio serramenti è costato una
 * sessione e due bug che solo il browser vero ha mostrato.
 *
 * Il salvataggio è su `pointerdown` in CATTURA e su `pagehide`, mai sullo
 * scroll e mai allo smontaggio: aprendo la scheda Next porta la pagina in cima
 * PRIMA che il componente si smonti, quindi si salverebbe 0.
 */
function useScrollRestore(key: string, hasData: boolean) {
  const restored = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

    const salva = () => saveScroll(key, window.scrollY);
    window.addEventListener("pointerdown", salva, { capture: true });
    window.addEventListener("pagehide", salva);
    return () => {
      window.removeEventListener("pointerdown", salva, { capture: true });
      window.removeEventListener("pagehide", salva);
    };
  }, [key]);

  useEffect(() => {
    if (!hasData || restored.current === key) return;
    const y = loadScroll(key);
    if (y === null) {
      restored.current = key;
      return;
    }
    // Un `rAF` dopo i dati: il DOM delle righe deve esistere, o si scorrerebbe
    // in una pagina ancora alta quanto lo scheletro. La cleanup NON annulla il
    // frame — annullarlo era uno dei due bug dell'archivio.
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
      restored.current = key;
    });
  }, [key, hasData]);
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

/**
 * Il titolo arriva intero e non composto da un pezzo variabile: «L'elenco dei
 * gruppi non è riuscita» è ciò che produce una frase modello in italiano, dove
 * il participio deve accordarsi col soggetto.
 */
function Errore({ titolo }: { titolo: string }) {
  return (
    <div role="alert" className="rounded-md border border-[#EBC9C9] bg-[#FBEDED] p-4">
      <p className="text-sm font-medium text-ink">{titolo}</p>
      <p className="mt-1 text-sm text-ink-muted">Riprova fra qualche istante.</p>
    </div>
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
