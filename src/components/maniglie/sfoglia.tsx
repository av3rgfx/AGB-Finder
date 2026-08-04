"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";

/**
 * SFOGLIO — il catalogo COLOMBO senza digitare nulla.
 *
 * Tre livelli, tutti costruiti su parole che ha scritto COLOMBO: il gruppo è la
 * PRIMA PAROLA della descrizione del listino (114 valori, copre il 100% dei
 * codici), la famiglia è il token della descrizione che compare anche nel
 * codice. Nessuna etichetta è una nostra classificazione, ed è per questo che
 * l'origine è scritta a schermo invece che nascosta: chi legge «MANIGLIONE 338»
 * deve poter sapere da dove viene quel numero.
 *
 * Le due tipografie non sono decorazione. Il gruppo è una PAROLA (MANIGLIONE,
 * LARA) e sta in tondo; la famiglia è un pezzo di CODICE (CC113, CB71R) e sta in
 * mono, come ogni codice nell'app. Guardando lo schermo si capisce a che livello
 * si è anche senza leggere le briciole.
 */

export interface Gruppo {
  word: string;
  count: number;
}

export interface Famiglia {
  family: string;
  count: number;
}

const conteggio = (n: number) => `${n} ${n === 1 ? "codice" : "codici"}`;

/**
 * Riga di navigazione: etichetta, quanti codici contiene, e dove porta.
 * 44px pieni di bersaglio, larghi quanto la riga: si tocca col pollice senza
 * mirare.
 */
function RigaSfoglia({
  href,
  label,
  count,
  mono,
}: {
  href: string;
  label: string;
  count: number;
  mono?: boolean;
}) {
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={href}
        className="flex min-h-[44px] items-center gap-3 bg-surface px-3 py-2.5 transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 sm:px-4"
      >
        <span
          className={
            mono
              ? "min-w-0 flex-1 truncate font-mono text-sm text-ink"
              : "min-w-0 flex-1 truncate text-sm font-medium text-ink"
          }
        >
          {label}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-ink-subtle">{conteggio(count)}</span>
        <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * Livello 1: i gruppi, come CHIP in griglia fluida e non come righe a tutta
 * larghezza. A 375px ne entrano due per riga: 114 gruppi passano da ~14
 * schermate a ~5, senza tagliarne nessuno — e tagliarne una parte avrebbe
 * richiesto una soglia decisa da noi («i primi 20»), che è esattamente la classe
 * di difetto chiusa otto volte. Misurato: i primi 19 gruppi sono già il 55% del
 * catalogo, quindi un taglio nasconderebbe il 45%, non una coda.
 *
 * In ordine ALFABETICO. Per numerosità il numero grosso non significa «conta di
 * più» ma «ha più finiture» (MANIGLIONE: 338 codici, 160 descrizioni distinte),
 * e spingeva in fondo LARA, MILLA, VIOLA — i nomi che il cliente pronuncia.
 *
 * Il campo che filtra le etichette è ciò che rende la lunghezza irrilevante e
 * insieme scioglie i doppioni del fornitore senza che noi si fonda niente:
 * digitando «ros» compaiono `ROS.` e `ROSETTA` una sopra l'altra, e la fusione
 * la fa l'occhio di chi guarda. Filtra SOLO le 114 etichette già in memoria:
 * nessuna query, e non è la ricerca articoli — quella sta sopra ed è un'altra cosa.
 */
export function SfogliaGruppi({ groups }: { groups: Gruppo[] }) {
  const [filtro, setFiltro] = useState("");
  const cerca = filtro.trim().toUpperCase();
  const visibili = cerca ? groups.filter((g) => g.word.includes(cerca)) : groups;

  return (
    <section aria-labelledby="sfoglia-titolo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="sfoglia-titolo" className="text-sm font-semibold text-ink">
          Sfoglia il catalogo
        </h2>
        {/* L'origine dichiarata: è ciò che impedisce all'etichetta di sembrare
            una classificazione nostra. Le parole sono di COLOMBO, refusi
            compresi, e chi le legge deve saperlo. E il numero è quanti CODICI,
            non quanti modelli: dirlo evita che «338» prometta 338 oggetti
            diversi quando le descrizioni distinte sono 160. */}
        <p className="text-xs text-ink-subtle">
          {groups.length} gruppi in ordine alfabetico, per la prima parola della descrizione a
          listino. Il numero è quanti codici.
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="sr-only">Filtra i gruppi</span>
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtra i gruppi…"
          // 40px: più basso della ricerca articoli, che resta il campo primario.
          className="h-10 w-full rounded border border-line-strong bg-surface px-3 text-base text-ink transition-colors duration-150 placeholder:text-ink-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 sm:text-sm"
        />
      </label>

      {visibili.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-subtle">
          Nessun gruppo contiene «{filtro.trim()}». Per cercare un articolo usa il campo qui sopra.
        </p>
      ) : (
        <ul className="grid list-none grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibili.map((g) => (
            <ChipGruppo key={g.word} gruppo={g} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Il chip di un gruppo. L'etichetta va a capo invece di troncarsi: fra i 114
 * gruppi veri ci sono `ROBOQUATTRO`, `FERMAPORTA`, `BLOCCAPORTA` e
 * `MANIG.LC413RS`, e a 375px in due colonne non ci stanno su una riga sola.
 * Troncare qui significherebbe rendere illeggibile proprio l'unica cosa che il
 * chip contiene.
 */
function ChipGruppo({ gruppo }: { gruppo: Gruppo }) {
  return (
    <li>
      <Link
        href={`/maniglie?tipo=${encodeURIComponent(gruppo.word)}`}
        aria-label={`${gruppo.word}, ${conteggio(gruppo.count)}`}
        className="flex h-full min-h-[56px] flex-col justify-center gap-0.5 rounded-md border border-line bg-surface px-3 py-2 transition-colors duration-150 hover:border-line-strong hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <span className="break-words text-sm font-medium leading-tight text-ink">
          {gruppo.word}
        </span>
        <span aria-hidden className="text-xs tabular-nums text-ink-subtle">
          {gruppo.count}
        </span>
      </Link>
    </li>
  );
}

/** Livello 2: le famiglie di un gruppo. */
export function SfogliaFamiglie({ tipo, families }: { tipo: string; families: Famiglia[] }) {
  return (
    <ul className="list-none overflow-hidden rounded-md border border-line">
      {families.map((f) => (
        <RigaSfoglia
          key={f.family}
          href={`/maniglie?tipo=${encodeURIComponent(tipo)}&fam=${encodeURIComponent(f.family)}`}
          label={f.family}
          count={f.count}
          mono
        />
      ))}
    </ul>
  );
}

/**
 * Intestazione dei codici che una famiglia non ce l'hanno.
 *
 * Non è una categoria e non deve sembrarlo: su 114 gruppi veri settanta hanno
 * copertura PARZIALE (BOCCHETTA 250 su 288), e questi codici restano sotto le
 * famiglie come righe articolo. Una voce «Altro» darebbe un nome di categoria a
 * ciò che una categoria non ha — la classe di difetto che il progetto ha chiuso
 * otto volte. Qui si constata l'assenza del dato, e la si constata a parole.
 */
export function SenzaFamiglia({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-0.5 pt-1">
      <h3 className="text-sm font-semibold text-ink">Senza famiglia</h3>
      <p className="text-xs text-ink-subtle">
        {conteggio(count)} che il listino non lega a una famiglia
      </p>
    </div>
  );
}

/**
 * Dove si è, e come tornare indietro. Stesso patto dell'archivio serramenti: i
 * filtri attivi sono chip con la ✕, e la ✕ è un link — quindi il tasto indietro
 * del telefono funziona senza che noi lo si gestisca.
 */
export function FiltriSfoglia({ tipo, famiglia }: { tipo: string; famiglia: string }) {
  if (!tipo) return null;
  return (
    <nav aria-label="Dove sei" className="flex flex-wrap items-center gap-2">
      <Chip
        label={tipo}
        // Togliere il gruppo porta all'elenco dei gruppi; togliendolo cade anche
        // la famiglia, che senza il suo gruppo non individua nulla.
        href="/maniglie"
        removeLabel={`Togli il gruppo ${tipo}`}
      />
      {famiglia ? (
        <Chip
          label={famiglia}
          mono
          href={`/maniglie?tipo=${encodeURIComponent(tipo)}`}
          removeLabel={`Togli la famiglia ${famiglia}`}
        />
      ) : null}
    </nav>
  );
}

function Chip({
  label,
  href,
  removeLabel,
  mono,
}: {
  label: string;
  href: string;
  removeLabel: string;
  mono?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-brand-light py-1 pl-2.5 pr-1 text-xs font-medium text-ink">
      <span className={mono ? "font-mono" : undefined}>{label}</span>
      <Link
        href={href}
        aria-label={removeLabel}
        className="grid size-6 place-items-center rounded text-ink-muted transition-colors duration-150 hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <X className="size-3.5" aria-hidden />
      </Link>
    </span>
  );
}
