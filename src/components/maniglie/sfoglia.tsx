"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Package, Palette, X } from "lucide-react";
import type { ArticleSummary } from "@/server/api/routers/article";

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
  /** Il gruppo È un modello: COLOMBO gli dedica un archivio fotografico. */
  isModello: boolean;
  /**
   * Il gruppo non è una maniglia. È una lista di Andrea, non un dato: i pomoli
   * hanno l'archivio e maniglie non sono, MILLA e SPIDER sono maniglie senza
   * archivio. «Accessori» è la sola parola NOSTRA di questo schermo.
   */
  isAccessorio: boolean;
  /** Percorso della foto di anteprima, o `null`. */
  preview: string | null;
}

export interface Serie {
  serie: string;
  count: number;
  preview: string | null;
  /** Le righe della serie, già in pagina: la tendina si apre senza rete. */
  rows: ArticleSummary[];
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
 * Livello 1: i gruppi, in griglia fluida e non come righe a tutta larghezza.
 * A 375px ne entrano due per riga, e nessuno viene tagliato — tagliarne una
 * parte avrebbe richiesto una soglia decisa da noi («i primi 20»), che è
 * esattamente la classe di difetto chiusa otto volte. Misurato: i primi 19
 * gruppi sono già il 55% del catalogo, quindi un taglio nasconderebbe il 45%,
 * non una coda.
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
  // «Accessori» è a schermo ma non è il nome di nessun gruppo: senza questo,
  // digitarla non troverebbe nulla mentre la parola si legge sopra la griglia.
  // Da tre caratteri, così «AC» non svuota la ricerca di chi cerca altro.
  const cercaAccessori = cerca.length >= 3 && "ACCESSORI".startsWith(cerca);
  const visibili = cerca
    ? groups.filter((g) => g.word.includes(cerca) || (cercaAccessori && g.isAccessorio))
    : groups;
  const accessori = visibili.filter((g) => g.isAccessorio);
  const resto = visibili.filter((g) => !g.isAccessorio);
  const coda = codaFiltri(soloPronta, finitura);

  return (
    <section aria-labelledby="sfoglia-titolo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="sfoglia-titolo" className="text-sm font-semibold text-ink">
            Sfoglia il catalogo
          </h2>
          {/* Un'ANCORA, non un filtro: 73 tessere a 375px sono ~37 righe, e la
              banda in fondo altrimenti si troverebbe solo scorrendo. `<a href="#">`
              e non uno scroll in JS, così il tasto indietro funziona da sé.
              Sparisce quando il filtro svuota la banda: un collegamento che
              porta a un'ancora inesistente è peggio della sua assenza. */}
          {accessori.length > 0 ? (
            <a
              href="#accessori"
              className="shrink-0 rounded text-xs font-medium text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              Accessori ({accessori.length}) ↓
            </a>
          ) : null}
        </div>
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
          {groups.length} gruppi in ordine alfabetico. Il numero è quanti codici
          {insiemeContato(soloPronta, finitura)}, non quanti modelli: lo stesso pezzo compare una
          volta per finitura.
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
        <>
          {resto.length > 0 ? <GrigliaGruppi gruppi={resto} coda={coda} /> : null}

          {/* ⚠️ LA BANDA DI SOPRA NON HA INTESTAZIONE, ed è una scelta.
              Qualunque nome sarebbe FALSO — «Maniglie» starebbe sopra BOCCHETTA
              (318), MANIGLIONE (353), POMOLINO (41), GRANO (3): misurato che
              dei 27 gruppi di solo testo 17 sono accessori e 10 no — oppure
              sarebbe una SECONDA parola nostra.
              Ha anche un effetto che nessun test potrebbe dare: il giorno che
              COLOMBO aggiunge un gruppo e nessuno lo classifica, quel gruppo
              cade in una banda che non afferma nulla. */}
          {accessori.length > 0 ? (
            <section
              aria-labelledby="accessori"
              className="flex flex-col gap-3 border-t border-line pt-4"
            >
              <div className="flex flex-col gap-0.5">
                {/* `scroll-mt-14` e non `-4`: sopra l'elenco c'è la fascia
                    STICKY con la data della pronta consegna (36px misurati), e
                    con un margine più piccolo l'ancora atterrava lasciando il
                    titolo NASCOSTO sotto di essa. Il salto sembrava funzionare
                    — lo scroll avveniva — ma portava a una banda senza nome.
                    L'ha visto lo screenshot, non l'asserzione: il test
                    controllava `scrollY > 100`, ed era vero. */}
                <h3 id="accessori" className="scroll-mt-14 text-sm font-semibold text-ink">
                  Accessori
                </h3>
                {/* L'unica parola NOSTRA di questo schermo, e lo dice. Tutte le
                    altre etichette sono parole del listino COLOMBO, refusi
                    compresi: se questa non si dichiarasse, sembrerebbe una loro
                    categoria — la classe di difetto chiusa otto volte. */}
                <p className="text-xs text-ink-subtle">
                  «Accessori» è un raggruppamento nostro: le altre etichette sono parole del listino
                  COLOMBO.
                </p>
              </div>
              <GrigliaGruppi gruppi={accessori} coda={coda} />
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * La griglia, uguale per le due bande — stessa densità e stessa forma di
 * tessera. Un accessorio e un MANIGLIONE sono LO STESSO OGGETTO a schermo
 * (entrambi tessere di solo testo): renderli diversi affermerebbe una
 * differenza che non c'è.
 */
function GrigliaGruppi({ gruppi, coda }: { gruppi: Gruppo[]; coda: string }) {
  return (
    <ul className="grid list-none grid-cols-2 items-start gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {gruppi.map((g) => (
        <TesseraGruppo key={g.word} gruppo={g} coda={coda} />
      ))}
    </ul>
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
 * La tessera di un gruppo, in DUE forme, e la differenza non è estetica.
 *
 * **Modello** (63 gruppi su 102): foto grande, nome, conteggio. La foto è quella
 * di un suo articolo, e dentro un gruppo-modello tutti gli articoli sono lo
 * stesso modello in finiture diverse — quindi ritrae il gruppo, non un suo
 * membro a caso. Quali gruppi siano un modello NON è un nostro giudizio: è la
 * struttura dell'archivio fotografico ufficiale di COLOMBO (`ARCHIVI`).
 *
 * **Tipologia** (39): solo testo, nome più grande. NESSUNA area immagine: una
 * tipologia raccoglie modelli diversi (BOCCHETTA ne ha 22), e una foto sola
 * sarebbe un modello spacciato per la categoria. Lasciare il riquadro vuoto
 * sarebbe peggio che non averlo: in una griglia un buco si legge come immagine
 * rotta, mentre una tessera di testo si legge come una tessera di testo.
 *
 * L'etichetta va a capo invece di troncarsi: fra i gruppi veri ci sono
 * `ROBOQUATTRO`, `FERMAPORTA`, `MANIGLIA INCASSO`, e a 375px in due colonne non
 * ci stanno su una riga sola. Troncare renderebbe illeggibile proprio l'unica
 * cosa che la tessera contiene.
 */
function TesseraGruppo({ gruppo, coda }: { gruppo: Gruppo; coda: string }) {
  return (
    <li>
      <Link
        href={`/maniglie?tipo=${encodeURIComponent(gruppo.word)}${coda ? `&${coda}` : ""}`}
        aria-label={`${gruppo.word}, ${conteggio(gruppo.count)}`}
        className="flex h-full flex-col gap-1 rounded-md border border-line bg-surface p-2 transition-colors duration-150 hover:border-line-strong hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {gruppo.isModello ? <FotoGruppo url={gruppo.preview} /> : null}
        <span
          className={
            gruppo.isModello
              ? "break-words text-sm font-medium leading-tight text-ink"
              : "flex min-h-[40px] flex-1 items-center break-words text-base font-semibold leading-tight text-ink"
          }
        >
          {gruppo.word}
        </span>
        <span aria-hidden className="text-xs tabular-nums text-ink-subtle">
          {gruppo.count}
        </span>
      </Link>
    </li>
  );
}

/**
 * La foto di un gruppo-modello. Tutti e 63 ne hanno una (misurato), ma il
 * segnaposto resta: un listino nuovo può portare un modello prima che
 * l'archivio fotografico lo segua, e allora la tessera deve reggere.
 *
 * `onError` non è prudenza teorica: la foto arriva da una route che risponde
 * 404 quando il file non c'è su Blob, e senza questo il browser disegnerebbe
 * la sua icona di immagine rotta — che in una griglia si legge come «il
 * programma è guasto». È lo stesso patto della miniatura nelle righe articolo.
 */
function FotoGruppo({ url }: { url: string | null }) {
  const [fallita, setFallita] = useState(false);
  if (!url || fallita) {
    return (
      <span
        aria-hidden
        className="grid aspect-square w-full place-items-center rounded bg-surface-sunken"
      >
        <Package className="size-6 text-ink-subtle" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFallita(true)}
      className="aspect-square w-full rounded bg-white object-contain"
    />
  );
}

/**
 * Livello 2: le SERIE del gruppo, a TENDINA, più d'una aperta insieme.
 *
 * `<details>`/`<summary>` NATIVO, come il filtro colori: dà tastiera,
 * `aria-expanded` e la ricerca del browser (che apre da sé la tendina giusta)
 * senza scriverli. E ha un effetto che una disclosure a mano non avrebbe: una
 * tendina chiusa tiene le sue righe nel DOM con `display:none`, quindi il
 * browser non ne scarica le foto. Il costo di rete è quello che si apre, non
 * quello che si manda.
 *
 * Le righe di una serie aperta stanno su fondo `surface-sunken` per mostrare
 * che sono dentro qualcosa. Nessun bordo laterale colorato (vietato dal
 * sistema) e nessun rientro: a 375px lo spazio orizzontale non c'è.
 *
 * Nessuna animazione di altezza: si muove solo il chevron.
 */
export function SfogliaSerie({
  serie,
  aperte,
  onToggle,
  senzaSerie,
  isModello,
  renderRiga,
}: {
  serie: Serie[];
  aperte: string[];
  onToggle: (serie: string, aperta: boolean) => void;
  senzaSerie: ArticleSummary[];
  /** Il gruppo è un MODELLO: qui la foto per-serie ripeterebbe. */
  isModello: boolean;
  renderRiga: (a: ArticleSummary) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {serie.length > 0 ? (
        <ul className="list-none overflow-hidden rounded-md border border-line">
          {serie.map((s) => {
            const aperta = aperte.includes(s.serie);
            return (
              <li key={s.serie} className="border-b border-line last:border-b-0">
                <details
                  open={aperta}
                  onToggle={(e) => onToggle(s.serie, (e.currentTarget as HTMLDetailsElement).open)}
                >
                  <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 bg-surface px-3 py-2 transition-colors duration-150 hover:bg-surface-sunken sm:px-4">
                    {isModello ? null : <AnteprimaSerie url={s.preview} />}
                    {/* La serie è un pezzo di CODICE e sta in mono, come ogni
                        codice nell'app: guardando lo schermo si capisce a che
                        livello si è anche senza leggere le briciole. */}
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
                      {s.serie}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
                      {conteggio(s.count)}
                    </span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-ink-subtle transition-transform duration-150 ${aperta ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </summary>
                  <ul className="list-none bg-surface-sunken">{s.rows.map(renderRiga)}</ul>
                </details>
              </li>
            );
          })}
        </ul>
      ) : null}

      {senzaSerie.length > 0 ? (
        <>
          {/* Non è una categoria e non deve sembrarlo: sono i codici che il
              listino non lega a una serie. Misurato dopo i tre gradini: 60 su
              3.393. Una voce «Altro» darebbe un nome di categoria a ciò che una
              categoria non ha — la classe di difetto che il progetto ha chiuso
              otto volte. Qui si constata l'assenza del dato, a parole. */}
          <div className="flex flex-col gap-0.5 pt-1">
            <h3 className="text-sm font-semibold text-ink">Codici senza serie</h3>
            <p className="text-xs text-ink-subtle">
              {conteggio(senzaSerie.length)} che il listino non lega a una serie
            </p>
          </div>
          <ul className="list-none overflow-hidden rounded-md border border-line">
            {senzaSerie.map(renderRiga)}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/**
 * L'anteprima di una serie: **56px, FERMA**, e solo dentro una TIPOLOGIA.
 *
 * ⚠️ SEMBRA IL CONTRARIO DEL LIVELLO 1, E NON LO È. Lì `isModello` ACCENDE la
 * foto, qui la SPEGNE. Stesso principio, unità diversa: la tessera di livello 1
 * ritrae il MODELLO INTERO, e una foto lo rappresenta davvero; la riga di
 * livello 2 ritrae UNA SERIE dentro quel modello, e le serie di FEDRA sono la
 * stessa maniglia in varianti — la foto sarebbe identica su ognuna. Dentro una
 * tipologia (BOCCHETTA raccoglie 22 modelli, MANIGLIONE 52) distingue davvero.
 * Chi legge questo codice non lo «corregga» per simmetria.
 *
 * Non si rimpicciolisce aprendo. Era una scelta nostra, e Andrea — che il
 * programma lo usa — l'ha smentita sul campo: «confonde, e da piccola non si
 * vede». Era anche un'animazione di layout, vietata dal sistema.
 *
 * Preview mancante = spazio vuoto, NON segnaposto: con la copertura al 46,5% le
 * assenze sono frequenti, e otto riquadri grigi in colonna si leggono come «il
 * programma è rotto». L'allineamento regge, e l'assenza si dice tacendo.
 */
function AnteprimaSerie({ url }: { url: string | null }) {
  const [fallita, setFallita] = useState(false);
  if (!url || fallita) return <span aria-hidden className="size-14 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFallita(true)}
      className="size-14 shrink-0 rounded border border-line bg-white object-contain"
    />
  );
}

/**
 * Dove si è, e come tornare indietro. Stesso patto dell'archivio serramenti: i
 * filtri attivi sono chip con la ✕, e la ✕ è un link — quindi il tasto indietro
 * del telefono funziona senza che noi lo si gestisca.
 */
export function FiltriSfoglia({
  tipo,
  soloPronta,
  finitura,
}: {
  tipo: string;
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
        // Togliere il gruppo porta all'elenco dei gruppi. Le tendine aperte
        // cadono con lui: fuori dal loro gruppo non individuano nulla.
        href={`/maniglie${coda}`}
        removeLabel={`Togli il gruppo ${tipo}`}
      />
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
