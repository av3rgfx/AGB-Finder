"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { api } from "@/trpc/react";
import { formatPercent } from "@/lib/format";
import { GEOMETRIE, geometriaLabel, type ArtechGeometryId } from "@/server/kit/artech-geometrie";
import { ENTRATE, entrataLabel, type Entrata } from "@/server/kit/types";

/**
 * Anagrafica clienti: elenco, **creazione**, modifica, eliminazione.
 *
 * Esiste perché `customer.update` e `customer.delete` vivevano nel router dal
 * 2026-07-30 **senza essere raggiungibili da nessuna schermata**: un cliente,
 * una volta creato dal selettore del wizard, non era più correggibile.
 *
 * La creazione è arrivata subito dopo (PR #45): la prima versione della pagina
 * la ometteva, e con l'anagrafica vuota — che è lo stato del primo giorno —
 * l'unico modo di aggiungere un cliente era iniziare una richiesta kit e poi
 * abbandonarla. Una pagina «Clienti» da cui non si creano clienti.
 *
 * Nessun gate ADMIN: l'anagrafica è **condivisa** fra gli agenti e il router usa
 * `agentProcedure`. Metterlo qui contraddirebbe il router e nasconderebbe una
 * funzione che il server concede comunque.
 */
type ClienteRiga = {
  id: string;
  companyName: string;
  discount: number | null;
  kitGeometry: ArtechGeometryId | null;
  kitEntrata: Entrata | null;
};

/** Il profilo in una riga di testo, o la ragione per cui non c'è. */
function profiloLabel(c: ClienteRiga): string {
  const parti = [
    c.kitGeometry === null ? null : geometriaLabel(c.kitGeometry),
    c.kitEntrata === null ? null : `Entrata ${entrataLabel(c.kitEntrata)}`,
  ].filter((v) => v !== null);
  return parti.length === 0 ? "Nessun profilo" : parti.join(" · ");
}

/**
 * Modalità del form: `null` = creazione, una riga = modifica.
 *
 * Un solo componente per entrambi i casi. Non è un'astrazione preventiva: i due
 * form hanno gli stessi quattro campi e le stesse regole di validazione, e
 * tenerli separati significherebbe correggere due volte ogni etichetta. La sola
 * differenza vera — `optional` in creazione contro `nullable` in modifica — vive
 * in tre righe di `salva()`, ed è documentata lì.
 */
type ModoForm = { tipo: "crea" } | { tipo: "modifica"; cliente: ClienteRiga };

export function ClientiClient() {
  const clienti = api.customer.list.useQuery({});
  const [form, setForm] = useState<ModoForm | null>(null);

  if (clienti.isPending) return <p className="text-sm text-ink-subtle">Caricamento…</p>;
  if (clienti.isError)
    return (
      <p
        role="alert"
        className="rounded border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
      >
        Errore nel caricamento dei clienti.
      </p>
    );

  const righe = clienti.data as ClienteRiga[];

  const chiudi = () => setForm(null);
  const salvato = () => {
    setForm(null);
    void clienti.refetch();
  };

  const pulsanteNuovo = (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => setForm({ tipo: "crea" })}
        className="h-11 rounded bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
      >
        Nuovo cliente
      </button>
    </div>
  );

  // Il vuoto è lo stato del PRIMO GIORNO, non un caso limite: in produzione
  // `customers` nasce vuota. Ed è proprio lì che il pulsante deve esserci,
  // altrimenti la pagina è un vicolo cieco — fino alla #44 per creare un cliente
  // bisognava iniziare una richiesta kit e poi abbandonarla.
  if (righe.length === 0)
    return (
      <div className="flex flex-col gap-4">
        {pulsanteNuovo}
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-subtle">
          Nessun cliente in anagrafica. Creane uno con il pulsante qui sopra, oppure al volo dal
          selettore cliente quando apri una <span className="text-ink">nuova richiesta kit</span>.
        </p>
        {form && <ClienteForm modo={form} onClose={chiudi} onSaved={salvato} />}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {pulsanteNuovo}

      {/* Mobile-first: la tabella scorre invece di comprimere le colonne a
          375px, e il menu azioni è `fixed` per non farsi ritagliare dallo
          scorrimento (difetto già corretto su /utenti dalla PR #18). */}
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-ink-subtle">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Cliente
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Sconto
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Profilo serramento
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody>
            {righe.map((c) => (
              <ClienteRow
                key={c.id}
                cliente={c}
                onEdit={() => setForm({ tipo: "modifica", cliente: c })}
                onChanged={() => void clienti.refetch()}
              />
            ))}
          </tbody>
        </table>
      </div>

      {form && <ClienteForm modo={form} onClose={chiudi} onSaved={salvato} />}
    </div>
  );
}

function ClienteRow({
  cliente,
  onEdit,
  onChanged,
}: {
  cliente: ClienteRiga;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const del = api.customer.delete.useMutation({ onSuccess: onChanged });

  async function elimina() {
    if (!confirm(`Eliminare ${cliente.companyName}?`)) return;
    setErrore(null);
    try {
      await del.mutateAsync({ id: cliente.id });
    } catch (e) {
      // Il messaggio viene dal server («Cliente con N richieste collegate»):
      // mostrarlo, non sostituirlo con un generico. È l'unica cosa che dice
      // all'agente PERCHÉ non si può.
      setErrore(e instanceof Error ? e.message : "Impossibile eliminare il cliente.");
    }
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-3 py-2 text-ink">{cliente.companyName}</td>
      <td className="px-3 py-2 text-ink-muted">
        {cliente.discount === null ? (
          <span className="text-ink-subtle">nessuno</span>
        ) : (
          `−${formatPercent(cliente.discount)}`
        )}
      </td>
      <td className="px-3 py-2 text-ink-muted">
        {cliente.kitGeometry === null && cliente.kitEntrata === null ? (
          <span className="text-ink-subtle">{profiloLabel(cliente)}</span>
        ) : (
          profiloLabel(cliente)
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <RowActions onEdit={onEdit} onDelete={() => void elimina()} />
        {errore && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {errore}
          </p>
        )}
      </td>
    </tr>
  );
}

/**
 * Menu azioni per riga (⋯). `position: fixed` posizionato dal rect del bottone,
 * perché la tabella è in `overflow-x-auto` e ritaglierebbe un dropdown
 * `absolute`. Si chiude su scroll/resize/Esc/click-fuori. Stessa forma di
 * `/utenti`, con due sole voci.
 */
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (open) return setOpen(false);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "block w-full rounded px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-sunken";
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="inline-block text-left">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Azioni cliente"
        className="grid size-8 place-items-center rounded border border-line-strong text-ink-muted transition-colors hover:border-brand hover:text-brand"
      >
        <MoreVertical className="size-4" aria-hidden />
      </button>
      {open && pos && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-40 w-44 rounded-md border border-line bg-surface p-1 shadow-pop"
          >
            <button type="button" role="menuitem" onClick={run(onEdit)} className={item}>
              Modifica
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={run(onDelete)}
              className={`${item} text-danger hover:bg-danger/5`}
            >
              Elimina
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const FIELD =
  "h-11 rounded border border-line-strong bg-surface px-3.5 text-sm text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25";

function ClienteForm({
  modo,
  onClose,
  onSaved,
}: {
  modo: ModoForm;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cliente = modo.tipo === "modifica" ? modo.cliente : null;

  const [nome, setNome] = useState(cliente?.companyName ?? "");
  // Virgola, non punto: `String(42.5)` dà «42.5» in una UI italiana che due
  // righe sopra, nella tabella, scrive «−42,5%». Il parse accetta entrambi
  // (`replace(",", ".")`), quindi qui si sceglie la forma che l'agente legge.
  const [sconto, setSconto] = useState(
    cliente == null || cliente.discount === null ? "" : String(cliente.discount).replace(".", ","),
  );
  const [geometria, setGeometria] = useState<ArtechGeometryId | "">(cliente?.kitGeometry ?? "");
  const [entrata, setEntrata] = useState<Entrata | "">(cliente?.kitEntrata ?? "");
  const [errore, setErrore] = useState<string | null>(null);
  const create = api.customer.create.useMutation();
  const update = api.customer.update.useMutation();

  const nomeId = useId();
  const scontoId = useId();
  const geometriaId = useId();
  const entrataId = useId();

  const scontoNum = sconto.trim() === "" ? null : Number(sconto.trim().replace(",", "."));
  const scontoValido =
    scontoNum === null || (Number.isFinite(scontoNum) && scontoNum >= 0 && scontoNum <= 100);

  async function salva() {
    if (!nome.trim() || !scontoValido) return;
    setErrore(null);
    try {
      if (cliente === null) {
        // CREAZIONE: i campi facoltativi si OMETTONO, non si mandano a `null`.
        // `customer.create` li dichiara `.optional()` (non `.nullable()`),
        // perché in creazione «vuoto» significa «non specificato» e basta.
        await create.mutateAsync({
          companyName: nome.trim(),
          ...(scontoNum === null ? {} : { discount: scontoNum }),
          ...(geometria === "" ? {} : { kitGeometry: geometria }),
          ...(entrata === "" ? {} : { kitEntrata: entrata }),
        });
      } else {
        // MODIFICA: `null` e non `undefined` quando il campo è vuoto — qui si
        // STA dichiarando che il cliente non ha profilo, che è diverso dal non
        // toccarlo. È la distinzione che il router rispetta.
        await update.mutateAsync({
          id: cliente.id,
          companyName: nome.trim(),
          discount: scontoNum,
          kitGeometry: geometria === "" ? null : geometria,
          kitEntrata: entrata === "" ? null : entrata,
        });
      }
      onSaved();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Impossibile salvare il cliente.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-sunken p-4">
      <h2 className="text-sm font-semibold text-ink">
        {cliente === null ? "Nuovo cliente" : `Modifica ${cliente.companyName}`}
      </h2>

      <label htmlFor={nomeId} className="text-sm text-ink-muted">
        Ragione sociale
      </label>
      <input id={nomeId} value={nome} onChange={(e) => setNome(e.target.value)} className={FIELD} />

      <label htmlFor={scontoId} className="text-sm text-ink-muted">
        Sconto % <span className="text-ink-subtle">(vuoto = nessuno)</span>
      </label>
      <input
        id={scontoId}
        inputMode="decimal"
        value={sconto}
        onChange={(e) => setSconto(e.target.value)}
        className={FIELD}
      />
      {!scontoValido && <p className="text-sm text-danger">Scrivi una percentuale fra 0 e 100.</p>}

      <label htmlFor={geometriaId} className="text-sm text-ink-muted">
        Geometria del serramento
      </label>
      <select
        id={geometriaId}
        value={geometria}
        onChange={(e) => setGeometria(e.target.value as ArtechGeometryId | "")}
        className={FIELD}
      >
        <option value="">Non dichiarata</option>
        {(Object.keys(GEOMETRIE) as ArtechGeometryId[]).map((id) => (
          <option key={id} value={id}>
            {geometriaLabel(id)}
          </option>
        ))}
      </select>

      <label htmlFor={entrataId} className="text-sm text-ink-muted">
        Entrata maniglia
      </label>
      <select
        id={entrataId}
        value={entrata}
        onChange={(e) => setEntrata(e.target.value as Entrata | "")}
        className={FIELD}
      >
        <option value="">Non dichiarata</option>
        {ENTRATE.map((v) => (
          <option key={v} value={v}>
            Entrata {entrataLabel(v)}
          </option>
        ))}
      </select>

      <p className="text-xs text-ink-subtle">
        Il profilo non precompila nulla: nel wizard si applica con un clic, e resta modificabile per
        quella singola richiesta.
      </p>

      {/* Mobile-first: i due bottoni a riga intera sotto sm. */}
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void salva()}
          disabled={!nome.trim() || !scontoValido || create.isPending || update.isPending}
          className="h-11 rounded bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {cliente === null ? "Crea" : "Salva"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded border border-line-strong px-4 text-sm text-ink hover:border-brand"
        >
          Annulla
        </button>
      </div>

      {errore && (
        <p role="alert" className="text-sm text-danger">
          {errore}
        </p>
      )}
    </div>
  );
}
