"use client";

import {
  useId,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown } from "lucide-react";
import { api } from "@/trpc/react";
import {
  artechInputSchema,
  entrataLabel,
  kitInputSchema,
  tourInputSchema,
  ENTRATE,
  type ArtechKitInput,
  type Entrata,
  type KitInput,
  type TourKitInput,
} from "@/server/kit/types";
import { SCHEMI_TOUR, FINITURE_TOUR } from "@/server/kit/rules-tour-bilico-legno";
import { GEOMETRIA_COPERTA } from "@/server/kit/rules-artech-vasistas-legno";
import {
  GEOMETRIE,
  geometriaLabel,
  mm,
  type ArtechGeometryId,
} from "@/server/kit/artech-geometrie";
import {
  avvisiVarianti,
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
  type Varianti,
} from "@/server/kit/artech-varianti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerPicker, type CustomerOption } from "@/components/kit/customer-picker";
import { ProfiloSerramento } from "@/components/kit/profilo-serramento";
import { cn } from "@/lib/utils";
import { formatPercent, formatPrice } from "@/lib/format";
import {
  hingeSideLabel,
  materialLabel,
  openingDirLabel,
  sedeIncontriLabel,
  windowTypeLabel,
} from "@/lib/kit-labels";

/**
 * Lo stato del form NON è un `ArtechKitInput`: **entrata e geometria** devono
 * nascere non valorizzate, perché sceglierle è il punto di questi campi.
 *
 * L'entrata lo fa dal 2026-07-30 (PR #40). La geometria si è aggiunta dopo: fino
 * ad allora `ARTECH_DEFAULT` la cablava a `A12_I13_B20`, cioè alla geometria del
 * cliente storico del golden — ogni nuovo ordine partiva con la geometria di un
 * ALTRO cliente. Sceglierla male non produce un errore: i codici dell'altra
 * combinazione esistono a listino, hanno un prezzo e non danno warning. Era la
 * stessa classe di difetto della cremonese cablata, con la stessa cura.
 *
 * È l'unico prezzo della decisione «nessun default», e si paga solo qui — la
 * validazione vera resta quella dello schema, all'avanzamento del passo e al submit.
 */
type ArtechFormValues = Omit<ArtechKitInput, "entrata" | "geometry"> & {
  entrata?: Entrata;
  geometry?: ArtechGeometryId;
};
type FormValues = ArtechFormValues | TourKitInput;

const ARTECH_DEFAULT: ArtechFormValues = {
  windowType: "ANTA_RIBALTA",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 550,
  heightMm: 1820,
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  supplementaryClosures: false,
};

const TOUR_DEFAULT: TourKitInput = {
  windowType: "BILICO",
  series: "TOUR",
  material: "LEGNO",
  widthMm: 700,
  heightMm: 900,
  finish: "MARRONE RAL 8019",
  tourSchema: 2,
};

/**
 * Cambiando tipologia si cambia **ramo dell'unione**, non un campo: la geometria
 * ARTECH non deve sopravvivere in un form bilico (e viceversa). Si conservano le
 * sole quote, che sono comuni e che l'agente ha appena misurato.
 */
function defaultForWindowType(wt: KitInput["windowType"], prev: FormValues): FormValues {
  const base = wt === "BILICO" ? TOUR_DEFAULT : ARTECH_DEFAULT;
  return { ...base, windowType: wt, widthMm: prev.widthMm, heightMm: prev.heightMm } as FormValues;
}

/** Tipologie coperte dal generatore: radio selezionabili. */
const ACTIVE_WINDOW_TYPES = ["ANTA_RIBALTA", "VASISTAS", "BILICO"] as const;

/** Tipologie non ancora coperte: radio disabilitate. */
const FUTURE_WINDOW_TYPES = [
  "ANTA_BATTENTE",
  "ANTA_PROIETTANTE",
  "SCORREVOLE_ALZANTE",
  "SCORREVOLE_TRASLANTE",
  "FINESTRA_TETTO",
] as const;

/**
 * Materiali disponibili per tipologia. Il listino 2026 copre solo il LEGNO per
 * ARTECH: PVC e ALLUMINIO rimandano a un volume separato («listino PVC e
 * ALLUMINIO», p0849 (847)) non ancora disponibile → entrambi gated.
 */
type MaterialChoice = { value: "LEGNO" | "PVC" | "ALLUMINIO"; enabled: boolean; hint?: string };
const MATERIAL_AVAILABILITY: Record<KitInput["windowType"], MaterialChoice[]> = {
  ANTA_RIBALTA: [
    { value: "LEGNO", enabled: true },
    { value: "PVC", enabled: false, hint: "Non a listino 2026 — serve il listino PVC e alluminio" },
    { value: "ALLUMINIO", enabled: false, hint: "Non ancora disponibile" },
  ],
  // ANTA_BATTENTE è gated in FUTURE_WINDOW_TYPES (distinta senza gruppo di
  // sospensione superiore, schema p0416 (414)): questa voce non viene MAI
  // renderizzata, resta solo perché il Record è tipizzato su tutte le
  // windowType. Valori e hint dicono il vero — con la tipologia spenta nessun
  // materiale è ordinabile — così se un domani il battente torna selezionabile
  // la UI non promette un LEGNO che il generatore rifiuta.
  ANTA_BATTENTE: [
    { value: "LEGNO", enabled: false, hint: "Tipologia non disponibile — distinta incompleta" },
    { value: "PVC", enabled: false, hint: "Tipologia non disponibile — distinta incompleta" },
    { value: "ALLUMINIO", enabled: false, hint: "Tipologia non disponibile — distinta incompleta" },
  ],
  VASISTAS: [
    { value: "LEGNO", enabled: true, hint: "Provvisorio — in validazione" },
    { value: "PVC", enabled: false, hint: "Non disponibile per la vasistas" },
    { value: "ALLUMINIO", enabled: false, hint: "Non disponibile per la vasistas" },
  ],
  // Il bilico TOUR è pubblicato a listino solo per il legno (sezione BILICI,
  // p0532-0553): non esiste una composizione PVC o alluminio da trascrivere.
  BILICO: [
    { value: "LEGNO", enabled: true },
    { value: "PVC", enabled: false, hint: "Il bilico TOUR è a listino solo per il legno" },
    { value: "ALLUMINIO", enabled: false, hint: "Il bilico TOUR è a listino solo per il legno" },
  ],
};

/**
 * Materiale da tenere passando alla tipologia `wt`: quello corrente se la
 * tipologia lo ammette, altrimenti LEGNO. Esportata (e provata a parte) perché
 * oggi il ramo di reset NON è raggiungibile via UI — ogni tipologia
 * selezionabile ammette il solo LEGNO, quindi cliccando non si può arrivare a un
 * materiale «non ammesso». La regola però resta necessaria: appena un materiale
 * torna abilitato su una sola tipologia, il ramo si riaccende. Provarla sulla
 * funzione invece che sui click è l'unico modo onesto di coprirla.
 */
export function materialForWindowType(
  wt: KitInput["windowType"],
  current: KitInput["material"],
): KitInput["material"] {
  return MATERIAL_AVAILABILITY[wt].some((m) => m.enabled && m.value === current)
    ? current
    : "LEGNO";
}

/**
 * Le 7 geometrie sono ordinabili tutte solo per l'**anta-ribalta**: è l'unica
 * tipologia le cui voci geometria-dipendenti sono TABELLATE per geometria
 * (`GEOMETRIE` in `artech-geometrie.ts`). Il vasistas le ha cablate sullo schema
 * p0418 (416) e **rifiuta** le altre sei (`GEOMETRIA_COPERTA` nel suo modulo, che
 * importiamo per non ricopiarne il valore): renderle cliccabili creerebbe bozze
 * che non genereranno mai, come una sede 30. Gated con la ragione, non nascoste.
 *
 * Non serve un reset del valore al cambio di tipologia (come per il materiale):
 * nessuna geometria è preselezionata (vedi `ArtechFormValues`), quindi
 * `defaultForWindowType` riparte da «nessuna scelta» e non può sopravvivere una
 * geometria non ammessa dalla nuova tipologia.
 */
function geometriaAmmessa(wt: KitInput["windowType"], id: ArtechGeometryId): boolean {
  return wt === "VASISTAS" ? id === GEOMETRIA_COPERTA : true;
}

/**
 * Stessa logica di `geometriaAmmessa`, per l'entrata: il modulo vasistas
 * rifiuta E75 (`rules-artech-vasistas-legno.ts`, guardia sull'entrata) perché
 * il listino dichiara le forbici vasistas «non applicabili» su metà dei gruppi
 * senza indicare il componente sostitutivo. Offrirla selezionabile creerebbe
 * bozze DRAFT che consumano un numero di richiesta e non genereranno mai — lo
 * stesso motivo per cui la sede 30 è gated invece che nascosta.
 */
function entrataAmmessa(wt: KitInput["windowType"], valore: Entrata): boolean {
  return !(wt === "VASISTAS" && valore === "E75");
}

/**
 * Finiture coperte dal generatore ARTECH legno: chiavi della tabella
 * COPERTURE_KIT in `src/server/kit/rules-artech-legno.ts` (kit copertura
 * A51301.*). Aggiornare qui in coppia con quella tabella.
 * (Il bilico non ha questo problema: importa `FINITURE_TOUR` dal suo modulo.)
 */
const FINISH_OPTIONS = ["ARGENTO"] as const;

/**
 * Il terzo step cambia nome: il bilico non ha una mano da scegliere. Su ARTECH
 * si chiama «Geometria e mano» da quando aria/interasse/battuta hanno lasciato
 * il passo delle quote — il campo più consequenziale del passo va nel nome.
 *
 * I passi sono CINQUE su ARTECH e QUATTRO sul bilico: «Componenti» esiste solo
 * dove esistono le varianti. Il modulo TOUR dichiara `varianti: []` e il motore
 * rifiuta ciò che il modulo non dichiara — un passo che offrisse scelte lì
 * produrrebbe bozze che non genereranno mai.
 */
function stepLabels(series: KitInput["series"]) {
  return series === "TOUR"
    ? (["Tipologia", "Dimensioni", "Schema e finitura", "Riepilogo"] as const)
    : (["Tipologia", "Dimensioni", "Geometria e mano", "Componenti", "Riepilogo"] as const);
}

/**
 * Schemi di validazione per step, **per ramo**. `z.discriminatedUnion` non
 * espone `.pick()`: i rami sì, perché sono `ZodObject`. È la ragione per cui in
 * `types.ts` i due rami estendono un oggetto comune invece di essere scritti da
 * zero.
 */
const STEP_SCHEMAS = {
  ARTECH: [
    artechInputSchema.pick({ windowType: true, series: true, material: true }),
    artechInputSchema.pick({ widthMm: true, heightMm: true, sashWeightKg: true }),
    artechInputSchema.pick({
      geometry: true,
      entrata: true,
      openingSide: true,
      openingDir: true,
      finish: true,
    }),
    // Passo «Componenti». Le varianti sono tutte facoltative, quindi questo
    // schema non blocca mai il passo: c'è perché una chiave storpiata — un
    // residuo di una versione precedente del form — deve fermarsi QUI e non a
    // `kit.create` (`variantiSchema` è `.strict()`).
    artechInputSchema.pick({ variants: true }),
  ],
  TOUR: [
    tourInputSchema.pick({ windowType: true, series: true, material: true }),
    tourInputSchema.pick({ widthMm: true, heightMm: true, sashWeightKg: true }),
    tourInputSchema.pick({ tourSchema: true, finish: true }),
  ],
} as const;

/**
 * Blocco varianti senza le chiavi vuote — e `undefined` se non ne resta
 * nessuna. `{}` non deve raggiungere il DB: `undefined` significa «lo standard
 * del programma», e il default vive nel REGISTRO, non nel dato persistito
 * (`artech-varianti.ts`). Senza questa normalizzazione, spegnere l'interruttore
 * lascerebbe una colonna `{}` indistinguibile da una scelta.
 */
function componiVarianti(v: Varianti): Varianti | undefined {
  const pulite = Object.fromEntries(
    Object.entries(v).filter(([, valore]) => valore !== undefined),
  ) as Varianti;
  return Object.keys(pulite).length === 0 ? undefined : pulite;
}

/**
 * Quante delle TRE scelte che compongono l'antieffrazione sono attive.
 * (movimento angolare a due nottolini · incontro nottolino antieffrazione ·
 * piastrino). Le altre due varianti non c'entrano: sono scelte di montaggio.
 */
function contaAntieffrazione(v: Varianti | undefined): number {
  if (v === undefined) return 0;
  return (
    (v.movimentoAngolare === "DUE_NOTTOLINI" ? 1 : 0) +
    (v.incontroNottolino?.startsWith("ANTIEFFRAZIONE") === true ? 1 : 0) +
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
 * Le varianti che questa geometria pubblica davvero, e SOLO quelle fuori
 * standard: le altre tornano allo standard. La geometria si sceglie al passo 3 e
 * le varianti al 4, quindi tornare indietro e cambiarla può lasciare nel form
 * una scelta che il listino non pubblica per il nuovo interasse (spec §8).
 *
 * DUE potature, e la seconda è la meno ovvia. Una scelta può restare
 * DISPONIBILE sulla nuova geometria ed esserne lo STANDARD: `BASE` è fuori
 * standard su `A12_I13_B20` (quindi si persiste) ma è lo standard di
 * `A4_I85_B15`. Senza la seconda potatura, tre clic scrivevano a DB
 * `{ squadraAngolare: "BASE" }` dove una richiesta identica creata da zero
 * scrive `NULL` — quella riga non seguirebbe un cambio di default, ed è
 * esattamente ciò che l'invariante «il default vive nel registro» esiste per
 * impedire. In più la Zona B diceva «Modificate: Squadra angolare» mentre a
 * schermo la stessa opzione portava il distintivo «standard».
 *
 * Nessun criterio nuovo: la disponibilità sono le STESSE `opzioni*` che
 * costruiscono le radio, e «fuori standard» sono le STESSE
 * `*EtichettaSeNonStandard` con cui il motore decide se dichiarare la variante
 * sulla riga di distinta (`undefined` = è lo standard). Una seconda nozione di
 * «standard» sarebbe la seconda fonte di verità che questa feature esiste per
 * eliminare.
 */
export function variantiPerGeometria(
  geometry: ArtechGeometryId,
  varianti: Varianti | undefined,
): Varianti | undefined {
  if (varianti === undefined) return undefined;
  const restano = { ...varianti };
  const assente = <T extends string>(opzioni: { id: T }[], scelta: T | undefined) =>
    scelta !== undefined && !opzioni.some((o) => o.id === scelta);
  // `undefined` dall'etichetta = «questa scelta È lo standard» (e vale anche per
  // la scelta assente, dove il `delete` è un no-op).
  const standard = (etichetta: string | undefined) => etichetta === undefined;
  if (
    assente(opzioniSquadraAngolare(geometry), restano.squadraAngolare) ||
    standard(squadraAngolareEtichettaSeNonStandard(geometry, restano.squadraAngolare))
  )
    delete restano.squadraAngolare;
  if (
    assente(opzioniIncontroRibalta(geometry), restano.incontroRibalta) ||
    standard(incontroRibaltaEtichettaSeNonStandard(geometry, restano.incontroRibalta))
  )
    delete restano.incontroRibalta;
  if (
    assente(opzioniIncontroNottolino(geometry), restano.incontroNottolino) ||
    standard(incontroNottolinoEtichettaSeNonStandard(restano.incontroNottolino))
  )
    delete restano.incontroNottolino;
  // Non dipende dalla geometria — ma «il default non si materializza» sì: se
  // `UN_NOTTOLINO` fosse scritto per esteso sarebbe lo standard congelato nel
  // dato, lo stesso difetto in un campo diverso.
  if (standard(movimentoAngolareEtichettaSeNonStandard(restano.movimentoAngolare)))
    delete restano.movimentoAngolare;
  return componiVarianti(restano);
}

/** Primo messaggio di un safeParse fallito — accetta il risultato di qualunque pick. */
function firstIssueMessage(result: {
  success: false;
  error: { issues: Array<{ message: string }> };
}) {
  return result.error.issues[0]?.message ?? "Dati non validi.";
}

/**
 * Setter tipizzato sul ramo. Il cast avviene qui, una volta sola e per
 * costruzione sicuro: `key` e `value` provengono da `T`, e ogni step riceve il
 * ramo che gli compete.
 */
type Update<T> = <K extends keyof T>(key: K, value: T[K]) => void;

function makeUpdate<T>(setForm: Dispatch<SetStateAction<FormValues>>): Update<T> {
  return (key, value) => setForm((prev) => ({ ...prev, [key]: value }) as FormValues);
}

export function NuovaRichiestaClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormValues>(ARTECH_DEFAULT);
  // Il cliente NON e` un campo del form: non entra in `kitInputSchema` (che e`
  // l'input del motore) e viaggia a parte fino a `kit.create`.
  const [cliente, setCliente] = useState<CustomerOption | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const create = api.kit.create.useMutation();
  const generate = api.kit.generate.useMutation();
  const isSubmitting = create.isPending || generate.isPending;

  const labels = stepLabels(form.series);
  // L'ULTIMO passo è il riepilogo, e non è lo stesso numero nei due rami: 5 su
  // ARTECH (con «Componenti»), 4 sul bilico. Derivarlo dalle etichette invece
  // di cablare un 4 è ciò che tiene i due rami allineati da soli.
  const ultimo = labels.length;

  function goNext() {
    // L'ultimo passo è il riepilogo e non ha schema proprio.
    const schema = STEP_SCHEMAS[form.series][step - 1];
    if (!schema) return;
    const result = schema.safeParse(form);
    if (!result.success) {
      setStepError(firstIssueMessage(result));
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(ultimo, s + 1));
  }

  function goBack() {
    setStepError(null);
    setSubmitError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleGenera() {
    setSubmitError(null);
    const result = kitInputSchema.safeParse(form);
    if (!result.success) {
      setStepError(firstIssueMessage(result));
      return;
    }

    let id: string;
    try {
      const created = await create.mutateAsync({
        specs: result.data,
        ...(cliente ? { customerId: cliente.id } : {}),
      });
      id = created.id;
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Errore durante la creazione della richiesta.",
      );
      return;
    }

    try {
      await generate.mutateAsync({ kitRequestId: id });
    } catch {
      // L'errore di generazione resta visibile nel dettaglio (stato DRAFT +
      // pulsante «Rigenera»): si naviga comunque, vedi finally.
    } finally {
      router.push(`/richieste/${id}`);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/richieste"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-subtle transition-colors hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden /> Richieste
      </Link>

      <h1 className="text-xl font-semibold text-ink">Nuova richiesta kit</h1>

      <ol className="flex items-center gap-2">
        {labels.map((label, index) => {
          const n = index + 1;
          const current = n === step;
          const done = n < step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  current
                    ? "bg-brand text-white"
                    : done
                      ? "bg-brand-light text-brand"
                      : "bg-surface-sunken text-ink-subtle",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : n}
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  current ? "font-medium text-ink" : "text-ink-subtle",
                )}
              >
                {label}
              </span>
              {n < labels.length && <span className="h-px flex-1 bg-line" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="rounded-md border border-line bg-surface p-6 shadow-card">
        {stepError && (
          <div
            role="alert"
            className="mb-5 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
          >
            {stepError}
          </div>
        )}
        {submitError && (
          <div
            role="alert"
            className="mb-5 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
          >
            {submitError}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-8">
            <Step1Tipologia form={form} setForm={setForm} />
            <CustomerPicker value={cliente?.id ?? null} onChange={setCliente} />
          </div>
        )}
        {step === 2 &&
          (form.series === "TOUR" ? (
            <Step2DimensioniTour form={form} update={makeUpdate<TourKitInput>(setForm)} />
          ) : (
            <Step2DimensioniArtech form={form} update={makeUpdate<ArtechFormValues>(setForm)} />
          ))}
        {step === 3 &&
          (form.series === "TOUR" ? (
            <Step3SchemaFinitura form={form} update={makeUpdate<TourKitInput>(setForm)} />
          ) : (
            <Step3ManoFinitura
              form={form}
              update={makeUpdate<ArtechFormValues>(setForm)}
              // Cambiare geometria non è aggiornare un campo: può rendere
              // impossibile una variante già scelta, e quella deve tornare allo
              // standard nello stesso gesto (spec §8). Perciò NON passa da
              // `update`, che scrive un campo solo.
              setGeometria={(id) =>
                setForm((prev) => {
                  // Sicuro: questo passo esiste solo per il ramo ARTECH.
                  const artech = prev as ArtechFormValues;
                  return {
                    ...artech,
                    geometry: id,
                    variants: variantiPerGeometria(id, artech.variants),
                  };
                })
              }
              cliente={cliente}
            />
          ))}
        {step === 4 && form.series !== "TOUR" && (
          <Step4Componenti form={form} update={makeUpdate<ArtechFormValues>(setForm)} />
        )}
        {step === ultimo && <StepRiepilogo form={form} cliente={cliente} />}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={goBack} disabled={step === 1 || isSubmitting}>
          Indietro
        </Button>
        {step < ultimo ? (
          <Button onClick={goNext}>
            Avanti
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button onClick={() => void handleGenera()} loading={isSubmitting}>
            Genera kit
          </Button>
        )}
      </div>
    </div>
  );
}

function RadioOption({
  name,
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  name: string;
  label: string;
  // ReactNode e non string: gli hint dell'entrata citano codici prodotto, e la
  // regola inviolabile «codici in font monospace» richiede di avvolgerli in uno
  // <span> — impossibile dentro una stringa semplice. Tutti i chiamanti esistenti
  // passano stringhe, che sono già ReactNode: nessuno si rompe.
  hint?: ReactNode;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const hintId = useId();
  return (
    <label
      className={cn(
        "flex flex-col gap-0.5 rounded border px-3 py-2.5 text-sm transition-colors",
        disabled
          ? "cursor-not-allowed border-line bg-surface-sunken text-ink-subtle"
          : checked
            ? "cursor-pointer border-brand bg-brand-light text-brand"
            : "cursor-pointer border-line-strong text-ink hover:bg-surface-sunken",
      )}
    >
      <span className="flex items-center gap-2">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          // aria-label tiene l'hint fuori dal nome accessibile (che il <label>
          // avvolgente includerebbe); l'hint resta annunciato come descrizione.
          aria-label={hint ? label : undefined}
          aria-describedby={hint ? hintId : undefined}
          className="accent-brand"
        />
        {label}
      </span>
      {hint && (
        <span id={hintId} className="pl-6 text-xs text-ink-subtle">
          {hint}
        </span>
      )}
    </label>
  );
}

function Step1Tipologia({
  form,
  setForm,
}: {
  form: FormValues;
  setForm: Dispatch<SetStateAction<FormValues>>;
}) {
  const materials = MATERIAL_AVAILABILITY[form.windowType];

  function selectWindowType(wt: KitInput["windowType"]) {
    setForm((prev) => {
      const next = defaultForWindowType(wt, prev);
      return { ...next, material: materialForWindowType(wt, prev.material) } as FormValues;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Tipologia serramento</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACTIVE_WINDOW_TYPES.map((wt) => (
            <RadioOption
              key={wt}
              name="windowType"
              label={windowTypeLabel(wt)}
              checked={form.windowType === wt}
              onChange={() => selectWindowType(wt)}
            />
          ))}
          {FUTURE_WINDOW_TYPES.map((wt) => (
            <RadioOption
              key={wt}
              name="windowType"
              label={windowTypeLabel(wt)}
              checked={false}
              onChange={() => {}}
              disabled
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-subtle">Altre tipologie disponibili prossimamente.</p>
      </fieldset>

      <div>
        <span className="mb-2 block text-sm font-semibold text-ink">Serie</span>
        {/* La serie non si sceglie: la determina la tipologia. Mostrarla evita
            che l'agente si chieda dove sia finito il campo. */}
        <p className="w-fit rounded border border-line-strong bg-surface-sunken px-3.5 py-2.5 text-sm font-medium text-ink">
          {form.series}
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Materiale</legend>
        {/* Mobile-first: una colonna sotto sm. A tre colonne fisse ogni cella
            valeva ~90px a 375px e gli hint andavano a capo su 5-6 righe, con le
            parole lunghe fuori dal bordo. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {materials.map((m) => (
            <RadioOption
              key={m.value}
              name="material"
              label={materialLabel(m.value)}
              hint={m.hint}
              checked={form.material === m.value}
              onChange={m.enabled ? () => setForm((p) => ({ ...p, material: m.value })) : () => {}}
              disabled={!m.enabled}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Un solo punto di verità per label + range: gli stessi min/max finiscono sia
 * nel testo del label sia negli attributi nativi min/max dell'input, così
 * l'indicazione visiva non può disallinearsi dal vincolo reale. I range
 * ricalcano kitInputSchema in `src/server/kit/types.ts`. */
/**
 * QUOTE: solo larghezza e altezza. Aria, interasse e battuta non sono più numeri
 * da digitare — sono UNA scelta fra le 7 combinazioni del listino, al passo dopo
 * (`GEOMETRIE`) — e la sede telaio **non si chiede più**: la determina la
 * geometria. Era il campo che un agente esperto, intervistato, non ha saputo
 * riconoscere: il listino la chiama «sede telaio» solo nei titoli degli schemi,
 * mentre nelle tabelle degli incontri — quelle che si guardano per ordinare — è
 * il secondo numero del token nella colonna ASSE (`9x18`, `13x24`). Con gli
 * hint di PR #37 sono spariti anche i due campi che li giustificavano.
 */
const DIMENSION_FIELDS: Array<{
  key: "widthMm" | "heightMm";
  label: string;
  min: number;
  max: number;
}> = [
  { key: "widthMm", label: "Larghezza", min: 300, max: 3000 },
  { key: "heightMm", label: "Altezza", min: 300, max: 3000 },
];

function NumberField({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}{" "}
        <span className="font-normal text-ink-subtle">
          ({min}–{max} mm)
        </span>
      </label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
      />
    </div>
  );
}

/**
 * Peso dell'anta: campo FACOLTATIVO. Lo leggono la vasistas (schema p0418 (416):
 * terza cerniera fra 70 e 80 kg, portata 40 kg per forbice) e il bilico (portata
 * del kit cerniere: 200 kg su Tour 30/35, 300 kg su Tour 40). Non riusa
 * `NumberField` perché lì il campo è obbligatorio (vuoto → NaN → errore di step)
 * e l'unità è sempre «mm»: qui il vuoto deve valere `undefined`.
 */
function SashWeightField({
  value,
  hint,
  onChange,
}: {
  value: number | undefined;
  hint: string;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="sashWeightKg" className="text-sm font-medium text-ink">
        Peso anta <span className="font-normal text-ink-subtle">(1–200 kg)</span>
      </label>
      <Input
        id="sashWeightKg"
        type="number"
        min={1}
        max={200}
        value={value ?? ""}
        aria-describedby="sashWeightKg-hint"
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
      <p id="sashWeightKg-hint" className="text-xs text-ink-subtle">
        {hint}
      </p>
    </div>
  );
}

function Step2DimensioniArtech({
  form,
  update,
}: {
  form: ArtechFormValues;
  update: Update<ArtechFormValues>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {DIMENSION_FIELDS.map((field) => (
        <NumberField
          key={field.key}
          id={field.key}
          label={field.label}
          min={field.min}
          max={field.max}
          value={form[field.key]}
          onChange={(v) => update(field.key, v)}
        />
      ))}
      {form.windowType === "VASISTAS" && (
        <SashWeightField
          value={form.sashWeightKg}
          hint="Facoltativo — serve a verificare la portata delle forbici e a stabilire se occorre la terza cerniera."
          onChange={(v) => update("sashWeightKg", v)}
        />
      )}
    </div>
  );
}

/**
 * Il bilico non ha aria/asse/battuta/sede: quelle quote le implica lo schema di
 * montaggio, che si sceglie al passo dopo. Restano le due misure e il peso.
 */
function Step2DimensioniTour({
  form,
  update,
}: {
  form: TourKitInput;
  update: Update<TourKitInput>;
}) {
  const areaM2 = (form.widthMm * form.heightMm) / 1_000_000;
  const quattroLati = form.widthMm * form.heightMm >= 2_000_000;
  const misureValide = Number.isFinite(areaM2) && areaM2 > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          id="widthMm"
          label="Larghezza"
          min={530}
          max={2400}
          value={form.widthMm}
          onChange={(v) => update("widthMm", v)}
        />
        <NumberField
          id="heightMm"
          label="Altezza"
          min={580}
          max={2400}
          value={form.heightMm}
          onChange={(v) => update("heightMm", v)}
        />
        <SashWeightField
          value={form.sashWeightKg}
          hint="Facoltativo — serve a verificare la portata del kit cerniere (200 kg, 300 kg sullo schema 5)."
          onChange={(v) => update("sashWeightKg", v)}
        />
      </div>

      {/* Echeggia SUBITO la conseguenza delle quote. La ferramenta su 3 o 4 lati
          non è una scelta dell'agente ma cambia quattro codici e circa 60 € di
          distinta: mostrarla qui, dove le quote si toccano, è l'unico punto in
          cui l'agente può accorgersi di un errore di misura. */}
      {misureValide && (
        <p className="rounded-md bg-surface-sunken px-3.5 py-2.5 text-xs text-ink-subtle">
          Superficie <strong className="font-semibold text-ink">{areaM2.toFixed(2)} m²</strong> →
          ferramenta sui{" "}
          <strong className="font-semibold text-ink">{quattroLati ? "4 lati" : "3 lati"}</strong>.
          Il listino lega i due kit alla superficie: non si sceglie.
        </p>
      )}
    </div>
  );
}

function Step3ManoFinitura({
  form,
  update,
  setGeometria,
  cliente,
}: {
  form: ArtechFormValues;
  update: Update<ArtechFormValues>;
  setGeometria: (id: ArtechGeometryId) => void;
  cliente: CustomerOption | null;
}) {
  // Tre stati, non due: `undefined` = geometria non ancora scelta, `null` = aria 4
  // (il listino prevede una fresatura, non una sede), numero = la sede derivata.
  const sedeMm = form.geometry === undefined ? undefined : GEOMETRIE[form.geometry].sedeMm;
  return (
    <div className="flex flex-col gap-6">
      <ProfiloSerramento
        cliente={cliente}
        onApplica={(valori) => {
          // Si applica SOLO ciò che il profilo contiene, e solo se la tipologia
          // lo ammette: il vasistas copre una geometria sola e rifiuta l'entrata
          // 7,5, quindi scriverci sopra il profilo di un cliente anta-ribalta
          // darebbe un passo che non avanza con valori che l'agente non ha scelto.
          if (valori.geometry !== undefined && geometriaAmmessa(form.windowType, valori.geometry))
            setGeometria(valori.geometry);
          if (valori.entrata !== undefined && entrataAmmessa(form.windowType, valori.entrata))
            update("entrata", valori.entrata);
        }}
      />
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Geometria del serramento</legend>
        <p className="mb-2 text-xs text-ink-subtle">
          Aria, interasse e battuta si leggono sul disegno del serramento. La sede degli incontri la
          determina questa scelta: non va indicata.
        </p>
        {/* Mobile-first: una colonna sotto sm — le etichette sono lunghe e a 375px
            devono avere la riga intera. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(GEOMETRIE) as ArtechGeometryId[]).map((id) => {
            const ammessa = geometriaAmmessa(form.windowType, id);
            return (
              <RadioOption
                key={id}
                name="geometry"
                label={geometriaLabel(id)}
                hint={ammessa ? undefined : "Disponibile solo per l'anta-ribalta"}
                checked={form.geometry === id}
                onChange={ammessa ? () => setGeometria(id) : () => {}}
                disabled={!ammessa}
              />
            );
          })}
        </div>
      </fieldset>

      {/* L'entrata è ORTOGONALE alla geometria: sceglie la famiglia della
          cremonese e nient'altro. Nessuna opzione è preselezionata, di
          proposito: è la decisione del 2026-07-30.
          L'hint segue il modello del fix «sede» (PR #37) — prima dove si legge
          la quota sul listino, poi come si scrive nel codice — perché un agente
          esperto non riconosce il nome di una quota che il listino chiama in due
          modi. */}
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Entrata maniglia</legend>
        <p className="mb-2 text-xs text-ink-subtle">
          È il secondo numero del codice della cremonese —{" "}
          {/* L'esempio segue la famiglia della cremonese davvero coinvolta: su
              VASISTAS è A50111.* (rules-artech-vasistas-legno.ts), non A50122.* —
              quel codice non comparirebbe mai in quella distinta. */}
          <span className="font-mono">
            {form.windowType === "VASISTAS" ? (
              <>
                A50111.<b>15</b>.13
              </>
            ) : (
              <>
                A50122.<b>15</b>.07
              </>
            )}
          </span>{" "}
          — e sul listino è la colonna ENTRATA delle tabelle «Cremonesi».
        </p>
        {/* Mobile-first: una colonna sotto sm, come gli altri gruppi. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ENTRATE.map((valore) => {
            // La vasistas rifiuta E75 (guardia in rules-artech-vasistas-legno.ts):
            // senza questo gate l'agente sceglie l'opzione, il passo avanza,
            // `kit.create` consuma un numero di richiesta e solo `kit.generate`
            // fallisce — una bozza morta, come la sede 30 mostrata sotto.
            const ammessa = entrataAmmessa(form.windowType, valore);
            return (
              <RadioOption
                key={valore}
                name="entrata"
                label={`Entrata ${entrataLabel(valore)}`}
                hint={
                  ammessa ? (
                    <>
                      Codice{" "}
                      <span className="font-mono">A50122.{valore === "E75" ? "08" : "15"}.NN</span>
                    </>
                  ) : (
                    "Non coperta per la vasistas: a entrata 7,5 il listino dichiara le forbici " +
                    "vasistas non applicabili (p0426 (424))."
                  )
                }
                checked={form.entrata === valore}
                onChange={ammessa ? () => update("entrata", valore) : () => {}}
                disabled={!ammessa}
              />
            );
          })}
        </div>
      </fieldset>

      {/* SEDE 30 e SEDE 20: mostrate e GATED, non nascoste. La 30 è persistibile
          (enum a DB) ma il motore la rifiuta sempre — p0473 (471) non pubblica
          l'incontro DSS per il formato 13x30 — quindi offrirla selezionabile
          creerebbe bozze che non genereranno mai. La 20 non è nemmeno esprimibile:
          nessuna delle 7 geometrie la deriva, quindi non c'è nulla da rifiutare e
          senza questa voce non ci sarebbe NIENTE a schermo a dirlo.
          Nasconderle sarebbe peggio: chi ha davvero una sede 20 o 30 ordinerebbe
          STANDARD e otterrebbe una distinta completa, plausibile e sbagliata.
          Stesso trattamento di PVC/ALLUMINIO al primo passo. */}
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Sede degli incontri</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {/* L'hint echeggia la sede DERIVATA dalla geometria scelta sopra: è
              l'unica quota che finisce nei codici senza essere stata digitata, e
              vederla qui è ciò che permette di accorgersi di una geometria
              sbagliata prima di generare. */}
          <RadioOption
            name="seatConfig"
            label="Standard"
            // Qui è una FRASE, non un'etichetta di valore: «per questa geometria»
            // dice già che la quota è derivata, e ripeterlo col suffisso del
            // formattatore condiviso (`sedeIncontriLabel`, che resta giusto nel
            // riepilogo e nella scheda) stonava. Per l'aria 4 il listino non
            // parla di sede ma di fresatura (p0469 (467)).
            hint={
              sedeMm === undefined
                ? "La sede la determina la geometria: sceglila qui sopra."
                : sedeMm === null
                  ? "Per questa geometria (aria 4) il listino prevede una fresatura, non una sede."
                  : `Sede per questa geometria: ${sedeMm} mm.`
            }
            checked={form.seatConfig === "STANDARD"}
            onChange={() => update("seatConfig", "STANDARD")}
          />
          <RadioOption
            name="seatConfig"
            label="Sede 20 mm"
            hint="Non ancora coperta: il listino 2026 pubblica il formato 9x20 per gli incontri nottolino e ribalta, ma il generatore copre solo il 9x18 per l'asse 9. Non ordinare questi serramenti come standard."
            checked={false}
            onChange={() => {}}
            disabled
          />
          <RadioOption
            name="seatConfig"
            label="Sede 30 mm"
            hint="Non ancora coperta: il listino 2026 non pubblica un incontro DSS per il formato 13x30. Non ordinare questi serramenti come standard."
            checked={false}
            onChange={() => {}}
            disabled
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Mano</legend>
        <div className="grid grid-cols-2 gap-2">
          <RadioOption
            name="openingSide"
            label={hingeSideLabel("SINISTRA")}
            checked={form.openingSide === "SINISTRA"}
            onChange={() => update("openingSide", "SINISTRA")}
          />
          <RadioOption
            name="openingSide"
            label={hingeSideLabel("DESTRA")}
            checked={form.openingSide === "DESTRA"}
            onChange={() => update("openingSide", "DESTRA")}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Apertura</legend>
        <div className="grid grid-cols-2 gap-2">
          <RadioOption
            name="openingDir"
            label={openingDirLabel("TIRARE")}
            checked={form.openingDir === "TIRARE"}
            onChange={() => update("openingDir", "TIRARE")}
          />
          <RadioOption
            name="openingDir"
            label={openingDirLabel("SPINGERE")}
            checked={form.openingDir === "SPINGERE"}
            onChange={() => update("openingDir", "SPINGERE")}
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="finish" className="text-sm font-medium text-ink">
          Finitura
        </label>
        <select
          id="finish"
          value={form.finish}
          onChange={(e) => update("finish", e.target.value)}
          className="h-11 rounded border border-line-strong bg-surface px-3.5 text-sm text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
        >
          {FINISH_OPTIONS.map((finish) => (
            <option key={finish} value={finish}>
              {finish}
            </option>
          ))}
        </select>
      </div>

      {form.windowType === "ANTA_RIBALTA" && (
        <div className="flex items-start gap-2">
          <input
            id="supplementaryClosures"
            type="checkbox"
            checked={form.supplementaryClosures ?? false}
            onChange={(e) => update("supplementaryClosures", e.target.checked)}
            className="mt-0.5 accent-brand"
          />
          <label htmlFor="supplementaryClosures" className="text-sm text-ink">
            Chiusure supplementari
            <span className="block text-xs text-ink-subtle">
              Punti di chiusura verticali aggiuntivi (angolare + prolunghe + terminale). Opzionale.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

const SCHEMA_NUMBERS = [1, 2, 3, 4, 5] as const;

/**
 * Lo schema di montaggio è il campo più pericoloso di tutto il wizard: sbagliarlo
 * produce una distinta **completa, plausibile e sbagliata** — il modo di fallire
 * peggiore per questo motore. Perciò le opzioni non sono numeri nudi: ogni radio
 * porta la geometria che quel numero implica (listello, asse, battuta) e il
 * modello di cerniera, cioè esattamente i dati che il serramentista legge sul suo
 * disegno. L'agente riconosce il proprio serramento invece di indovinare.
 */
function Step3SchemaFinitura({
  form,
  update,
}: {
  form: TourKitInput;
  update: Update<TourKitInput>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Schema di montaggio</legend>
        <p className="mb-2 text-xs text-ink-subtle">
          Determina listello, asse, battuta, modello di cerniera e guarnizione. Va letto sul disegno
          del serramento.
        </p>
        {/* Due colonne al massimo: gli hint sono lunghi e a 375px devono avere
            la riga intera, come i materiali del primo passo. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SCHEMA_NUMBERS.map((n) => {
            const s = SCHEMI_TOUR[n];
            return (
              <RadioOption
                key={n}
                name="tourSchema"
                label={`Schema ${n}`}
                hint={`Listello ${s.listelloMm} · asse ${mm(s.asseMm)} · battuta ${s.battutaMm} — Tour ${s.tour}, ${s.portataKg} kg`}
                checked={form.tourSchema === n}
                onChange={() => update("tourSchema", n)}
              />
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="finish" className="text-sm font-medium text-ink">
          Finitura
        </label>
        <select
          id="finish"
          value={form.finish}
          onChange={(e) => update("finish", e.target.value)}
          className="h-11 rounded border border-line-strong bg-surface px-3.5 text-sm text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
        >
          {FINITURE_TOUR.map((finish) => (
            <option key={finish} value={finish}>
              {finish}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-subtle">
          Le cerniere TOUR sono a listino in queste due sole finiture.
        </p>
      </div>

      {/* Il bilico non ha mano né direzione di apertura: dirlo esplicitamente,
          perché sono due campi che l'agente si aspetta di trovare qui. */}
      <p className="rounded-md bg-surface-sunken px-3.5 py-2.5 text-xs text-ink-subtle">
        Nessuna mano da scegliere: sui 3 lati il listino prevede la sola configurazione sinistra,
        sui 4 lati escono entrambe le mani.
      </p>
    </div>
  );
}

/**
 * La nota che accompagna ogni gruppo di opzioni. È la formula già adottata dalla
 * PR #44 per il profilo cliente, e dice la verità: le distinte reali di MC,
 * Peruzzi e Fosca non sono mai arrivate, quindi «quello che ordiniamo oggi»
 * sarebbe un'affermazione sull'azienda che il programma non può fare.
 */
const NOTA_STANDARD =
  "Preimpostato su ciò che il programma ordina oggi. Mai confrontato con un ordine vero.";

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
      <legend className="mb-1 text-sm font-medium text-ink">{legend}</legend>
      <p className="mb-2 text-xs text-ink-subtle">{NOTA_STANDARD}</p>
      {/* Mobile-first: una colonna sotto sm — codice, prezzo e Δ stanno sulla
          stessa riga dell'hint e a 375px vogliono la larghezza intera. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {opzioni.map((o) => {
          const p = prezzoDi(o);
          const delta = p === undefined || base === undefined ? undefined : p - base;
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
                  <span>{etichettaPrezzo(stato, p)}</span>
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

/**
 * PASSO «COMPONENTI» — le scelte che il motore prendeva da sé senza dichiararle.
 *
 * Esiste per la sola serie ARTECH, e offre scelte solo dove il modulo le
 * consuma: oggi l'anta-ribalta legno. Vasistas e battente dichiarano
 * `varianti: []` e il motore **rifiuta** ciò che il modulo non dichiara —
 * offrirle produrrebbe bozze che non genereranno mai, come la sede 30. Si dice
 * perché, non si nasconde.
 */
function Step4Componenti({
  form,
  update,
}: {
  form: ArtechFormValues;
  update: Update<ArtechFormValues>;
}) {
  if (form.windowType !== "ANTA_RIBALTA")
    return (
      <p className="rounded-md bg-surface-sunken px-3.5 py-2.5 text-sm text-ink-muted">
        Nessuna variante per questa tipologia: il generatore ne copre un solo schema di montaggio, e
        il listino 2026 non pubblica alternative per i suoi componenti. Si va avanti.
      </p>
    );
  // Irraggiungibile: al passo 4 si arriva solo dopo la validazione del passo 3,
  // che richiede geometria ed entrata. Il controllo tiene i tipi onesti senza
  // un cast che un domani mentirebbe.
  if (form.geometry === undefined || form.entrata === undefined) return null;
  return (
    <ComponentiRibalta
      geometry={form.geometry}
      entrata={form.entrata}
      mano={form.openingSide}
      varianti={form.variants}
      onChange={(v) => update("variants", v)}
    />
  );
}

function ComponentiRibalta({
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
  const statoPrezzi: StatoPrezzi =
    catalogo.data !== undefined ? "PRONTO" : catalogo.isPending ? "CARICAMENTO" : "ERRORE";

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
      // pubblica invece di cablarne una.
      incontroNottolino: gruppi.nottolino?.opzioni.find((o) => o.id.startsWith("ANTIEFFRAZIONE"))
        ?.id,
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
      <p className="text-sm text-ink-muted">
        Le scelte che il listino lascia aperte. Se il serramento è quello di sempre non c&apos;è
        nulla da toccare: si va avanti.
      </p>

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
          <legend className="mb-1 text-sm font-semibold text-ink">Sicurezza</legend>
          <p className="mb-2 text-xs text-ink-subtle">{NOTA_STANDARD}</p>
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

/**
 * Le voci del profilo del cliente su cui la scelta dell'agente diverge.
 *
 * PERCHÉ CONSTATA E NON BLOCCA. È il primo rilevatore d'errore che il sistema
 * possieda — oggi nessuno confronta la richiesta di marzo con quella di
 * settembre — ma non sa QUALE delle due dichiarazioni sia giusta: il profilo lo
 * ha scritto lo stesso agente, a memoria. Segnala che due dichiarazioni sullo
 * stesso cliente non coincidono, il che è informativo in entrambe le direzioni.
 * Un blocco, o una conferma da cliccare, sarebbe teatro del consenso.
 *
 * Le voci a NULL nel profilo non divergono: «non dichiarato» non è «diverso».
 */
function divergenzeDalProfilo(form: ArtechFormValues, cliente: CustomerOption | null): string[] {
  if (cliente === null) return [];
  const out: string[] = [];
  if (cliente.kitGeometry !== null && form.geometry !== cliente.kitGeometry)
    out.push(geometriaLabel(cliente.kitGeometry));
  if (cliente.kitEntrata !== null && form.entrata !== cliente.kitEntrata)
    out.push(`Entrata ${entrataLabel(cliente.kitEntrata)}`);
  return out;
}

function StepRiepilogo({ form, cliente }: { form: FormValues; cliente: CustomerOption | null }) {
  const comuni = (
    <>
      {/* Il cliente e` la prima cosa del riepilogo: e` cio` che decide lo
          sconto, e va letto prima delle quote. Vale per entrambe le serie,
          quindi sta in `comuni` e non nei due rami. */}
      <SummaryItem
        label="Cliente"
        value={
          cliente === null
            ? "Nessuno"
            : cliente.discount === null
              ? cliente.companyName
              : `${cliente.companyName} · sconto ${formatPercent(cliente.discount)}`
        }
      />
      <SummaryItem label="Tipologia" value={windowTypeLabel(form.windowType)} />
      <SummaryItem label="Serie" value={form.series} />
      <SummaryItem label="Materiale" value={materialLabel(form.material)} />
      <SummaryItem label="Dimensioni" value={`${form.widthMm} × ${form.heightMm} mm`} />
    </>
  );

  if (form.series === "TOUR") {
    const s = SCHEMI_TOUR[form.tourSchema as keyof typeof SCHEMI_TOUR];
    const quattroLati = form.widthMm * form.heightMm >= 2_000_000;
    return (
      // Mobile-first: UNA colonna sotto sm, come il riepilogo della scheda. La
      // riga «Listello 30 · asse 15 · battuta 13» non sta in mezza larghezza a
      // 375px. Il desktop resta a tre colonne.
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
        {comuni}
        <SummaryItem label="Schema" value={`Schema ${form.tourSchema}`} />
        {s && (
          <>
            <SummaryItem
              label="Geometria"
              value={`Listello ${s.listelloMm} · asse ${mm(s.asseMm)} · battuta ${s.battutaMm}`}
            />
            <SummaryItem label="Cerniere" value={`Tour ${s.tour} — ${s.portataKg} kg`} />
          </>
        )}
        <SummaryItem label="Ferramenta" value={quattroLati ? "4 lati" : "3 lati"} />
        <SummaryItem label="Finitura" value={form.finish} />
        <SummaryItem
          label="Peso anta"
          value={form.sashWeightKg === undefined ? "Non indicato" : `${form.sashWeightKg} kg`}
        />
      </dl>
    );
  }

  const divergenze = divergenzeDalProfilo(form, cliente);
  // Le stesse `*EtichettaSeNonStandard` che il motore usa per dichiarare la
  // variante sulla riga di distinta: il riepilogo non può avere una seconda
  // nozione di «non standard».
  const scelte = form.geometry === undefined ? [] : scelteNonStandard(form.geometry, form.variants);

  return (
    <>
      {/* Vedi sopra: «Aria 12 · interasse 13 · battuta 20» a 375px vuole la riga intera. */}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
        {comuni}
        {/* `form.geometry` e `form.entrata` sono opzionali nello stato ma qui sono
          sempre valorizzate: al passo 4 si arriva solo dopo la validazione del
          passo 3, che le richiede entrambe. */}
        {form.geometry && <SummaryItem label="Geometria" value={geometriaLabel(form.geometry)} />}
        {form.entrata && (
          <SummaryItem label="Entrata maniglia" value={entrataLabel(form.entrata)} />
        )}
        {/* La sede è l'unica quota DERIVATA che finisce nella distinta: mostrarla
          qui è ciò che permette all'agente di accorgersi di una geometria scelta
          male, ed è la ragione per cui il campo può sparire dall'input. */}
        {form.geometry && (
          <SummaryItem
            label="Sede incontri"
            value={sedeIncontriLabel(GEOMETRIE[form.geometry].sedeMm)}
          />
        )}
        <SummaryItem label="Mano" value={hingeSideLabel(form.openingSide)} />
        <SummaryItem label="Apertura" value={openingDirLabel(form.openingDir)} />
        <SummaryItem label="Finitura" value={form.finish} />
        {form.windowType === "ANTA_RIBALTA" && (
          <SummaryItem label="Chiusure suppl." value={form.supplementaryClosures ? "Sì" : "No"} />
        )}
        {form.windowType === "VASISTAS" && (
          <SummaryItem
            label="Peso anta"
            value={form.sashWeightKg === undefined ? "Non indicato" : `${form.sashWeightKg} kg`}
          />
        )}
        {/* Le scelte del passo «Componenti», scritte PER ESTESO: mai una sigla,
            mai la parola «antieffrazione» da sola — sono tre pezzi diversi e
            chi rilegge deve sapere quali. */}
        {form.geometry && (
          <SummaryItem
            label="Componenti"
            value={
              scelte.length === 0
                ? "Standard del programma"
                : scelte.map((s) => `${s.componente}: ${s.scelta}`).join(" · ")
            }
          />
        )}
      </dl>

      {/* `cliente` è non-null per costruzione quando ci sono divergenze:
          `divergenzeDalProfilo` restituisce subito `[]` se è null. */}
      {divergenze.length > 0 && cliente !== null && (
        <p className="mt-5 rounded-md border border-line-strong bg-surface-sunken px-3.5 py-3 text-sm text-ink-muted">
          <span className="font-medium text-ink">
            Diverso dal profilo di {cliente.companyName}:
          </span>{" "}
          {divergenze.join(" · ")}. Va bene se questo serramento è diverso dal solito; se non lo è,
          controlla la scelta — o aggiorna il profilo in Clienti.
        </p>
      )}
    </>
  );
}
