"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { ArticleSummary } from "@/server/api/routers/article";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/maniglie/stock-badge";
import { StockDate } from "@/components/maniglie/stock-date";
import {
  FiltriSfoglia,
  FiltroFinitura,
  SfogliaGruppi,
  SfogliaSerie,
  SoloPronta,
} from "@/components/maniglie/sfoglia";
import { formatPrice } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { loadScroll, saveScroll } from "@/lib/archivio-scroll";
import { leggiSerieAperte, scriviSerieAperte } from "@/lib/serie-aperte";

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
  // Le tendine aperte: `?fam=CD73,CC113`. Un vecchio link a una sola famiglia
  // è già un elenco valido di una voce sola, quindi non muore.
  const aperte = leggiSerieAperte(searchParams.get("fam"));
  // Il filtro sta nell'URL come tutto il resto: si condivide, il tasto indietro
  // lo spegne, e nessuno stato nascosto decide cosa l'agente sta guardando.
  const soloPronta = searchParams.get("pronta") === "1";
  // La finitura è un filtro come gli altri: sta nell'URL, quindi si condivide e
  // il tasto indietro la spegne. `""` = tutte.
  const finitura = (searchParams.get("finitura") ?? "").trim();
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
    { soloPronta, ...(finitura ? { finitura } : {}) },
    { enabled: !cercando && !tipo, staleTime: 5 * 60_000 },
  );

  // Livello 2: le serie del gruppo, CON le loro righe. Una richiesta sola per
  // tutto il gruppo: le tendine si aprono e si chiudono senza rete.
  const serie = api.article.browseSerie.useQuery(
    { tipo, soloPronta, ...(finitura ? { finitura } : {}) },
    { enabled: sfogliando, staleTime: 5 * 60_000 },
  );

  // La ricerca testuale è l'unico mestiere rimasto a `search`: lo sfoglio ha un
  // lettore solo, o le stesse righe avrebbero due definizioni libere di divergere.
  const search = api.article.search.useQuery(
    { query: committed, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
    { enabled: cercando, placeholderData: keepPreviousData, staleTime: 5 * 60_000 },
  );

  // La data dell'ultimo import, indipendente da ricerca e sfoglio: la pagina la
  // mostra anche appena aperta, quando non c'è ancora nulla da datare ma c'è
  // già una domanda a cui rispondere.
  const stockInfo = api.article.stockInfo.useQuery({}, { staleTime: 5 * 60_000 });

  // Le finiture DA OFFRIRE: quelle presenti nel contesto che si sta guardando —
  // dentro FEDRA sono cinque, non ventotto. Non si chiedono cercando per testo,
  // dove il filtro non vale.
  const finitureQuery = api.article.finiture.useQuery(
    { soloPronta, ...(tipo ? { tipo } : {}) },
    { enabled: !cercando, staleTime: 5 * 60_000 },
  );
  const opzioniFinitura = finitureQuery.data?.finiture ?? [];
  /** Il codice sta nell'URL, il nome nelle frasi: si tengono insieme. */
  const finituraScelta = opzioniFinitura.find((o) => o.codice === finitura) ?? null;

  const hits = search.data?.hits ?? [];
  const total = search.data?.total ?? 0;

  const setPage = useCallback(
    (p: number) => {
      const next = new URLSearchParams(searchParams.toString());
      if (p <= 1) next.delete("p");
      else next.set("p", String(p));
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /**
   * Accendere o spegnere il filtro riparte da pagina 1: restare alla pagina 7 di
   * un elenco che si è ristretto da 338 a 12 codici significa vedere una
   * schermata vuota e credere che non ci sia niente.
   */
  const setSoloPronta = useCallback(
    (v: boolean) => {
      const next = new URLSearchParams(searchParams.toString());
      if (v) next.set("pronta", "1");
      else next.delete("pronta");
      next.delete("p");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /**
   * Cambiare finitura riparte da pagina 1, come il filtro della pronta consegna:
   * restare alla pagina 7 di un elenco che si è ristretto significa vedere una
   * schermata vuota e credere che non ci sia niente.
   */
  const setFinitura = useCallback(
    (v: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (v) next.set("finitura", v);
      else next.delete("finitura");
      next.delete("p");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /**
   * LE TENDINE APERTE: stato locale, e l'URL scritto con `history.replaceState`.
   *
   * Due cose imparate in browser, nessuna delle quali si vedeva dai test.
   *
   * (1) Rendere `open` direttamente da `?fam=` non funziona: fra il momento in
   * cui si scrive l'URL e il render successivo React riporta a CHIUSA la
   * tendina appena aperta, e quel reset emette un altro `toggle` — con
   * `open=false` — che la toglie dall'elenco.
   *
   * (2) `router.replace` fa un giro sul server: l'URL resta indietro di un
   * toggle, e aprendone due di fila la seconda scrittura si perde nella corsa
   * (misurato: due tendine aperte a schermo, `?fam=` con una sola, e la seconda
   * sparita al primo ricaricamento). Ma nulla, sul server, dipende da `?fam=`:
   * è memoria per il ricaricamento e per il link che si manda a un collega.
   * `history.replaceState` la scrive subito, senza rifetch e senza render.
   */
  const [aperteLocali, setAperteLocali] = useState<string[]>(aperte);
  const aperteRef = useRef(aperteLocali);

  // Cambiando gruppo si riparte da ciò che dice l'URL di ARRIVO: un link
  // `?tipo=X&fam=Y` apre Y, un link al solo gruppo non apre niente.
  // SOLO su `tipo`: con `aperte` fra le dipendenze l'effetto si riattiverebbe
  // a ogni nostra scrittura e riporterebbe indietro lo stato.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    aperteRef.current = aperte;
    setAperteLocali(aperte);
  }, [tipo]);

  const toggleSerie = useCallback((nome: string, aperta: boolean) => {
    const correnti = aperteRef.current;
    // Eco della riconciliazione di React, non un gesto dell'agente: si ignora.
    if (aperta === correnti.includes(nome)) return;
    const prossime = aperta ? [...correnti, nome] : correnti.filter((x) => x !== nome);
    aperteRef.current = prossime;
    setAperteLocali(prossime);

    // `fam` si riscrive per intero, quindi la sua eventuale staleness in
    // `searchParams` non conta; gli altri parametri non cambiano aprendo una
    // tendina.
    const next = new URLSearchParams(searchParams.toString());
    const v = scriviSerieAperte(prossime);
    if (v) next.set("fam", v);
    else next.delete("fam");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, searchParams]);

  useScrollRestore(
    `${committed}|${tipo}|${aperteLocali.join(",")}|${page}|${soloPronta}|${finitura}`,
    Boolean(search.data ?? gruppi.data ?? serie.data),
  );

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

      {/* Il filtro sta qui e non dentro l'elenco dei gruppi: vale a TUTTI i
          livelli dello sfoglio, quindi si accende e si vede anche da dentro un
          gruppo. Compare solo se una giacenza esiste — `stockInfo.importedAt`
          è la stessa e unica fonte della data mostrata sopra, non una seconda
          affermazione sullo stesso fatto. */}
      {!cercando ? (
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          {stockInfo.data?.importedAt ? (
            <SoloPronta value={soloPronta} onChange={setSoloPronta} />
          ) : null}
          <FiltroFinitura
            opzioni={opzioniFinitura}
            value={finitura}
            onChange={setFinitura}
          />
        </div>
      ) : null}

      {sfogliando ? (
        <FiltriSfoglia
          // L'etichetta RISOLTA dal server: un `?tipo=MANIG.` condiviso prima
          // della fusione mostrerebbe altrimenti un nome che non è quello del
          // gruppo che si ha davanti.
          tipo={serie.data?.tipo ?? tipo}
          soloPronta={soloPronta}
          finitura={finituraScelta}
        />
      ) : null}

      <section
        aria-label={sfogliando ? "Sfoglia" : "Risultati"}
        aria-busy={search.isFetching || gruppi.isFetching || serie.isFetching}
        className="flex flex-col gap-3"
      >
        {!cercando && !tipo ? (
          gruppi.isPending ? (
            <SkeletonList />
          ) : gruppi.isError ? (
            <Errore titolo="Gruppi non caricati" />
          ) : (
            <SfogliaGruppi
              groups={gruppi.data?.groups ?? []}
              soloPronta={soloPronta}
              finitura={finituraScelta}
            />
          )
        ) : sfogliando ? (
          serie.isPending ? (
            <SkeletonList />
          ) : serie.isError ? (
            <Errore titolo="Serie non caricate" />
          ) : serie.data && serie.data.total === 0 ? (
            <EmptyState
              title="Nessun codice in questo gruppo"
              detail={<>Torna indietro e scegli un altro gruppo.</>}
            />
          ) : (
            <>
              <p className="text-sm text-ink-subtle" aria-live="polite">
                {serie.data?.total === 1 ? "1 articolo" : `${serie.data?.total ?? 0} articoli`}
              </p>
              <SfogliaSerie
                serie={serie.data?.serie ?? []}
                aperte={aperteLocali}
                onToggle={toggleSerie}
                senzaSerie={serie.data?.senzaSerie ?? []}
                isModello={serie.data?.isModello ?? false}
                renderRiga={(articolo) => <ArticoloRow key={articolo.id} articolo={articolo} />}
              />
            </>
          )
        ) : search.isPending ? (
          <SkeletonList />
        ) : search.isError ? (
          <Errore titolo="Ricerca non riuscita" />
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
            </p>
            <ul className="list-none overflow-hidden rounded-md border border-line">
              {hits.map((articolo) => (
                <ArticoloRow key={articolo.id} articolo={articolo} />
              ))}
            </ul>
            <Pagination page={page} total={total} onChange={setPage} />
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
        {/* A 375px il nome va a capo invece di troncarsi: sfogliando una
            famiglia le righe sono nomi quasi identici, in cui l'unica parola
            diversa è l'ultima («… CROMAT» / «… OROPLUS»). Troncare taglierebbe
            esattamente ciò che le distingue. Due righe bastano: le descrizioni
            del listino sono tagliate a 35 caratteri già alla fonte. Da `sm` in
            su la riga resta una griglia allineata, e lì il troncamento va bene. */}
        <span className="line-clamp-2 min-w-0 text-sm font-medium text-ink sm:truncate">
          {articolo.name}
        </span>
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
 * Miniatura, servita da `/api/article-image` (Blob privato, dietro auth).
 *
 * Foto mancante = **spazio vuoto**, non segnaposto, ed è la stessa regola già
 * scritta per l'anteprima delle serie: con la copertura al 46,6% l'assenza è la
 * maggioranza — in MANIGLIONE sono 336 righe su 353 — e una colonna di riquadri
 * grigi si legge come «il programma è rotto». Peggio ancora sotto
 * un'intestazione di serie che la foto ce l'ha: non dice «non l'abbiamo», dice
 * «ce l'abbiamo e non te la mostriamo». Lo spazio resta, così l'allineamento
 * non si muove riga per riga.
 *
 * ⚠️ La scheda del singolo articolo tiene invece il suo segnaposto: lì l'oggetto
 * è uno solo, un vuoto grande è peggio di un riquadro neutro, e l'argomento «N
 * buchi si leggono come guasto» richiede la ripetizione.
 */
function Foto({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span aria-hidden className="size-11 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
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
