"use client";

/**
 * Il passo «Componenti» del wizard: le scelte che il listino AGB lascia aperte
 * (squadra angolare, incontro ribalta, movimento angolare, incontri nottolino,
 * piastrino antieffrazione), con codice, nome a catalogo, prezzo e differenza
 * rispetto allo standard davanti.
 *
 * Vive QUI e non dentro `nuova-client.tsx` perché dal 2026-08-01 lo montano in
 * DUE contesti: la creazione e la **modifica** di una richiesta già emessa
 * (`/richieste/nuova?da=<id>`). Lasciarlo nel file del wizard avrebbe
 * significato importare il wizard da sé stesso. Era anche debito già dichiarato
 * dalla #47: `nuova-client.tsx` era a ~1.980 righe, di cui ~600 erano questo
 * passo e i suoi aiutanti.
 *
 * La firma è deliberatamente **senza tipi del form**: prende geometria, entrata,
 * mano e varianti, e restituisce varianti. Non sa nulla di wizard, di passi né
 * di richieste — è quel che gli permette di essere montato due volte.
 */

import { useId, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { api } from "@/trpc/react";
import { entrataLabel, type ArtechKitInput, type Entrata } from "@/server/kit/types";
import type { ArtechGeometryId } from "@/server/kit/artech-geometrie";
import { componiVarianti, type Varianti } from "@/server/kit/varianti-schema";
import {
  avvisiVarianti,
  eAntieffrazione,
  incontroNottolinoEtichettaSeNonStandard,
  incontroNottolinoVariante,
  incontroRibaltaEtichettaSeNonStandard,
  incontroRibaltaVariante,
  movimentoAngolareCodice,
  movimentoAngolareEtichettaSeNonStandard,
  opzioniIncontroNottolino,
  opzioniIncontroRibalta,
  opzioniSquadraAngolare,
  piastrinoCodice,
  scelteNonStandard,
  squadraAngolare,
  squadraAngolareEtichettaSeNonStandard,
  COMPONENTE_LABEL,
  MOVIMENTO_ANGOLARE_LABEL,
  type MovimentoAngolareId,
} from "@/server/kit/artech-varianti";
import { Button } from "@/components/ui/button";
import { RadioOption } from "@/components/kit/radio-option";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

/**
 * Quante delle TRE scelte che compongono l'antieffrazione sono attive.
 * (movimento angolare a due nottolini · incontro nottolino antieffrazione ·
 * piastrino). Le altre due varianti non c'entrano: sono scelte di montaggio.
 */
function contaAntieffrazione(v: Varianti | undefined): number {
  if (v === undefined) return 0;
  return (
    (v.movimentoAngolare === "DUE_NOTTOLINI" ? 1 : 0) +
    (eAntieffrazione(v.incontroNottolino) ? 1 : 0) +
    (v.piastrinoAntieffrazione === true ? 1 : 0)
  );
}

/**
 * Stato dell'interruttore «Antieffrazione», **derivato** dalle tre scelte.
 *
 * L'interruttore NON è salvato (spec §7): la verità persistita sono le tre
 * scelte indipendenti. Se lo stato fosse salvato accanto ad esse, i due dati
 * potrebbero contraddirsi alla rigenerazione — la classe di difetto che questa
 * feature esiste per chiudere. `PARZIALE` non è un ripiego: è ciò che i dati
 * dicono quando l'agente ordina un solo componente, e la UI deve avere una
 * parola per dirlo invece di mostrare un interruttore che mente.
 */
export function statoAntieffrazione(v: Varianti | undefined): "SPENTO" | "PARZIALE" | "ACCESO" {
  const attive = contaAntieffrazione(v);
  return attive === 0 ? "SPENTO" : attive === 3 ? "ACCESO" : "PARZIALE";
}

/**
 * La nota sullo standard, detta **una volta sola** in testa al passo. È la
 * formula già adottata dalla PR #44 per il profilo cliente, e dice la verità: le
 * distinte reali di MC, Peruzzi e Fosca non sono mai arrivate, quindi «quello
 * che ordiniamo oggi» sarebbe un'affermazione sull'azienda che il programma non
 * può fare.
 *
 * Stava dentro OGNI `GruppoVarianti` e dentro la fieldset Sicurezza: con i due
 * pannelli aperti erano **sei copie** della stessa frase, e a 375px un muro di
 * testo che nasconde proprio i codici e i prezzi per cui la schermata esiste.
 * Nei gruppi resta il solo distintivo «standard» sull'opzione, che è il legame
 * riga-per-riga; questa frase spiega, una volta, cosa quel distintivo afferma.
 * Non lo NOMINA: la fieldset «Sicurezza» non porta distintivi, e dire «è
 * l'opzione col distintivo standard» sarebbe falso proprio lì.
 */
const NOTA_STANDARD =
  "Tutto è già impostato su ciò che il programma ordina oggi. Mai confrontato con un ordine vero.";

/** `+0,49 €` / `−4,06 €`. Segno meno tipografico, come nel riepilogo sconto. */
function formatDelta(delta: number): string {
  return `${delta < 0 ? "−" : "+"}${formatPrice(Math.abs(delta))}`;
}

/**
 * I TRE stati della query dei prezzi, tenuti distinti.
 *
 * «Non a catalogo» è un'AFFERMAZIONE SUL LISTINO AGB — è la stessa classe di
 * segnale che ha smascherato due moduli con codici inesistenti. Dirla mentre la
 * query carica (cioè sempre, al primo render) o quando è fallita significa
 * affermare un fatto che non si conosce: in una schermata che esiste per togliere
 * le decisioni silenziose sarebbe una decisione silenziosa.
 */
type StatoPrezzi = "CARICAMENTO" | "ERRORE" | "PRONTO";

/** Nessuna delle tre frasi vale per gli altri due stati. */
function etichettaPrezzo(stato: StatoPrezzi, prezzo: number | undefined): string {
  if (stato === "CARICAMENTO") return "prezzo in caricamento…";
  if (stato === "ERRORE") return "prezzo non caricato";
  return prezzo === undefined ? "prezzo non a catalogo" : formatPrice(prezzo);
}

/** Il Δ ha gli stessi tre stati del prezzo da cui si calcola. */
function etichettaDelta(stato: StatoPrezzi, delta: number | undefined): string {
  if (stato === "CARICAMENTO") return "in caricamento…";
  if (stato === "ERRORE") return "non caricato";
  return delta === undefined ? "—" : formatDelta(delta);
}

type OpzioneVariante<T extends string> = { id: T; label: string; code: string | null };
type GruppoOpzioni<T extends string> = { opzioni: OpzioneVariante<T>[]; standardId: T };

/**
 * Un gruppo di opzioni pronto per la UI, costruito interrogando il registro.
 *
 * Lo STANDARD non è scritto qui: è **il codice che il motore emette senza
 * scelta** (`code(undefined)`), e l'opzione che lo produce È l'opzione standard.
 * Così il distintivo «standard» e la base dei Δ non possono divergere dai
 * default del registro — che sono gli stessi che tengono fermo il golden.
 *
 * `null` quando non c'è una scelta da fare (meno di due opzioni): una variante
 * con una sola opzione non è una scelta, e mostrarla sarebbe un campo finto.
 */
function costruisciGruppo<T extends string>(
  opzioni: { id: T; label: string }[],
  code: (scelta: T | undefined) => string,
): GruppoOpzioni<T> | null {
  if (opzioni.length < 2) return null;
  const standardCode = code(undefined);
  const conCodice = opzioni.map((o) => ({ ...o, code: code(o.id) }));
  const standard = conCodice.find((o) => o.code === standardCode);
  // Irraggiungibile: il default del registro è sempre una delle opzioni della
  // stessa tabella. Se un domani non lo fosse, meglio niente gruppo che un
  // gruppo con un distintivo «standard» su nessuna riga.
  return standard === undefined ? null : { opzioni: conCodice, standardId: standard.id };
}

/**
 * Un gruppo di radio con codice, prezzo e Δ. Generico sull'id della variante: i
 * cinque gruppi hanno enum diversi e nessuno di essi passa da un cast.
 *
 * Scegliere l'opzione standard scrive `undefined`, non il suo id: il default
 * vive nel registro e non si materializza nel dato persistito (così il giorno in
 * cui cambia, cambia per tutti, e il ricalcolo versionato resta l'unico modo di
 * spostare una distinta già emessa).
 */
function GruppoVarianti<T extends string>({
  name,
  legend,
  opzioni,
  standardId,
  scelto,
  voce,
  stato,
  onChange,
}: {
  name: string;
  legend: string;
  opzioni: OpzioneVariante<T>[];
  standardId: T;
  scelto: T | undefined;
  voce: (code: string) => { name: string; price: number } | undefined;
  stato: StatoPrezzi;
  onChange: (id: T | undefined) => void;
}) {
  const prezzoDi = (o: OpzioneVariante<T> | undefined) =>
    o === undefined ? undefined : o.code === null ? 0 : voce(o.code)?.price;
  const base = prezzoDi(opzioni.find((o) => o.id === standardId));
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      {/* Mobile-first: una colonna sotto sm — codice, prezzo e Δ stanno sulla
          stessa riga dell'hint e a 375px vogliono la larghezza intera. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {opzioni.map((o) => {
          const p = prezzoDi(o);
          const delta = p === undefined || base === undefined ? undefined : p - base;
          // Un'opzione SENZA codice («Senza piastrino») non ha un prezzo che
          // possa caricare o fallire: vale zero per costruzione, e nessuna
          // risposta del catalogo lo cambierà. Lo stato della query non la
          // riguarda — dirle «prezzo in caricamento…» sarebbe affermare un
          // fatto falso, cioè esattamente ciò che i tre stati esistono per
          // impedire. L'assenza di codice vince sullo stato.
          const statoDi: StatoPrezzi = o.code === null ? "PRONTO" : stato;
          // Il nome a CATALOGO del codice — non l'etichetta che gli diamo noi. È
          // l'unico modo di verificare, senza uscire dalla schermata, che il
          // codice sia quello giusto: perciò è TESTO e non più un `title`, che a
          // touch (cioè proprio a ≤375px) e da tastiera non esiste.
          const nome = o.code === null ? undefined : voce(o.code)?.name;
          return (
            <RadioOption
              key={o.id}
              name={name}
              label={o.label}
              hint={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {o.code !== null && <span className="font-mono text-ink-muted">{o.code}</span>}
                  <span>{etichettaPrezzo(statoDi, p)}</span>
                  {delta !== undefined && delta !== 0 && (
                    <span className="font-medium text-ink">{formatDelta(delta)}</span>
                  )}
                  {o.id === standardId && (
                    <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-ink-subtle">
                      standard
                    </span>
                  )}
                  {/* `basis-full`: riga propria, così a 375px il nome lungo va a
                      capo sotto e non spinge fuori schermo codice e prezzo. */}
                  {nome !== undefined && <span className="basis-full break-words">{nome}</span>}
                </span>
              }
              checked={(scelto ?? standardId) === o.id}
              onChange={() => onChange(o.id === standardId ? undefined : o.id)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

type Cambio = { componente: string; da: string | null; a: string; delta: number | undefined };

/**
 * Cosa cambia rispetto allo standard, per un gruppo e la scelta corrente.
 * `null` quando non cambia nulla — è la stessa nozione di «non standard» che il
 * motore usa per dichiarare la variante nella descrizione di riga.
 */
function cambioDi<T extends string>(
  gruppo: GruppoOpzioni<T> | null,
  scelto: T | undefined,
  componente: string,
  prezzo: (code: string) => number | undefined,
): Cambio | null {
  if (gruppo === null || scelto === undefined || scelto === gruppo.standardId) return null;
  const nuovo = gruppo.opzioni.find((o) => o.id === scelto);
  const vecchio = gruppo.opzioni.find((o) => o.id === gruppo.standardId);
  if (nuovo === undefined || nuovo.code === null || vecchio === undefined) return null;
  const prezzoNuovo = prezzo(nuovo.code);
  // Il piastrino non sostituisce nulla: è una riga AGGIUNTA, quindi la base è 0.
  const prezzoVecchio = vecchio.code === null ? 0 : prezzo(vecchio.code);
  return {
    componente,
    da: vecchio.code,
    a: nuovo.code,
    delta:
      prezzoNuovo === undefined || prezzoVecchio === undefined
        ? undefined
        : prezzoNuovo - prezzoVecchio,
  };
}

/**
 * «Cosa cambia»: un pezzo per riga, etichetta sopra e valori sotto.
 *
 * **NON una tabella**, di proposito: a 375px una tabella scorre in orizzontale e
 * porta fuori schermo proprio i numeri — è già successo in questo progetto (PR
 * #42, i totali della distinta finirono fuori vista e dovettero migrare nel
 * riepilogo).
 *
 * I Δ sono UNITARI perché unitari sono i prezzi di listino, e le quantità le
 * decide la distinta (il movimento angolare è 2, gli incontri nottolino sono
 * cinque sul golden): dirlo è l'unico modo di mostrare un totale senza mentire.
 */
function CosaCambia({ cambi, stato }: { cambi: Cambio[]; stato: StatoPrezzi }) {
  const totale = cambi.some((c) => c.delta === undefined)
    ? undefined
    : cambi.reduce((somma, c) => somma + (c.delta ?? 0), 0);
  return (
    // `data-testid` e non `role="group"`: il blocco non è interattivo e non
    // raggruppa controlli, quindi il ruolo era semantica falsa aggiunta per
    // rendere il blocco interrogabile dai test. Se serve solo ai test, si usa un
    // aggancio che i lettori di schermo non vedono affatto.
    <div data-testid="cosa-cambia" className="rounded-md bg-surface-sunken p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        Cosa cambia
      </p>
      <ul className="flex flex-col gap-2">
        {cambi.map((c) => (
          <li key={c.componente} className="flex flex-col gap-0.5">
            <span className="text-sm text-ink">{c.componente}</span>
            <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
              {c.da === null ? (
                <span>riga aggiunta:</span>
              ) : (
                <>
                  <span className="font-mono">{c.da}</span>
                  <span aria-hidden>→</span>
                </>
              )}
              <span className="font-mono text-ink">{c.a}</span>
              {c.delta !== undefined && (
                <span className="font-medium text-ink">{formatDelta(c.delta)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {/* La frase sta SOPRA il numero: sotto la si leggeva dopo aver già
          frainteso. E nomina tutte e due le quantità in gioco, non solo una. */}
      <p className="mt-2 border-t border-line-strong pt-2 text-xs text-ink-subtle">
        Prezzi unitari di listino: nella distinta le quantità li moltiplicano — il movimento
        angolare è 2, gli incontri nottolino sono più d&apos;uno.
      </p>
      <p className="mt-1 flex items-baseline justify-between gap-3 text-sm">
        {/* «Δ totale a pezzo» si contraddiceva: «totale» e «a pezzo» insieme. */}
        <span className="text-ink-subtle">Differenza per pezzo</span>
        <span className="font-semibold tabular-nums text-ink">{etichettaDelta(stato, totale)}</span>
      </p>
    </div>
  );
}

export function ComponentiRibalta({
  geometry,
  entrata,
  mano,
  varianti,
  onChange,
}: {
  geometry: ArtechGeometryId;
  entrata: Entrata;
  mano: ArtechKitInput["openingSide"];
  varianti: Varianti | undefined;
  onChange: (v: Varianti | undefined) => void;
}) {
  const gruppi = useMemo(() => {
    const squadra = costruisciGruppo(opzioniSquadraAngolare(geometry), (s) =>
      squadraAngolare(geometry, mano, s),
    );
    const ribalta = costruisciGruppo(opzioniIncontroRibalta(geometry), (s) =>
      incontroRibaltaVariante(geometry, mano, s),
    );
    const nottolino = costruisciGruppo(opzioniIncontroNottolino(geometry), (s) =>
      incontroNottolinoVariante(geometry, mano, s),
    );
    const movimento = costruisciGruppo(
      (Object.keys(MOVIMENTO_ANGOLARE_LABEL) as MovimentoAngolareId[]).map((id) => ({
        id,
        label: MOVIMENTO_ANGOLARE_LABEL[id],
      })),
      movimentoAngolareCodice,
    );
    // Il piastrino è l'eccezione dichiarata (spec §2): non sostituisce un
    // codice, AGGIUNGE una riga. Sta qui perché l'agente lo sceglie nella stessa
    // schermata, e l'opzione standard non ha codice — il suo Δ è il prezzo pieno.
    const piastrino: GruppoOpzioni<"NO" | "SI"> = {
      standardId: "NO",
      opzioni: [
        { id: "NO", label: "Senza piastrino", code: null },
        { id: "SI", label: "Con piastrino antieffrazione", code: piastrinoCodice(entrata) },
      ],
    };
    return { squadra, ribalta, nottolino, movimento, piastrino };
  }, [geometry, mano, entrata]);

  // UNA sola query per tutti i codici mostrabili: `getByCode` chiamata dodici
  // volte sarebbe dodici round-trip, e i prezzi cablati nella UI divergerebbero
  // dal catalogo al primo aggiornamento del listino.
  const codici = useMemo(() => {
    // Ciclo esplicito e non `flatMap`: i cinque gruppi hanno enum diversi, e su
    // un'unione di array TypeScript non sa più quale sia l'elemento.
    const codes: string[] = [];
    for (const gruppo of Object.values(gruppi))
      for (const opzione of gruppo?.opzioni ?? [])
        if (opzione.code !== null) codes.push(opzione.code);
    return [...new Set(codes)];
  }, [gruppi]);
  const catalogo = api.product.byCodes.useQuery({ codes: codici });
  const voce = (code: string) => catalogo.data?.[code];
  const prezzo = (code: string) => voce(code)?.price;
  // `data` in mano = prezzi noti, e allora è irrilevante che un refetch in
  // sottofondo sia fallito: il numero a schermo resta quello del catalogo. Solo
  // quando non c'è nulla si distingue «sto caricando» da «è andata male».
  //
  // `isError` si LEGGE, non si deduce da «non pending»: l'errore è l'unico dei
  // tre stati che accusa qualcuno (la rete, il server), e va affermato solo
  // quando la query lo dichiara. Dedurlo per esclusione lo faceva comparire su
  // ogni stato futuro che non fosse né dati né pending — il giorno in cui
  // qualcuno aggiungesse `enabled:` a questa query, una query disabilitata (che
  // per react-query è `isPending: true` a tempo indeterminato) o un `idle`
  // qualsiasi avrebbero mostrato un allarme di rete che nessuno ha visto.
  const statoPrezzi: StatoPrezzi =
    catalogo.data !== undefined ? "PRONTO" : catalogo.isError ? "ERRORE" : "CARICAMENTO";

  const stato = statoAntieffrazione(varianti);
  const attive = contaAntieffrazione(varianti);

  // Le voci fuori standard fra le «altre varianti», dalla STESSA funzione che il
  // motore usa per dichiararle nella distinta e che il riepilogo usa per
  // elencarle: un `!== undefined` scritto qui sarebbe una seconda nozione di
  // «modificata», e infatti diceva «Modificate: Squadra angolare» su una scelta
  // che portava a schermo il distintivo «standard».
  const fuoriStandardAltre = scelteNonStandard(geometry, varianti)
    .filter(
      (s) =>
        s.componente === COMPONENTE_LABEL.squadraAngolare ||
        s.componente === COMPONENTE_LABEL.incontroRibalta,
    )
    .map((s) => s.componente);

  // Aperte se c'è già qualcosa fuori standard: una scelta non standard non deve
  // MAI stare dietro un pannello chiuso (è il motivo per cui la sicurezza è
  // sempre visibile).
  const [modifica, setModifica] = useState(stato === "PARZIALE");
  const [altre, setAltre] = useState(fuoriStandardAltre.length > 0);
  // `aria-controls`: i due toggle dichiarano `aria-expanded`, e senza il
  // riferimento al pannello non si sa COSA espandano.
  const idTreScelte = useId();
  const idAltreVarianti = useId();

  const set = (patch: Partial<Varianti>) => onChange(componiVarianti({ ...varianti, ...patch }));

  /** L'interruttore imposta tutte e tre le sotto-scelte insieme; non è salvato. */
  const accendi = () =>
    set({
      movimentoAngolare: "DUE_NOTTOLINI",
      // La famiglia antieffrazione disponibile per QUESTA geometria: in aria 4
      // le viti dritte non esistono, quindi si prende la prima che il registro
      // pubblica invece di cablarne una. La categoria la dichiara il registro
      // (`eAntieffrazione`), non la forma del nome.
      incontroNottolino: gruppi.nottolino?.opzioni.find((o) => eAntieffrazione(o.id))?.id,
      piastrinoAntieffrazione: true,
    });
  const spegni = () =>
    set({
      movimentoAngolare: undefined,
      incontroNottolino: undefined,
      piastrinoAntieffrazione: undefined,
    });

  const cambi = [
    cambioDi(
      gruppi.movimento,
      varianti?.movimentoAngolare,
      COMPONENTE_LABEL.movimentoAngolare,
      prezzo,
    ),
    cambioDi(
      gruppi.nottolino,
      varianti?.incontroNottolino,
      COMPONENTE_LABEL.incontroNottolino,
      prezzo,
    ),
    cambioDi(
      gruppi.piastrino,
      varianti?.piastrinoAntieffrazione === true ? "SI" : undefined,
      COMPONENTE_LABEL.piastrinoAntieffrazione,
      prezzo,
    ),
  ].filter((c): c is Cambio => c !== null);

  // La STESSA funzione pura che il motore usa per i warning della distinta: UI e
  // distinta non possono dire cose diverse. Avviso, mai blocco (spec §8).
  const avvisi = avvisiVarianti(varianti);

  return (
    <div className="flex flex-col gap-6">
      {/* La nota sullo standard vale per TUTTI i gruppi di questo passo e si
          dice QUI, una volta: ripetuta in ognuno erano sei copie della stessa
          frase, e a 375px un muro davanti a codici e prezzi. */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">
          Le scelte che il listino lascia aperte. Se il serramento è quello di sempre non c&apos;è
          nulla da toccare: si va avanti.
        </p>
        <p className="text-xs text-ink-subtle">{NOTA_STANDARD}</p>
      </div>

      {/* Errore della query, non del listino: senza dirlo, «prezzo non a
          catalogo» sarebbe un'affermazione su AGB fondata su un timeout. */}
      {statoPrezzi === "ERRORE" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-ink"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <span>
            Prezzi e differenze non caricati: è un problema di rete o del server, non del catalogo
            AGB. I codici qui sotto restano quelli giusti, e la distinta ricalcola i prezzi dal
            catalogo quando la generi.
          </span>
        </p>
      )}

      {/* ZONA A — SICUREZZA, sempre visibile. È la ragione per cui questa
          schermata esiste: dentro un pannello chiuso non la troverebbe nessuno. */}
      <div className="flex flex-col gap-3">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Sicurezza</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <RadioOption
              name="sicurezza"
              label="Normale"
              hint="I codici standard, senza componenti antieffrazione."
              checked={stato === "SPENTO"}
              onChange={spegni}
            />
            <RadioOption
              name="sicurezza"
              label="Antieffrazione"
              hint="Movimento angolare a due nottolini, incontri antieffrazione e piastrino."
              checked={stato === "ACCESO"}
              onChange={accendi}
            />
          </div>
        </fieldset>

        {/* Lo stato dell'interruttore si DERIVA dalle tre scelte e non è
            salvato: quando sono in parte attive non esiste una casella giusta da
            spuntare, e dirlo è meglio che spuntarne una che mente. */}
        {stato === "PARZIALE" && (
          <p role="status" className="text-xs text-ink-muted">
            Antieffrazione parziale — {attive} di 3 scelte. Va bene se stai ordinando un solo
            componente; altrimenti scegli «Antieffrazione» qui sopra.
          </p>
        )}

        {cambi.length > 0 && <CosaCambia cambi={cambi} stato={statoPrezzi} />}

        {avvisi.map((avviso) => (
          <p
            key={avviso}
            // `alert` e non `status`: nasce da un DIVIETO stampato sul listino,
            // ed è la stessa classe degli errori di passo di questa schermata.
            role="alert"
            className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>{avviso}</span>
          </p>
        ))}

        {/* «Ogni tanto capita di ordinare solo un componente»: le tre scelte
            restano indipendenti, l'interruttore è solo la scorciatoia. */}
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          aria-expanded={modifica}
          aria-controls={idTreScelte}
          onClick={() => setModifica((m) => !m)}
        >
          {modifica ? "Nascondi le tre scelte" : "Modifica le tre scelte"}
        </Button>

        {modifica && (
          <div id={idTreScelte} className="flex flex-col gap-6">
            {gruppi.movimento && (
              <GruppoVarianti
                name="movimentoAngolare"
                legend={COMPONENTE_LABEL.movimentoAngolare}
                opzioni={gruppi.movimento.opzioni}
                standardId={gruppi.movimento.standardId}
                scelto={varianti?.movimentoAngolare}
                voce={voce}
                stato={statoPrezzi}
                onChange={(id) => set({ movimentoAngolare: id })}
              />
            )}
            {gruppi.nottolino && (
              <GruppoVarianti
                name="incontroNottolino"
                legend={COMPONENTE_LABEL.incontroNottolino}
                opzioni={gruppi.nottolino.opzioni}
                standardId={gruppi.nottolino.standardId}
                scelto={varianti?.incontroNottolino}
                voce={voce}
                stato={statoPrezzi}
                onChange={(id) => set({ incontroNottolino: id })}
              />
            )}
            <GruppoVarianti
              name="piastrinoAntieffrazione"
              legend={COMPONENTE_LABEL.piastrinoAntieffrazione}
              opzioni={gruppi.piastrino.opzioni}
              standardId={gruppi.piastrino.standardId}
              scelto={varianti?.piastrinoAntieffrazione === true ? "SI" : undefined}
              voce={voce}
              stato={statoPrezzi}
              onChange={(id) => set({ piastrinoAntieffrazione: id === "SI" ? true : undefined })}
            />
          </div>
        )}
      </div>

      {/* ZONA B — le varianti di montaggio, chiuse: non è quello che si viene a
          cercare qui, e sei gruppi aperti a 375px sono un muro. */}
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <button
          type="button"
          aria-expanded={altre}
          aria-controls={idAltreVarianti}
          onClick={() => setAltre((a) => !a)}
          className="flex items-center justify-between gap-3 rounded text-left text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span>
            Altre varianti{" "}
            <span className="font-normal text-ink-subtle">· {altre ? "nascondi" : "modifica"}</span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-ink-subtle transition-transform",
              altre && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <p className="text-xs text-ink-subtle">
          {fuoriStandardAltre.length > 0
            ? `Modificate: ${fuoriStandardAltre.join(" · ")}.`
            : "Squadra angolare e incontro ribalta: standard."}
        </p>
        {altre && (
          <div id={idAltreVarianti} className="flex flex-col gap-6">
            {gruppi.squadra && (
              <GruppoVarianti
                name="squadraAngolare"
                legend={COMPONENTE_LABEL.squadraAngolare}
                opzioni={gruppi.squadra.opzioni}
                standardId={gruppi.squadra.standardId}
                scelto={varianti?.squadraAngolare}
                voce={voce}
                stato={statoPrezzi}
                onChange={(id) => set({ squadraAngolare: id })}
              />
            )}
            {gruppi.ribalta && (
              <GruppoVarianti
                name="incontroRibalta"
                legend={COMPONENTE_LABEL.incontroRibalta}
                opzioni={gruppi.ribalta.opzioni}
                standardId={gruppi.ribalta.standardId}
                scelto={varianti?.incontroRibalta}
                voce={voce}
                stato={statoPrezzi}
                onChange={(id) => set({ incontroRibalta: id })}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}