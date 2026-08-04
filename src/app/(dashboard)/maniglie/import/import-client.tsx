"use client";

import { useId, useState } from "react";
import { ArrowUpFromLine, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/trpc/react";
import { formatDate } from "@/lib/format";

/**
 * Importazione della pronta consegna (marca COLOMBO).
 *
 * Tre fasi: si carica, si LEGGE il riepilogo, si conferma. Il riepilogo è il
 * pezzo che conta: è l'unica cosa che sta fra il file della marca sbagliata e
 * dieci agenti che si trovano davanti un magazzino irriconoscibile. Per questo
 * dice la CONSEGUENZA («risulteranno in pronta consegna per tutti gli agenti»)
 * e non l'azione («stai per importare 178 righe»).
 *
 * I codici non a listino NON sono errori e non vanno chiamati così: la maggior
 * parte sono prodotti veri che mancano solo perché il listino in mano è vecchio.
 * Chiamarli errori manderebbe Andrea a cercare un guasto che non c'è.
 */

/** Unica marca gestita oggi. Le altre tre arriveranno con il loro listino. */
const BRAND = "COLOMBO";

/** Risposta della route di anteprima (`POST /api/maniglie/stock-import`). */
interface Anteprima {
  fileName: string;
  brand: string;
  rawCodes: string[];
  rowCount: number;
  matchedCount: number;
  orphans: string[];
  duplicates: string[];
  invalid: string[];
  entered: number;
  left: number;
  previousImportedAt: string | null;
}

interface Esito {
  importedAt: Date | string;
  matchedCount: number;
  orphanCount: number;
}

interface RigaStorico {
  id: string;
  fileName: string;
  importedAt: Date | string;
  rowCount: number;
  matchedCount: number;
  orphanCount: number;
  cancelledAt: Date | string | null;
  importedBy: string;
  inForce: boolean;
}

/**
 * Data per esteso («4 luglio 2026»). `formatDate` resta per la tabella, dove la
 * forma breve è quella giusta; dentro una frase un «04/07/26» si legge peggio,
 * e queste frasi esistono apposta per essere lette prima di premere Conferma.
 */
const dataEstesa = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});
function formatDateLong(value: Date | string): string {
  return dataEstesa.format(new Date(value));
}

/** Messaggio d'errore della route, senza `any` e senza inghiottirlo. */
function messaggioErrore(data: unknown): string | null {
  if (typeof data === "object" && data !== null && "error" in data) {
    const errore = (data as { error: unknown }).error;
    if (typeof errore === "string" && errore.trim()) return errore.trim();
  }
  return null;
}

export function ImportClient() {
  const utils = api.useUtils();
  const [anteprima, setAnteprima] = useState<Anteprima | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [lettura, setLettura] = useState(false);
  const [nomeFile, setNomeFile] = useState<string | null>(null);

  const conferma = api.article.confirmStockImport.useMutation({
    onSuccess: (risultato) => {
      setEsito(risultato);
      setAnteprima(null);
      setNomeFile(null);
      // Lo storico deve mostrare subito la nuova riga «IN VIGORE».
      void utils.article.stockImports.invalidate();
    },
  });

  /**
   * Deroga ammessa alla regola «mai `fetch` diretto dal client»: un upload
   * multipart non è esprimibile su `httpBatchLink`. La deroga copre la sola
   * LETTURA del file — la scrittura resta in tRPC.
   */
  async function leggiFile(file: File) {
    setErrore(null);
    setEsito(null);
    setAnteprima(null);
    setNomeFile(file.name);
    setLettura(true);
    conferma.reset();
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("brand", BRAND);
      const risposta = await fetch("/api/maniglie/stock-import", { method: "POST", body: form });
      const dati: unknown = await risposta.json().catch(() => null);
      if (!risposta.ok) {
        setErrore(
          messaggioErrore(dati) ?? `Il file non è stato letto (errore ${risposta.status}).`,
        );
        return;
      }
      setAnteprima(dati as Anteprima);
    } catch {
      setErrore("Non è stato possibile leggere il file: controlla la connessione e riprova.");
    } finally {
      setLettura(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {esito && !anteprima && <BannerEsito esito={esito} />}

      {anteprima ? (
        <Riepilogo
          anteprima={anteprima}
          inCorso={conferma.isPending}
          errore={conferma.error?.message ?? null}
          onConferma={() =>
            conferma.mutate({
              brand: anteprima.brand,
              fileName: anteprima.fileName,
              rawCodes: anteprima.rawCodes,
            })
          }
          onAnnulla={() => {
            setAnteprima(null);
            setNomeFile(null);
            conferma.reset();
          }}
        />
      ) : (
        <ZonaCaricamento
          lettura={lettura}
          nomeFile={nomeFile}
          errore={errore}
          onFile={(file) => void leggiFile(file)}
        />
      )}

      <Storico />
    </div>
  );
}

// ── Fase 1 — carica ───────────────────────────────────────────────────────

function ZonaCaricamento({
  lettura,
  nomeFile,
  errore,
  onFile,
}: {
  lettura: boolean;
  nomeFile: string | null;
  errore: string | null;
  onFile: (file: File) => void;
}) {
  const inputId = useId();
  const [sopra, setSopra] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!lettura) setSopra(true);
        }}
        onDragLeave={() => setSopra(false)}
        onDrop={(event) => {
          event.preventDefault();
          setSopra(false);
          if (lettura) return;
          const file = event.dataTransfer?.files?.[0];
          if (file) onFile(file);
        }}
        className={`rounded-md border-2 border-dashed bg-surface-sunken px-4 py-10 text-center transition-colors duration-150 ease-out-quart ${
          sopra ? "border-brand bg-brand-light" : "border-line-strong"
        } ${lettura ? "opacity-60" : ""}`}
      >
        <ArrowUpFromLine className="mx-auto mb-3 size-7 text-ink-subtle" aria-hidden />
        {lettura ? (
          <p className="text-sm font-medium text-ink" role="status">
            Lettura del file…
          </p>
        ) : (
          <p className="text-sm text-ink">
            Trascina qui il file, oppure{" "}
            <input
              id={inputId}
              type="file"
              accept=".xls,.xlsx"
              disabled={lettura}
              className="peer sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Il campo si svuota subito: ricaricare DUE VOLTE lo stesso file
                // (perché nel frattempo è cambiato) deve funzionare.
                event.target.value = "";
                if (file) onFile(file);
              }}
            />
            <label
              htmlFor={inputId}
              className="cursor-pointer rounded font-medium text-brand underline underline-offset-2 hover:text-brand-dark peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40"
            >
              scegli dal computer
            </label>
          </p>
        )}
        <p className="mt-2 text-xs text-ink-subtle">
          Formato <span className="font-mono">.xls</span> · viene letta solo la prima colonna
        </p>
        {nomeFile && <p className="mt-3 break-all font-mono text-xs text-ink-muted">{nomeFile}</p>}
      </div>

      {errore && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {errore}
        </p>
      )}
    </section>
  );
}

// ── Fase 2 — il riepilogo ─────────────────────────────────────────────────

function Riepilogo({
  anteprima,
  inCorso,
  errore,
  onConferma,
  onAnnulla,
}: {
  anteprima: Anteprima;
  inCorso: boolean;
  errore: string | null;
  onConferma: () => void;
  onAnnulla: () => void;
}) {
  const orfani = anteprima.orphans.length;
  const riconosciuti = anteprima.matchedCount;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 shadow-card">
      <div>
        <h2 className="font-semibold text-ink">Riepilogo prima della conferma</h2>
        <p className="mt-1 break-all text-sm text-ink-subtle">
          <span className="font-mono">{anteprima.fileName}</span> · marca{" "}
          <span className="font-mono">{anteprima.brand}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Riquadro etichetta="righe lette" valore={anteprima.rowCount} />
        <Riquadro etichetta="articoli riconosciuti" valore={riconosciuti} />
        <Riquadro
          etichetta="codici non a listino"
          valore={orfani}
          className="bg-[#FBF4E2]"
          classeValore="text-[#8A6800]"
        />
      </div>

      {anteprima.previousImportedAt && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-success">
            <span aria-hidden>↑</span> <strong>+{anteprima.entered}</strong> entrati rispetto al{" "}
            {formatDateLong(anteprima.previousImportedAt)}
          </p>
          <p className="text-ink-muted">
            <span aria-hidden>↓</span> <strong>−{anteprima.left}</strong> usciti
          </p>
        </div>
      )}

      {orfani > 0 && (
        <div className="rounded-md border border-[#E7D9AE] bg-[#FBF4E2]/60 p-3">
          <p className="text-sm text-ink">
            <strong className="text-[#8A6800]">
              {orfani} {orfani === 1 ? "codice verrà ignorato" : "codici verranno ignorati"}
            </strong>{" "}
            perché non {orfani === 1 ? "è" : "sono"} a listino. Restano registrati: se compariranno
            in un listino futuro, si agganceranno da soli.
          </p>
          <ul className="mt-2 flex max-h-[160px] flex-wrap gap-1.5 overflow-auto">
            {anteprima.orphans.map((codice) => (
              <li
                key={codice}
                className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-xs text-ink-muted"
              >
                {codice}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(anteprima.duplicates.length > 0 || anteprima.invalid.length > 0) && (
        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          {anteprima.duplicates.length > 0 && (
            <p>
              {anteprima.duplicates.length}{" "}
              {anteprima.duplicates.length === 1
                ? "codice ripetuto nel file: contato"
                : "codici ripetuti nel file: contati"}{" "}
              una volta sola.
            </p>
          )}
          {anteprima.invalid.length > 0 && (
            <p>
              {anteprima.invalid.length}{" "}
              {anteprima.invalid.length === 1
                ? "cella senza un codice utilizzabile: ignorata"
                : "celle senza un codice utilizzabile: ignorate"}
              .
            </p>
          )}
        </div>
      )}

      <p className="rounded-md bg-brand-light p-3 text-sm text-ink">
        Dopo la conferma,{" "}
        <strong>
          {riconosciuti} {riconosciuti === 1 ? "articolo" : "articoli"}
        </strong>{" "}
        {riconosciuti === 1 ? "risulterà" : "risulteranno"} in pronta consegna per tutti gli agenti.
      </p>

      {errore && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {errore}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={inCorso}
          onClick={onConferma}
          className="h-11 rounded bg-brand px-4 text-sm font-medium text-white transition-colors duration-150 ease-out-quart hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
        >
          {inCorso ? "Importazione…" : "Conferma importazione"}
        </button>
        <button
          type="button"
          disabled={inCorso}
          onClick={onAnnulla}
          className="h-11 rounded border border-line-strong px-4 text-sm text-ink transition-colors duration-150 ease-out-quart hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Annulla
        </button>
      </div>
    </section>
  );
}

function Riquadro({
  etichetta,
  valore,
  className = "bg-surface-sunken",
  classeValore = "text-ink",
}: {
  etichetta: string;
  valore: number;
  className?: string;
  classeValore?: string;
}) {
  return (
    <div className={`min-w-[9rem] flex-1 rounded-md p-3 ${className}`}>
      <p className={`text-2xl font-semibold tabular-nums ${classeValore}`}>{valore}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{etichetta}</p>
    </div>
  );
}

// ── Fase 3 — fatto ────────────────────────────────────────────────────────

function BannerEsito({ esito }: { esito: Esito }) {
  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-md border border-success/30 bg-[#EAF4EC] p-3 text-sm text-[#215C2C]"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      <span>
        Importazione completata: <strong>{esito.matchedCount}</strong>{" "}
        {esito.matchedCount === 1 ? "articolo" : "articoli"} in pronta consegna per tutti gli
        agenti, {esito.orphanCount} {esito.orphanCount === 1 ? "codice" : "codici"} non a listino
        {esito.orphanCount === 1 ? " ignorato" : " ignorati"} · {formatDateLong(esito.importedAt)}
      </span>
    </p>
  );
}

// ── Storico ───────────────────────────────────────────────────────────────

function Storico() {
  const utils = api.useUtils();
  const storico = api.article.stockImports.useQuery({ brand: BRAND });
  const [espansa, setEspansa] = useState<string | null>(null);
  const [daAnnullare, setDaAnnullare] = useState<string | null>(null);

  const annulla = api.article.cancelLastStockImport.useMutation({
    onSuccess: () => {
      setDaAnnullare(null);
      void utils.article.stockImports.invalidate();
    },
  });

  const righe: RigaStorico[] = storico.data ?? [];
  const inVigore = righe.find((riga) => riga.inForce) ?? null;
  // Il predecessore è il primo non annullato dopo quello in vigore: è l'import
  // che torna a valere, ed è la conseguenza da dichiarare prima di annullare.
  const precedente = righe.find((riga) => !riga.cancelledAt && riga.id !== inVigore?.id) ?? null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-ink">Caricamenti precedenti</h2>

      {storico.isPending && <p className="text-sm text-ink-subtle">Caricamento…</p>}
      {storico.isError && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          Errore nel caricamento dello storico.
        </p>
      )}
      {!storico.isPending && !storico.isError && righe.length === 0 && (
        <p className="text-sm text-ink-subtle">
          Nessun file ancora caricato per {BRAND}: tutti gli articoli risultano da ordinare.
        </p>
      )}

      {annulla.error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {annulla.error.message}
        </p>
      )}

      {righe.length > 0 && (
        // Il contenitore scorre in orizzontale al posto della pagina: a 375px è
        // la tabella a muoversi, non tutto lo schermo.
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-line text-left text-ink-subtle">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Data
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  File
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Da
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Righe
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Agganciate
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Orfane
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Stato
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Azione
                </th>
              </tr>
            </thead>
            <tbody>
              {righe.map((riga) => {
                const aperta = espansa === riga.id;
                return (
                  <RigheImport
                    key={riga.id}
                    riga={riga}
                    aperta={aperta}
                    inConferma={daAnnullare === riga.id}
                    annullamentoInCorso={annulla.isPending}
                    precedente={precedente}
                    onToggle={() => setEspansa(aperta ? null : riga.id)}
                    onChiediAnnullo={() => setDaAnnullare(riga.id)}
                    onDesisti={() => setDaAnnullare(null)}
                    onConfermaAnnullo={() => annulla.mutate({ brand: BRAND })}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RigheImport({
  riga,
  aperta,
  inConferma,
  annullamentoInCorso,
  precedente,
  onToggle,
  onChiediAnnullo,
  onDesisti,
  onConfermaAnnullo,
}: {
  riga: RigaStorico;
  aperta: boolean;
  inConferma: boolean;
  annullamentoInCorso: boolean;
  precedente: RigaStorico | null;
  onToggle: () => void;
  onChiediAnnullo: () => void;
  onDesisti: () => void;
  onConfermaAnnullo: () => void;
}) {
  const Freccia = aperta ? ChevronDown : ChevronRight;

  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer border-b border-line hover:bg-surface-page">
        <td className="whitespace-nowrap px-3 py-2 text-ink">
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              aria-expanded={aperta}
              aria-label={`Codici non a listino del file ${riga.fileName}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              className="grid size-6 shrink-0 place-items-center rounded text-ink-subtle transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <Freccia className="size-4" aria-hidden />
            </button>
            {formatDate(riga.importedAt)}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-ink-muted">{riga.fileName}</td>
        <td className="whitespace-nowrap px-3 py-2 text-ink-muted">{riga.importedBy}</td>
        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{riga.rowCount}</td>
        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{riga.matchedCount}</td>
        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{riga.orphanCount}</td>
        <td className="px-3 py-2">
          <Pillola riga={riga} />
        </td>
        <td className="px-3 py-2 text-right">
          {/* Solo sulla riga in vigore. Sulle altre il pulsante non è disabilitato:
              non c'è. Un pulsante grigio invita a chiedersi perché non funziona. */}
          {riga.inForce && !inConferma && (
            <button
              type="button"
              aria-label={`Annulla l'import del ${formatDate(riga.importedAt)}`}
              onClick={(event) => {
                event.stopPropagation();
                onChiediAnnullo();
              }}
              className="rounded border border-line-strong px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            >
              Annulla
            </button>
          )}
        </td>
      </tr>

      {inConferma && (
        <tr className="border-b border-line bg-surface-sunken">
          <td colSpan={8} className="px-3 py-3">
            <p className="text-sm text-ink">
              L&apos;import del {formatDateLong(riga.importedAt)} smetterà di valere{" "}
              {precedente ? (
                <>e tornerà in vigore quello del {formatDateLong(precedente.importedAt)}.</>
              ) : (
                <>
                  e tornerà in vigore quello precedente: se non ce n&apos;è nessuno, per {BRAND} non
                  risulterà più nessun articolo in pronta consegna.
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={annullamentoInCorso}
                onClick={onConfermaAnnullo}
                className="rounded bg-danger px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {annullamentoInCorso ? "Annullamento…" : "Sì, annulla l'import"}
              </button>
              <button
                type="button"
                onClick={onDesisti}
                className="rounded border border-line-strong px-3 py-1.5 text-xs text-ink transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                No, lascia com&apos;è
              </button>
            </div>
          </td>
        </tr>
      )}

      {aperta && (
        <tr className="border-b border-line bg-surface-page">
          <td colSpan={8} className="px-3 py-3">
            <Orfani importId={riga.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function Pillola({ riga }: { riga: RigaStorico }) {
  if (riga.cancelledAt) {
    return (
      <span className="inline-block whitespace-nowrap rounded bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-subtle">
        annullato
      </span>
    );
  }
  if (riga.inForce) {
    return (
      <span className="inline-block whitespace-nowrap rounded bg-[#EAF4EC] px-2 py-0.5 text-xs font-medium text-[#215C2C]">
        IN VIGORE
      </span>
    );
  }
  return (
    <span className="inline-block whitespace-nowrap rounded bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-muted">
      superato
    </span>
  );
}

function Orfani({ importId }: { importId: string }) {
  const orfani = api.article.stockImportOrphans.useQuery({ importId });

  if (orfani.isPending) return <p className="text-sm text-ink-subtle">Caricamento…</p>;
  if (orfani.isError)
    return (
      <p role="alert" className="text-sm text-danger">
        Errore nel caricamento dei codici non a listino.
      </p>
    );
  const codici = orfani.data ?? [];
  if (codici.length === 0)
    return <p className="text-sm text-ink-subtle">Tutti i codici di questo file sono a listino.</p>;

  return (
    <div>
      <p className="text-sm text-ink-muted">
        {codici.length} {codici.length === 1 ? "codice non a listino" : "codici non a listino"},
        registrati e in attesa di un listino che li contenga.
      </p>
      <ul className="mt-2 flex max-h-[160px] flex-wrap gap-1.5 overflow-auto">
        {codici.map((codice) => (
          <li
            key={codice}
            className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-xs text-ink-muted"
          >
            {codice}
          </li>
        ))}
      </ul>
    </div>
  );
}
