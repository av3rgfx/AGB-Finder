"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calculator, RefreshCw } from "lucide-react";
import { api } from "@/trpc/react";
import { formatPrice } from "@/lib/format";
import {
  hingeSideLabel,
  materialLabel,
  openingDirLabel,
  sedeIncontriLabel,
  windowTypeLabel,
} from "@/lib/kit-labels";
import { SCHEMI_TOUR } from "@/server/kit/rules-tour-bilico-legno";
import { GEOMETRIE, geometriaLabel } from "@/server/kit/artech-geometrie";
import { entrataLabel } from "@/server/kit/types";
import { StatusBadge } from "@/components/kit/status-badge";
import { DistintaTable } from "@/components/kit/distinta-table";
import { RiepilogoSconto } from "@/components/kit/riepilogo-sconto";
import { Button } from "@/components/ui/button";

/**
 * Geometria implicata dallo schema TOUR. **Non è persistita**: lo schema è
 * l'unica cosa a DB e il resto si deriva dalla stessa tabella che usa il motore
 * (importata, non ricopiata — l'asse dello schema 3 è 17,5 e in una colonna
 * intera non ci starebbe comunque).
 */
function tourGeometryLabel(schema: number): string | null {
  const s = SCHEMI_TOUR[schema as keyof typeof SCHEMI_TOUR];
  if (!s) return null;
  const asse = Number.isInteger(s.asseMm) ? String(s.asseMm) : String(s.asseMm).replace(".", ",");
  return `Listello ${s.listelloMm} · asse ${asse} · battuta ${s.battutaMm}`;
}

/** Estrae i warning dal JSON `generatedKit` (Prisma.JsonValue non tipizzato). */
function getWarnings(generatedKit: unknown): string[] {
  if (generatedKit && typeof generatedKit === "object" && "warnings" in generatedKit) {
    const warnings = (generatedKit as { warnings?: unknown }).warnings;
    if (Array.isArray(warnings)) return warnings.filter((w): w is string => typeof w === "string");
  }
  return [];
}

export function DettaglioClient({ id }: { id: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const request = api.kit.get.useQuery({ id });

  const generate = api.kit.generate.useMutation({
    onSuccess: () => {
      void utils.kit.get.invalidate({ id });
      void utils.kit.list.invalidate();
    },
  });

  // Ricalcolo VERSIONATO: su una richiesta già emessa non riscrive la distinta
  // che il cliente ha in mano, crea una nuova versione e ci porta sopra.
  const ricalcola = api.kit.ricalcola.useMutation({
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

  // I due pulsanti sono MUTUAMENTE ESCLUSIVI, e non per ordine: «Rigenera»
  // riscrive la distinta in loco (nessuno storico dei componenti), quindi è
  // lecito solo su una bozza che nessuno ha ancora visto. Su tutto il resto
  // l'unica strada è «Ricalcola», che congela questa versione e ne crea una
  // nuova — la stessa invariante è imposta dal router (`kit.generate` risponde
  // CONFLICT), qui si evita di offrire un pulsante che verrebbe rifiutato.
  const puoRigenerare = r.status === "DRAFT";
  const puoRicalcolare = !puoRigenerare && r.supersededById === null;

  const distintaVuotaMsg = puoRigenerare
    ? "Distinta non ancora generata. Usa «Rigenera» per calcolare i componenti dal catalogo."
    : puoRicalcolare
      ? "Nessun componente di questa distinta è a catalogo. Usa «Ricalcola» per rifarla su una nuova versione."
      : "Nessun componente di questa distinta è a catalogo.";

  /**
   * «Ricalcola» ricalcola davvero: crea la nuova versione `DRAFT`, **ne genera
   * la distinta** e solo dopo ci naviga. Senza la generazione l'agente
   * atterrerebbe su «Distinta non ancora generata» con un pulsante da premere, e
   * il nome del pulsante sarebbe una bugia. Stessa forma di `handleGenera` nel
   * wizard: l'errore di generazione non blocca la navigazione (la riga esiste,
   * è `DRAFT`, e la sua scheda offre «Rigenera» e mostra il messaggio).
   */
  async function handleRicalcola() {
    let nuovaId: string;
    try {
      const nuova = await ricalcola.mutateAsync({ kitRequestId: r.id });
      nuovaId = nuova.id;
    } catch {
      // il messaggio lo mostra `ricalcola.isError` qui sotto
      return;
    }
    try {
      await generate.mutateAsync({ kitRequestId: nuovaId });
    } catch {
      /* vedi sopra: si naviga comunque, l'errore è visibile sulla nuova scheda */
    } finally {
      router.push(`/richieste/${nuovaId}`);
    }
  }

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
          {r.customer && <> · {r.customer.companyName}</>}
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
        {/* Mobile-first: UNA colonna sotto sm. Il valore più lungo del progetto
            vive qui — «Aria 12 · interasse 13 · battuta 20» — e in mezza
            larghezza a 375px andava a capo tre volte. Il desktop non cambia. */}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-line bg-surface p-6 text-sm sm:grid-cols-3">
          <Spec label="Dimensioni" value={`${r.widthMm} × ${r.heightMm} mm`} />
          <Spec label="Materiale" value={materialLabel(r.material)} />
          <Spec label="Serie" value={r.series} />
          <Spec label="Finitura" value={r.finish} />
          {/* Le specifiche sono per SERIE: mano, apertura e geometria esistono
              solo su ARTECH e sono NULL sulle righe TOUR. Il bilico mostra
              invece il suo schema di montaggio e — echeggiata, non nascosta —
              la geometria che quel numero implica: non è persistita, si deriva,
              e l'agente deve poterla rileggere per accorgersi di uno schema
              scelto male. */}
          {r.series === "TOUR" && r.tourSchema !== null ? (
            <>
              <Spec label="Schema" value={`Schema ${r.tourSchema}`} />
              {tourGeometryLabel(r.tourSchema) && (
                <Spec label="Geometria" value={tourGeometryLabel(r.tourSchema)!} />
              )}
              <Spec
                label="Ferramenta"
                value={r.widthMm * r.heightMm >= 2_000_000 ? "4 lati" : "3 lati"}
              />
            </>
          ) : (
            <>
              {r.openingSide !== null && (
                <Spec label="Mano" value={hingeSideLabel(r.openingSide)} />
              )}
              {r.openingDir !== null && (
                <Spec label="Apertura" value={openingDirLabel(r.openingDir)} />
              )}
              {/* La geometria è UNA colonna, e la sede si DERIVA da quella (stessa
                  tabella che usa il motore: non è una seconda fonte di verità).
                  Le quattro colonne numeriche restano solo come LEGACY e sono NULL
                  su ogni riga creata dopo la migrazione: se le mostrassimo lì, il
                  dettaglio perderebbe la geometria proprio sulle righe nuove.
                  Il ramo `else` non è morto — la migrazione lascia `geometry` NULL
                  sulle righe storiche che non ha saputo riconoscere (aria 4, sede
                  30): quelle non si possono rigenerare, ma le loro quote vanno
                  comunque lette. */}
              {r.geometry !== null ? (
                <>
                  <Spec label="Geometria" value={geometriaLabel(r.geometry)} />
                  {r.entrata !== null && (
                    <Spec label="Entrata maniglia" value={entrataLabel(r.entrata)} />
                  )}
                  <Spec
                    label="Sede incontri"
                    value={sedeIncontriLabel(GEOMETRIE[r.geometry].sedeMm)}
                  />
                </>
              ) : (
                <>
                  {r.airGapMm !== null && <Spec label="Aria" value={`${r.airGapMm} mm`} />}
                  {r.axisOffsetMm !== null && <Spec label="Asse" value={`${r.axisOffsetMm} mm`} />}
                  {r.rebateMm !== null && <Spec label="Battuta" value={`${r.rebateMm} mm`} />}
                  {r.seatMm !== null && <Spec label="Sede telaio" value={`${r.seatMm} mm`} />}
                </>
              )}
            </>
          )}
          {/* Facoltativo: mostrato solo se indicato. Va reso visibile perché
              cambia la distinta (terza cerniera oltre i 70 kg), altrimenti due
              richieste identiche a video darebbero distinte diverse. */}
          {r.sashWeightKg !== null && <Spec label="Peso anta" value={`${r.sashWeightKg} kg`} />}
        </dl>
      </section>

      <section aria-labelledby="distinta-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="distinta-heading" className="text-sm font-semibold text-ink">
            Distinta componenti
          </h2>
          {/* Mobile-first: il pulsante va a capo sotto il titolo a 375px invece
              di stringersi accanto. Ne compare sempre al massimo uno — vedi
              `puoRigenerare`/`puoRicalcolare`. */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Su una bozza basta «Rigenera»: nessuno l'ha ancora vista. */}
            {puoRigenerare && (
              <Button
                variant="secondary"
                size="sm"
                loading={generate.isPending}
                onClick={() => generate.mutate({ kitRequestId: id })}
              >
                <RefreshCw className="size-4" aria-hidden />
                Rigenera
              </Button>
            )}
            {/* Su una riga già superata non compare nessuno dei due: il ricalcolo
                va fatto sulla versione più recente, linkata qui sotto (e il
                router lo rifiuta comunque con CONFLICT). */}
            {puoRicalcolare && (
              <Button
                variant="secondary"
                size="sm"
                loading={ricalcola.isPending || generate.isPending}
                onClick={() => void handleRicalcola()}
              >
                <Calculator className="size-4" aria-hidden />
                Ricalcola
              </Button>
            )}
          </div>
        </div>

        {r.supersededById !== null && (
          <p className="rounded-md border border-line bg-surface-sunken px-4 py-3 text-xs text-ink-subtle">
            Questa distinta è stata ricalcolata.{" "}
            <Link
              href={`/richieste/${r.supersededById}`}
              className="font-medium text-brand underline"
            >
              Apri la versione più recente
            </Link>
          </p>
        )}

        {generate.isError && (
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
          >
            {generate.error.message}
          </div>
        )}

        {ricalcola.isError && (
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
          >
            {ricalcola.error.message}
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
          <>
            <DistintaTable
              components={r.components.map((c) => ({
                ...c,
                listinoPage: c.product?.listinoPage ?? null,
              }))}
              warnings={warnings}
            />
            {/* Su una riga superata il riepilogo e` in sola lettura: lo sconto va
                messo sulla versione piu` recente, e il router lo rifiuterebbe
                comunque con CONFLICT. */}
            <RiepilogoSconto
              requestId={r.id}
              lordo={r.totalPrice ?? 0}
              discountPercent={r.discountPercent}
              netto={r.netPrice ?? r.totalPrice ?? 0}
              scontoImporto={r.discountAmount}
              soglia={r.soglia}
              readOnly={r.supersededById !== null}
            />
          </>
        ) : (
          <div className="rounded-md border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-subtle">
            {distintaVuotaMsg}
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
