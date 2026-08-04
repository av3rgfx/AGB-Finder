"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Palette, X } from "lucide-react";

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

/**
 * La finitura scelta: il CODICE va negli URL, il NOME nelle frasi. Tenerli
 * insieme evita che un chiamante metta «CM» in una frase italiana o «Cromat» in
 * un parametro.
 */
export type FinituraScelta = { codice: string; nome: string } | null;

const conteggio = (n: number) => `${n} ${n === 1 ? "codice" : "codici"}`;

/**
 * I filtri di pagina, in coda a ogni link dello sfoglio. Una regola sola e non
 * quattro: scendere di livello non deve spegnere in silenzio un filtro che si è
 * acceso, e con quattro copie sparse basta dimenticarne una perché l'insieme
 * cambi senza che nessuno l'abbia chiesto.
 */
function codaFiltri(soloPronta: boolean, finitura: FinituraScelta): string {
  const p = new URLSearchParams();
  if (soloPronta) p.set("pronta", "1");
  if (finitura) p.set("finitura", finitura.codice);
  return p.toString();
}

/**
 * La frase che dichiara di cosa sia il numero mostrato. Il numero che cambia
 * insieme senza dirlo è la classe di difetto che questo progetto ha già chiuso
 * otto volte: qui cambia di venti volte col filtro della pronta consegna (178
 * pronti su 3.456) e di sei col colore più raro.
 */
function insiemeContato(soloPronta: boolean, finitura: FinituraScelta): string {
  const parti: string[] = [];
  if (soloPronta) parti.push("in pronta consegna");
  if (finitura) parti.push(`nella finitura ${finitura.nome}`);
  return parti.length ? ` ${parti.join(" e ")}` : "";
}

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
export function SfogliaGruppi({
  groups,
  soloPronta,
  finitura,
}: {
  groups: Gruppo[];
  soloPronta: boolean;
  finitura: FinituraScelta;
}) {
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
        {/* Col filtro acceso il numero sul chip conta un altro insieme. Dirlo
            NON è pignoleria: un numero che cambia significato senza dirlo è la
            classe di difetto che il progetto ha chiuso otto volte, e qui
            cambierebbe di venti volte (178 pronti su 3.456). */}
        {/* «per la prima parola della descrizione a listino» è diventato FALSO
            con la curatela: ROSETTA raccoglie anche le righe scritte `ROS.`, e
            ROBOCINQUE S è un pezzo del gruppo ROBOCINQUE. Descriveva un
            meccanismo che non è più quello, ed era la stessa forma del difetto
            che questo reparto ha già corretto una volta (una sezione chiamata
            «Disponibilità» che nominava un attributo falso 95 volte su 100). */}
        <p className="text-xs text-ink-subtle">
          {groups.length} gruppi in ordine alfabetico, come li nomina COLOMBO. Il numero è quanti
          codici{insiemeContato(soloPronta, finitura)}.
        </p>
        {/* Ciò che il programma ha deciso e che senza questa riga non direbbe:
            cinque categorie non si sfogliano affatto. Chi cercasse una vite qui
            e non la trovasse concluderebbe che non la trattiamo — mentre è a
            magazzino e la ricerca la restituisce. È la classe «valore deciso dal
            programma e mai dichiarato», che qui costerebbe una telefonata. */}
        <p className="text-xs text-ink-subtle">
          Viti, dadi, chiavi e rondelle non si sfogliano: si trovano scrivendole nella ricerca.
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
          {cerca
            ? `Nessun gruppo contiene «${filtro.trim()}»${insiemeContato(soloPronta, finitura) ? ` fra quelli${insiemeContato(soloPronta, finitura)}` : ""}. Per cercare un articolo usa il campo qui sopra.`
            : "Nessun articolo in pronta consegna."}
        </p>
      ) : (
        <ul className="grid list-none grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibili.map((g) => (
            <ChipGruppo key={g.word} gruppo={g} coda={codaFiltri(soloPronta, finitura)} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Il filtro «solo pronta consegna».
 *
 * Compare soltanto se una giacenza è stata caricata: senza, la domanda «cosa è
 * pronto» non ha risposta, e un interruttore che non può rispondere è peggio
 * della sua assenza.
 *
 * È una casella e non un chip di filtro, perché non nasce da ciò che c'è a
 * schermo: restringe TUTTI e tre i livelli e resta acceso mentre si scende. Per
 * la stessa ragione sta FUORI dall'elenco dei gruppi e la disegna la pagina, a
 * ogni livello: se vivesse solo al primo, da dentro un gruppo non si potrebbe né
 * accendere né vedere che è acceso — e uno stato invisibile che toglie 19 righe
 * su 20 fa concludere all'agente che il catalogo non ha quell'articolo.
 */
export function SoloPronta({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[44px] w-fit cursor-pointer items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2 transition-colors duration-150 hover:bg-surface-sunken">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-line-strong text-brand accent-brand"
      />
      <span className="text-sm font-medium text-ink">Solo pronta consegna</span>
    </label>
  );
}

/**
 * Il chip di un gruppo. L'etichetta va a capo invece di troncarsi: fra i 114
 * gruppi veri ci sono `ROBOQUATTRO`, `FERMAPORTA`, `BLOCCAPORTA` e
 * `MANIG.LC413RS`, e a 375px in due colonne non ci stanno su una riga sola.
 * Troncare qui significherebbe rendere illeggibile proprio l'unica cosa che il
 * chip contiene.
 */
function ChipGruppo({ gruppo, coda }: { gruppo: Gruppo; coda: string }) {
  return (
    <li>
      <Link
        href={`/maniglie?tipo=${encodeURIComponent(gruppo.word)}${coda ? `&${coda}` : ""}`}
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
export function SfogliaFamiglie({
  tipo,
  families,
  soloPronta,
  finitura,
}: {
  tipo: string;
  families: Famiglia[];
  soloPronta: boolean;
  finitura: FinituraScelta;
}) {
  const coda = codaFiltri(soloPronta, finitura);
  return (
    <ul className="list-none overflow-hidden rounded-md border border-line">
      {families.map((f) => (
        <RigaSfoglia
          key={f.family}
          href={`/maniglie?tipo=${encodeURIComponent(tipo)}&fam=${encodeURIComponent(f.family)}${coda ? `&${coda}` : ""}`}
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
export function FiltriSfoglia({
  tipo,
  famiglia,
  soloPronta,
  finitura,
}: {
  tipo: string;
  famiglia: string;
  soloPronta: boolean;
  finitura: FinituraScelta;
}) {
  if (!tipo) return null;
  const filtri = codaFiltri(soloPronta, finitura);
  const coda = filtri ? `?${filtri}` : "";
  return (
    <nav aria-label="Dove sei" className="flex flex-wrap items-center gap-2">

      <Chip
        label={tipo}
        // Togliere il gruppo porta all'elenco dei gruppi; togliendolo cade anche
        // la famiglia, che senza il suo gruppo non individua nulla.
        href={`/maniglie${coda}`}
        removeLabel={`Togli il gruppo ${tipo}`}
      />
      {famiglia ? (
        <Chip
          label={famiglia}
          mono
          href={`/maniglie?tipo=${encodeURIComponent(tipo)}${coda.replace("?", "&")}`}
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

export interface FinituraOpzione {
  codice: string;
  nome: string;
  colore: string;
  count: number;
}

/**
 * FILTRO FINITURA — la quattordicesima riga di Andrea.
 *
 * Sul listino vero l'88,7% dei codici (3.065 su 3.456) ha come coda una delle 31
 * finiture che COLOMBO pubblica. Le altre code sono bicolori (`CR8` =
 * CROMO/CROMAT) e misure: non compaiono, perché inventare una categoria sulle
 * code non riconosciute è ciò che la scheda misure vieta.
 *
 * Sta dentro un `<details>` NATIVO e non dietro uno stato React: nel catalogo
 * intero le finiture presenti sono 28, che aperte occupano mezzo schermo a
 * 375px — e il filtro, per definizione, è spento quasi sempre. Il tag nativo dà
 * gratis tastiera, `aria-expanded` e lo stato di apertura; una disclosure scritta
 * a mano sarebbe più codice e meno accessibile.
 *
 * Il pallino è DECORATIVO: il colore è campionato dalle pastiglie di catalogo,
 * non dichiarato da COLOMBO, e a portare il significato è il nome. Chi non
 * distingue i colori legge «Cromat» e ha la stessa informazione.
 */
export function FiltroFinitura({
  opzioni,
  value,
  onChange,
}: {
  opzioni: FinituraOpzione[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (opzioni.length === 0) return null;
  const scelta = opzioni.find((o) => o.codice === value);

  return (
    <details className="w-full rounded-md border border-line bg-surface sm:w-fit">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2.5 px-3 py-2 transition-colors duration-150 hover:bg-surface-sunken">
        {scelta ? (
          <Pastiglia colore={scelta.colore} />
        ) : (
          <Palette className="size-4 text-ink-subtle" aria-hidden />
        )}
        <span className="text-sm font-medium text-ink">
          {scelta ? `Finitura: ${scelta.nome}` : "Finitura"}
        </span>
        <ChevronDown className="ml-auto size-4 text-ink-subtle" aria-hidden />
      </summary>

      <div className="border-t border-line p-2">
        {/* Due colonne a 375px: i nomi sono parole intere («Strawberry Red»), e
            a una colonna l'elenco diventerebbe una lista da scorrere. */}
        <ul className="grid list-none grid-cols-2 gap-1 sm:grid-cols-4">
          {scelta ? (
            <li className="col-span-full">
              <button
                type="button"
                onClick={() => onChange("")}
                className="flex min-h-[36px] w-full items-center rounded px-2 text-sm text-ink-muted transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                Tutte le finiture
              </button>
            </li>
          ) : null}
          {opzioni.map((o) => {
            const attiva = o.codice === value;
            return (
              <li key={o.codice}>
                <button
                  type="button"
                  aria-pressed={attiva}
                  onClick={() => onChange(attiva ? "" : o.codice)}
                  className={`flex min-h-[36px] w-full items-center gap-2 rounded px-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                    attiva ? "bg-brand-light font-medium text-ink" : "text-ink hover:bg-surface-sunken"
                  }`}
                >
                  <Pastiglia colore={o.colore} />
                  <span className="min-w-0 flex-1 truncate text-sm">{o.nome}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-subtle">{o.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

/**
 * Il bordo non è decorazione: `White` è `#FFFEF2` e su fondo bianco sparirebbe,
 * lasciando una pastiglia invisibile accanto a un nome.
 */
function Pastiglia({ colore }: { colore: string }) {
  return (
    <span
      aria-hidden
      className="size-4 shrink-0 rounded-full border border-line-strong"
      style={{ backgroundColor: colore }}
    />
  );
}
