"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { api } from "@/trpc/react";
import { kitInputSchema, type KitInput } from "@/server/kit/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  hingeSideLabel,
  materialLabel,
  openingDirLabel,
  windowTypeLabel,
} from "@/lib/kit-labels";

const DEFAULT_FORM: KitInput = {
  windowType: "ANTA_RIBALTA",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 550,
  heightMm: 1820,
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  supplementaryClosures: false,
};

/** Tipologie non ancora coperte dal generatore: mostrate solo come radio disabilitate. */
const FUTURE_WINDOW_TYPES = [
  "ANTA_PROIETTANTE",
  "ANTA_BATTENTE",
  "SCORREVOLE_ALZANTE",
  "SCORREVOLE_TRASLANTE",
  "VASISTAS",
  "FINESTRA_TETTO",
] as const;

/**
 * Finiture coperte dal generatore ARTECH legno: chiavi della tabella
 * COPERTURE_KIT in `src/server/kit/rules-artech.ts` (kit copertura
 * A51301.*). Aggiornare qui in coppia con quella tabella.
 */
const FINISH_OPTIONS = ["ARGENTO"] as const;

const STEP_LABELS = ["Tipologia", "Dimensioni", "Mano e finitura", "Riepilogo"] as const;

const STEP1_SCHEMA = kitInputSchema.pick({ windowType: true, series: true, material: true });
const STEP2_SCHEMA = kitInputSchema.pick({
  widthMm: true,
  heightMm: true,
  airGapMm: true,
  axisOffsetMm: true,
  rebateMm: true,
  seatMm: true,
});
const STEP3_SCHEMA = kitInputSchema.pick({ openingSide: true, openingDir: true, finish: true });

/** Primo messaggio di un safeParse fallito — accetta il risultato di qualunque pick di kitInputSchema. */
function firstIssueMessage(result: { success: false; error: { issues: Array<{ message: string }> } }) {
  return result.error.issues[0]?.message ?? "Dati non validi.";
}

type UpdateForm = <K extends keyof KitInput>(key: K, value: KitInput[K]) => void;

interface StepProps {
  form: KitInput;
  update: UpdateForm;
}

export function NuovaRichiestaClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<KitInput>(DEFAULT_FORM);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const create = api.kit.create.useMutation();
  const generate = api.kit.generate.useMutation();
  const isSubmitting = create.isPending || generate.isPending;

  const update: UpdateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  function goNext() {
    const schema = step === 1 ? STEP1_SCHEMA : step === 2 ? STEP2_SCHEMA : STEP3_SCHEMA;
    const result = schema.safeParse(form);
    if (!result.success) {
      setStepError(firstIssueMessage(result));
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(4, s + 1));
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
      const created = await create.mutateAsync(result.data);
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
        {STEP_LABELS.map((label, index) => {
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
              {n < STEP_LABELS.length && <span className="h-px flex-1 bg-line" aria-hidden />}
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

        {step === 1 && <Step1Tipologia form={form} update={update} />}
        {step === 2 && <Step2Dimensioni form={form} update={update} />}
        {step === 3 && <Step3ManoFinitura form={form} update={update} />}
        {step === 4 && <Step4Riepilogo form={form} />}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={goBack} disabled={step === 1 || isSubmitting}>
          Indietro
        </Button>
        {step < 4 ? (
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
  hint?: string;
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

function Step1Tipologia({ form, update }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Tipologia serramento</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <RadioOption name="windowType" label={windowTypeLabel("ANTA_RIBALTA")} checked onChange={() => {}} />
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
        <p className="w-fit rounded border border-line-strong bg-surface-sunken px-3.5 py-2.5 text-sm font-medium text-ink">
          ARTECH
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Materiale</legend>
        <div className="grid grid-cols-3 gap-2">
          <RadioOption
            name="material"
            label={materialLabel("LEGNO")}
            checked={form.material === "LEGNO"}
            onChange={() => update("material", "LEGNO")}
          />
          <RadioOption
            name="material"
            label={materialLabel("PVC")}
            hint="Provvisorio — in validazione"
            checked={form.material === "PVC"}
            onChange={() => update("material", "PVC")}
          />
          <RadioOption
            name="material"
            label={materialLabel("ALLUMINIO")}
            hint="Non ancora disponibile"
            checked={false}
            onChange={() => {}}
            disabled
          />
        </div>
      </fieldset>
    </div>
  );
}

type DimensionKey = "widthMm" | "heightMm" | "airGapMm" | "axisOffsetMm" | "rebateMm" | "seatMm";

/** Un solo punto di verità per label + range: gli stessi min/max finiscono sia
 * nel testo del label sia negli attributi nativi min/max dell'input, così
 * l'indicazione visiva non può disallinearsi dal vincolo reale. I range
 * ricalcano kitInputSchema in `src/server/kit/types.ts`. */
const DIMENSION_FIELDS: Array<{ key: DimensionKey; label: string; min: number; max: number }> = [
  { key: "widthMm", label: "Larghezza", min: 300, max: 3000 },
  { key: "heightMm", label: "Altezza", min: 300, max: 3000 },
  { key: "airGapMm", label: "Aria", min: 4, max: 20 },
  { key: "axisOffsetMm", label: "Asse", min: 9, max: 20 },
  { key: "rebateMm", label: "Battuta", min: 15, max: 30 },
  { key: "seatMm", label: "Sede", min: 12, max: 22 },
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
        {label} <span className="font-normal text-ink-subtle">({min}–{max} mm)</span>
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

function Step2Dimensioni({ form, update }: StepProps) {
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
    </div>
  );
}

function Step3ManoFinitura({ form, update }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
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

function Step4Riepilogo({ form }: { form: KitInput }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
      <SummaryItem label="Tipologia" value={windowTypeLabel(form.windowType)} />
      <SummaryItem label="Serie" value={form.series} />
      <SummaryItem label="Materiale" value={materialLabel(form.material)} />
      <SummaryItem label="Dimensioni" value={`${form.widthMm} × ${form.heightMm} mm`} />
      <SummaryItem label="Aria" value={`${form.airGapMm} mm`} />
      <SummaryItem label="Asse" value={`${form.axisOffsetMm} mm`} />
      <SummaryItem label="Battuta" value={`${form.rebateMm} mm`} />
      <SummaryItem label="Sede" value={`${form.seatMm} mm`} />
      <SummaryItem label="Mano" value={hingeSideLabel(form.openingSide)} />
      <SummaryItem label="Apertura" value={openingDirLabel(form.openingDir)} />
      <SummaryItem label="Finitura" value={form.finish} />
      <SummaryItem label="Chiusure suppl." value={form.supplementaryClosures ? "Sì" : "No"} />
    </dl>
  );
}
