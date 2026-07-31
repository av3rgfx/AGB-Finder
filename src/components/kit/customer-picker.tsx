"use client";

import { useId, useState } from "react";
import { Plus, Search, UserRound } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import { GEOMETRIE, geometriaLabel, type ArtechGeometryId } from "@/server/kit/artech-geometrie";
import { ENTRATE, entrataLabel, type Entrata } from "@/server/kit/types";

export interface CustomerOption {
  id: string;
  companyName: string;
  discount: number | null;
  /** Profilo serramento — vedi `ProfiloSerramento`. NULL = non dichiarato. */
  kitGeometry: ArtechGeometryId | null;
  kitEntrata: Entrata | null;
}

/**
 * Classi del `<select>` native, allineate agli altri campi del wizard.
 * `h-11` è la soglia di bersaglio tattile che il progetto usa ovunque.
 */
const SELECT_CLASS =
  "h-11 rounded border border-line-strong bg-surface px-3.5 text-sm text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25";

/**
 * Selettore cliente del wizard, con creazione in linea.
 *
 * Vive in un componente proprio e non dentro `nuova-client.tsx`: quel file è
 * già a 1096 righe, e questa parte è testabile da sola.
 *
 * Il cliente è FACOLTATIVO: «Nessun cliente» è una scelta legittima, non uno
 * stato da cui uscire — copre il cliente occasionale, per cui l'agente scriverà
 * lo sconto a mano sulla richiesta.
 *
 * L'anagrafica nasce VUOTA in produzione (la tabella `customers` non è mai
 * stata scritta da nessuno), quindi il primo che apre questa schermata vede
 * zero clienti: l'empty-state non è un caso limite, è il primo giorno.
 */
export function CustomerPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (customer: CustomerOption | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [nome, setNome] = useState("");
  const [sconto, setSconto] = useState("");
  const [geometria, setGeometria] = useState<ArtechGeometryId | "">("");
  const [entrata, setEntrata] = useState<Entrata | "">("");
  const searchId = useId();
  const nomeId = useId();
  const scontoId = useId();
  const geometriaId = useId();
  const entrataId = useId();

  const utils = api.useUtils();
  const ricerca = search.trim();
  const list = api.customer.list.useQuery(ricerca ? { search: ricerca } : {});
  const create = api.customer.create.useMutation();

  const clienti = list.data ?? [];
  const scontoNum = sconto.trim() === "" ? null : Number(sconto.trim().replace(",", "."));
  const scontoValido =
    scontoNum === null || (Number.isFinite(scontoNum) && scontoNum >= 0 && scontoNum <= 100);

  async function handleCrea() {
    const companyName = nome.trim();
    if (!companyName || !scontoValido) return;
    const creato = await create.mutateAsync({
      companyName,
      ...(scontoNum === null ? {} : { discount: scontoNum }),
      ...(geometria === "" ? {} : { kitGeometry: geometria }),
      ...(entrata === "" ? {} : { kitEntrata: entrata }),
    });
    void utils.customer.list.invalidate();
    setCreating(false);
    setNome("");
    setSconto("");
    setGeometria("");
    setEntrata("");
    onChange(creato);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold text-ink">
        Cliente <span className="font-normal text-ink-subtle">(facoltativo)</span>
      </legend>
      <p className="text-sm text-ink-subtle">
        Sceglierlo applica il suo sconto alla distinta e ti propone il suo profilo serramento al
        passo della geometria. Potrai comunque ritoccare entrambi.
      </p>

      <label htmlFor={searchId} className="sr-only">
        Cerca cliente
      </label>
      <Input
        id={searchId}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cerca per ragione sociale…"
        leadingIcon={<Search className="size-4" aria-hidden />}
      />

      {/* Mobile-first: la lista scorre invece di allungare la pagina
          all'infinito a 375px, e ogni voce è alta abbastanza da colpirla col
          pollice. */}
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "flex min-h-11 items-center gap-2 rounded border px-3 py-2 text-left text-sm transition-colors duration-150 ease-out-quart",
            value === null
              ? "border-brand bg-brand-light text-ink"
              : "border-line text-ink-subtle hover:border-line-strong",
          )}
        >
          <UserRound className="size-4 shrink-0" aria-hidden />
          Nessun cliente
        </button>

        {list.isPending && (
          <span className="h-11 animate-pulse rounded bg-surface-sunken" aria-hidden />
        )}

        {clienti.map((cliente) => (
          <button
            key={cliente.id}
            type="button"
            onClick={() => onChange(cliente)}
            className={cn(
              "flex min-h-11 items-center justify-between gap-2 rounded border px-3 py-2 text-left text-sm transition-colors duration-150 ease-out-quart",
              value === cliente.id
                ? "border-brand bg-brand-light text-ink"
                : "border-line text-ink hover:border-line-strong",
            )}
          >
            <span className="truncate">{cliente.companyName}</span>
            <span className="shrink-0 text-xs text-ink-subtle">
              {cliente.discount === null ? "nessuno sconto" : `−${formatPercent(cliente.discount)}`}
            </span>
          </button>
        ))}

        {/* Due vuoti diversi, due messaggi diversi: «non ho trovato» non è
            «non c'è nessuno», e confonderli manda l'agente a cercare un
            cliente che non è mai esistito. */}
        {!list.isPending && clienti.length === 0 && (
          <p className="px-1 py-2 text-sm text-ink-subtle">
            {ricerca
              ? `Nessun cliente trovato per «${ricerca}».`
              : "Nessun cliente in anagrafica. Creane uno per ricordarti il suo sconto."}
          </p>
        )}
      </div>

      {creating ? (
        <div className="flex flex-col gap-2 rounded border border-line bg-surface-sunken p-3">
          <label htmlFor={nomeId} className="text-sm text-ink-muted">
            Ragione sociale
          </label>
          <Input
            id={nomeId}
            autoFocus
            value={nome}
            onChange={(event) => setNome(event.target.value)}
          />
          <label htmlFor={scontoId} className="text-sm text-ink-muted">
            Sconto % <span className="text-ink-subtle">(facoltativo)</span>
          </label>
          <Input
            id={scontoId}
            inputMode="decimal"
            value={sconto}
            invalid={!scontoValido}
            onChange={(event) => setSconto(event.target.value)}
            placeholder="es. 40"
          />
          {!scontoValido && (
            <p className="text-sm text-danger">Scrivi una percentuale fra 0 e 100.</p>
          )}

          {/* Profilo serramento. `<select>` e non radio: questo riquadro vive
              dentro il wizard, e sette radio a 375px lo farebbero esplodere. Al
              passo 3, dove la scelta È il punto della schermata, restano radio. */}
          <label htmlFor={geometriaId} className="text-sm text-ink-muted">
            Geometria del serramento <span className="text-ink-subtle">(facoltativa)</span>
          </label>
          <select
            id={geometriaId}
            value={geometria}
            onChange={(event) => setGeometria(event.target.value as ArtechGeometryId | "")}
            className={SELECT_CLASS}
          >
            <option value="">Non dichiarata</option>
            {(Object.keys(GEOMETRIE) as ArtechGeometryId[]).map((id) => (
              <option key={id} value={id}>
                {geometriaLabel(id)}
              </option>
            ))}
          </select>

          <label htmlFor={entrataId} className="text-sm text-ink-muted">
            Entrata maniglia <span className="text-ink-subtle">(facoltativa)</span>
          </label>
          <select
            id={entrataId}
            value={entrata}
            onChange={(event) => setEntrata(event.target.value as Entrata | "")}
            className={SELECT_CLASS}
          >
            <option value="">Non dichiarata</option>
            {ENTRATE.map((valore) => (
              <option key={valore} value={valore}>
                Entrata {entrataLabel(valore)}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-subtle">
            Sono le due quote che non cambiano fra un ordine e l&apos;altro di questo cliente. Non
            precompilano nulla: al passo della geometria potrai applicarle con un clic.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!nome.trim() || !scontoValido}
              loading={create.isPending}
              onClick={() => void handleCrea()}
            >
              Crea
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCreating(false)}>
              Annulla
            </Button>
          </div>
          {create.isError && (
            <p role="alert" className="text-sm text-danger">
              {create.error?.message}
            </p>
          )}
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="w-fit" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          Nuovo cliente
        </Button>
      )}
    </fieldset>
  );
}
