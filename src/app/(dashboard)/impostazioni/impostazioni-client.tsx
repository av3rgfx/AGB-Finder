"use client";

import { useId, useState } from "react";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { api } from "@/trpc/react";

type Provider = "gemini" | "kimi";

interface KeyStatus {
  provider: Provider;
  configured: boolean;
  source: "db" | "env" | "none";
  maskedSuffix: string | null;
  updatedAt: string | Date | null;
  updatedBy: string | null;
}

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "gemini", label: "Gemini (Google)" },
  { id: "kimi", label: "Kimi (Moonshot)" },
];

export function ImpostazioniClient() {
  const status = api.settings.aiKeys.status.useQuery();

  if (status.isPending) return <SkeletonCards />;

  if (status.isError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
      >
        Errore durante il caricamento dello stato delle API key. Riprova tra qualche istante.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {PROVIDERS.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          current={status.data?.find((s) => s.provider === provider.id)}
          onSaved={() => void status.refetch()}
        />
      ))}
    </div>
  );
}

function ProviderCard({
  provider,
  current,
  onSaved,
}: {
  provider: { id: Provider; label: string };
  current: KeyStatus | undefined;
  onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [tested, setTested] = useState<null | { ok: boolean; error?: string }>(null);
  const inputId = useId();

  const test = api.settings.aiKeys.testConnection.useMutation({
    onSuccess: (result) => setTested(result),
    onError: (error) => setTested({ ok: false, error: error.message }),
  });
  const save = api.settings.aiKeys.set.useMutation({
    onSuccess: () => {
      setApiKey("");
      setTested(null);
      onSaved();
    },
  });

  const sourceLabel =
    current?.source === "db"
      ? "Configurata (DB)"
      : current?.source === "env"
        ? "Configurata (variabile ambiente)"
        : "Non configurata";

  const sourceClass =
    current?.source === "none" ? "text-ink-subtle" : "text-success";

  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">{provider.label}</h2>
        <span className={`inline-flex items-center gap-1.5 text-sm ${sourceClass}`}>
          <KeyRound className="size-3.5" aria-hidden />
          {sourceLabel}
          {current?.maskedSuffix && (
            <span className="font-mono text-ink-subtle">••••{current.maskedSuffix}</span>
          )}
        </span>
      </div>

      {current?.updatedBy && current?.updatedAt && (
        <p className="mb-3 text-xs text-ink-subtle">
          Ultima modifica: {new Date(current.updatedAt).toLocaleString("it-IT")} da{" "}
          {current.updatedBy}
        </p>
      )}

      <label htmlFor={inputId} className="mb-1.5 block text-sm text-ink-muted">
        Nuova API key
      </label>
      <input
        id={inputId}
        type="password"
        autoComplete="off"
        placeholder="Incolla qui la nuova API key…"
        value={apiKey}
        onChange={(event) => {
          setApiKey(event.target.value);
          setTested(null);
        }}
        className="mb-3 w-full rounded border border-line-strong bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!apiKey || test.isPending}
          onClick={() => test.mutate({ provider: provider.id, apiKey })}
          className="rounded border border-line-strong px-3 py-1.5 text-sm text-ink transition-colors duration-150 ease-out-quart hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line-strong disabled:hover:text-ink"
        >
          {test.isPending ? "Test in corso…" : "Testa connessione"}
        </button>
        <button
          type="button"
          disabled={!tested?.ok || save.isPending}
          onClick={() => save.mutate({ provider: provider.id, apiKey })}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 ease-out-quart hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
        >
          {save.isPending ? "Salvataggio…" : "Salva"}
        </button>
      </div>

      {tested && (
        <p
          className={`mt-2 flex items-center gap-1.5 text-sm ${tested.ok ? "text-success" : "text-danger"}`}
          role="status"
        >
          {tested.ok ? (
            <>
              <CheckCircle2 className="size-4" aria-hidden />
              Connessione riuscita
            </>
          ) : (
            <>
              <XCircle className="size-4" aria-hidden />
              Test fallito: {tested.error ?? "errore sconosciuto"}
            </>
          )}
        </p>
      )}
      {save.isError && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {save.error.message}
        </p>
      )}
    </section>
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <span className="h-4 w-32 animate-pulse rounded bg-surface-sunken" />
            <span className="h-4 w-40 animate-pulse rounded bg-surface-sunken" />
          </div>
          <span className="mb-3 block h-9 w-full animate-pulse rounded bg-surface-sunken" />
          <div className="flex gap-2">
            <span className="h-8 w-32 animate-pulse rounded bg-surface-sunken" />
            <span className="h-8 w-20 animate-pulse rounded bg-surface-sunken" />
          </div>
        </div>
      ))}
    </div>
  );
}
