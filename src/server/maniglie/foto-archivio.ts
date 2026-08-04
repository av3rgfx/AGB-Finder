import { browseLabel } from "./curatela";
import { FINITURE_PER_CODICE, finituraDiCodice } from "./finiture";

/**
 * L'ARCHIVIO FOTOGRAFICO UFFICIALE COLOMBO, mappato al catalogo.
 * (area download, sezione PHOTO ARCHIVE: 79 zip, 3,5 GB, 707 JPEG **CMYK**)
 *
 * L'unità è l'ARCHIVIO, non il gruppo di sfoglio: `01_Fedra/` *è* l'etichetta, non
 * un titolo da decifrare. Ma un gruppo a volte ne ospita DUE — la maniglia e il
 * pomolo, o due serie dello stesso nome commerciale — e allora la cartella da sola
 * non sceglie: serve la `serie`, cioè il prefisso di codice, e la si dichiara SOLO
 * dove COLOMBO l'ha scritta.
 *
 * `etichetta: null` = quell'archivio non aggancia articoli per nome di modello.
 * Tre ragioni diverse, annotate riga per riga: prodotto non ancora a listino ·
 * accessori (lì il codice sta nel nome del file, e ci pensa il gradino 3) · **serie
 * non decidibile**. L'ultima è quella che conta: la serie sbagliata produce una
 * foto che esiste, si vede benissimo ed è di un altro prodotto — nessun errore,
 * nessun warning, nessuno se ne accorge.
 *
 * La tabella è scritta a mano riga per riga, comprese le 48 che sono l'identità:
 * una tabella che si calcola da sé nasconde i casi in cui il calcolo sbaglia, ed è
 * esattamente sui casi storti (`01_Robot4` → ROBOQUATTRO) che serve.
 */
export interface VoceArchivio {
  /** Etichetta di sfoglio, post-curatela. `null` = nessun aggancio per modello. */
  etichetta: string | null;
  /** Prefisso di codice; solo dove un'etichetta ha più archivi. */
  serie?: string;
}

export const ARCHIVI: Record<string, VoceArchivio> = {
  // ── prodotti nuovi: a catalogo 2026, non ancora a listino ───────────────────
  // Non è un difetto: quando COLOMBO li metterà a listino si aggancieranno da soli.
  "00a_Laconica": { etichetta: null },
  "00b_Robot6": { etichetta: null },
  "00c_Robot6S": { etichetta: null },
  "00d_Halo": { etichetta: null },
  "00e_Kubo": { etichetta: null },

  // ── modelli: un archivio, un'etichetta ─────────────────────────────────────
  "01_963": { etichetta: "963" },
  "01_Alato": { etichetta: "ALATO" },
  "01_Alba": { etichetta: "ALBA" },
  "01_Ama": { etichetta: "AMA" },
  "01_Blazer": { etichetta: "BLAZER" },
  "01_Cameo": { etichetta: "CAMEO" },
  "01_Daytona": { etichetta: "DAYTONA" },
  "01_Dea": { etichetta: "DEA" },
  "01_Drop": { etichetta: "DROP" },
  "01_Edo": { etichetta: "EDO" },
  "01_Electra": { etichetta: "ELECTRA" },
  "01_Elle": { etichetta: "ELLE" },
  "01_Ellesse": { etichetta: "ELLESSE" },
  "01_Esprit": { etichetta: "ESPRIT" },
  "01_Fedra": { etichetta: "FEDRA" },
  "01_Flessa": { etichetta: "FLESSA" },
  "01_Gaia": { etichetta: "GAIA" },
  "01_Gira": { etichetta: "GIRA" },
  "01_Gryps": { etichetta: "GRYPS" },
  "01_Heidi": { etichetta: "HEIDI" },
  "01_Ida": { etichetta: "IDA" },
  "01_Isy": { etichetta: "ISY" },
  "01_Lara": { etichetta: "LARA" },
  "01_Libra": { etichetta: "LIBRA" },
  "01_Lund": { etichetta: "LUND" },
  "01_Mach": { etichetta: "MACH" },
  "01_Madi": { etichetta: "MADI" },
  "01_Mapo": { etichetta: "MAPO" },
  "01_Meta": { etichetta: "META" },
  "01_Mixa": { etichetta: "MIXA" },
  "01_Moon": { etichetta: "MOON" },
  "01_Olly": { etichetta: "OLLY" },
  "01_Peak": { etichetta: "PEAK" },
  "01_Pegaso": { etichetta: "PEGASO" },
  "01_Peter": { etichetta: "PETER" },
  "01_Piuma": { etichetta: "PIUMA" },
  "01_Sirio": { etichetta: "SIRIO" },
  "01_Slim": { etichetta: "SLIM" },
  "01_Star": { etichetta: "STAR" },
  "01_Tacta": { etichetta: "TACTA" },
  "01_Taipan": { etichetta: "TAIPAN" },
  "01_Tecno": { etichetta: "TECNO" },
  "01_Tender": { etichetta: "TENDER" },
  "01_Tool": { etichetta: "TOOL" },
  "01_Twitty": { etichetta: "TWITTY" },
  "01_Viola": { etichetta: "VIOLA" },
  "01_Wing": { etichetta: "WING" },
  "01_Zelda": { etichetta: "ZELDA" },

  // ── la serie ROBOTECH: sigle interne, tradotte ─────────────────────────────
  // `Robot2` non è «Robot 2»: è ROBODUE. La traduzione è verificata sul listino
  // (ognuna di queste etichette esiste, e il gate d'integrazione lo prova).
  "01_Robot2": { etichetta: "ROBODUE" },
  "01_Robot3": { etichetta: "ROBOTRE" },
  "01_Robot4": { etichetta: "ROBOQUATTRO" },
  "01_Robot4S": { etichetta: "ROBOQUATTRO S" },
  "01_Robot5": { etichetta: "ROBOCINQUE" },
  "01_Robot5S": { etichetta: "ROBOCINQUE S" },
  // ROBOT ha due archivi: i nomi dei file dicono `robot41_*` e `robot75_*`, e
  // l'indice del listino COLOMBO stampa «robot CD41» fra le maniglie e
  // «robot CD75» fra i pomoli. La serie è scritta, non dedotta.
  "01_Robot1_m": { etichetta: "ROBOT", serie: "CD41" },
  "01_Robot1_p": { etichetta: "ROBOT", serie: "CD75" },

  // ── MOOD Collection: One/OneQ e Due/DueQ ───────────────────────────────────
  // Le pagine prodotto del listino COLOMBO stampano CC11 sotto «One», CC21 sotto
  // «OneQ», CC31 sotto «Due» e CC41 sotto «DueQ»; i nomi dei file distinguono
  // `one …` da `oneq …`. Nel listino UFP la descrizione NON dice mai «Q»: senza
  // la serie i due archivi finirebbero sulla stessa etichetta.
  "01_One": { etichetta: "ONE", serie: "CC11" },
  "01_One Q": { etichetta: "ONE", serie: "CC21" },
  "01_Due": { etichetta: "DUE", serie: "CC31" },
  "01_Due Q": { etichetta: "DUE", serie: "CC41" },

  // ── BOLD: `_p` è il POMOLO, e il pomolo bold non è nel listino 2026 ─────────
  // (la sua foto in `02_Pomoli/bold_45.jpg` resta infatti senza articolo).
  // Quindi `_m` non è ambiguo e non ha bisogno di una serie.
  "01_Bold_m": { etichetta: "BOLD" },
  "01_Bold_p": { etichetta: null },

  // ── i tre casi NON DECIDIBILI ──────────────────────────────────────────────
  // SPIDER ha due maniglie a listino (MR11 e MR15), MILLA due (LC31, LC41),
  // TRAMA due (LC71, LC81). Gli archivi sono due per ciascuno, ma l'ordinale
  // della cartella non è la serie e nessuna fonte di COLOMBO li accoppia.
  // 66 codici restano senza foto: è il prezzo dichiarato di non indovinare.
  // → domanda aperta per COLOMBO (handoff.md §DA CHIEDERE).
  "01_Spider_m": { etichetta: null },
  "01_Spider_p": { etichetta: null },
  "01_Milla_1": { etichetta: null },
  "01_Milla_2": { etichetta: null },
  "01_Trama_1": { etichetta: null },
  "01_Trama_2": { etichetta: null },

  // ── accessori: qui il codice sta nel NOME DEL FILE (gradino 3) ─────────────
  // Sono le sezioni che per nome di modello sarebbero irraggiungibili —
  // maniglioni, pomoli, incasso, blindate, complementi — e agganciano 322 codici.
  "02_Pomoli": { etichetta: null },
  "03_Maniglioni_Pulls": { etichetta: null },
  "04_Incasso_Flush handles": { etichetta: null },
  "05_Blindate_Armored door": { etichetta: null },
  "06_Complementi": { etichetta: null },
  "07_Kombo_Box": { etichetta: null },
};

/**
 * Uno scatto d'ambiente non è una foto di prodotto: `Robo4_def.jpg` è 8268×7087,
 * 34 MB, la maniglia su fondo colorato con ombre lunghe. In una griglia di
 * miniature su bianco stona, e non dice nulla in 44 pixel. Sono 68 file su 707, e
 * si riconoscono dal suffisso `_def` o dal nome della campagna (`Mood`, `IMG_`).
 */
export function scattoDiProdotto(nome: string): boolean {
  // Per parole intere, e non con `\b`: in `03_Mood ocean` il confine fra `_` e
  // `m` non è un confine di parola per una regexp, perché `_` è un carattere di
  // parola — e quel file sarebbe passato.
  const parole = nome.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return (
    parole.at(-1) !== "def" && !parole.includes("mood") && !parole.includes("img")
  );
}

/**
 * La finitura che COLOMBO ha scritto in coda al nome come SUO codice: `Fedra_1OL`,
 * `robot41_4NM_new`. Le parole per esteso non contano — `cromo` compare in 106
 * nomi e `bronze` in 18, due lingue e nessun elenco chiuso — e i bicolori
 * (`milla1_1OLOM`) non sono fra le 31 pubblicate.
 */
export function finituraDiFoto(nome: string): string | null {
  const m = /[ _-]\d(C\d\d|[A-Z]{2})(_new)?$/i.exec(nome);
  if (!m) return null;
  const codice = m[1]!.toUpperCase();
  return FINITURE_PER_CODICE.has(codice) ? codice : null;
}

/**
 * La variante ZERO (rosetta a scomparsa) è un prodotto a sé: 156 codici a listino
 * la nominano nella descrizione e 71 file dell'archivio nel nome. Sono due parole
 * scritte da COLOMBO in due posti diversi, e devono combaciare — la foto liscia su
 * un articolo ZERO è la foto sbagliata, non una foto approssimata.
 */
export function varianteZero(s: string): boolean {
  return /\bzero\b/i.test(s);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * La chiave Blob è DERIVATA dalla sorgente, non dall'articolo: due articoli che
 * condividono la foto condividono il file, e lo script la carica una volta sola.
 * Verificato sui 707 nomi veri: zero collisioni.
 */
export function chiaveFoto(archivio: string, nome: string): string {
  return `maniglie/colombo/${slug(archivio)}/${slug(nome)}`;
}

// ═══════════════════════════════════════════════════════════════
// L'ABBINAMENTO
// ═══════════════════════════════════════════════════════════════

export interface FotoArchivio {
  /** Cartella dello zip, senza `.zip`: `01_Fedra`. */
  archivio: string;
  /** Nome del file senza estensione: `Fedra_1OL`. */
  nome: string;
}

export interface ArticoloDaAbbinare {
  id: string;
  code: string;
  codeNorm: string;
  name: string;
}

/** Lo 0 di testa è un marcatore COLOMBO, non parte della serie. */
const senzaZeroIniziale = (codeNorm: string) => codeNorm.replace(/^0/, "");

/** Sotto i cinque caratteri un nucleo comparirebbe in un nome per puro caso. */
const MIN_NUCLEO = 5;

/** Il nucleo del codice: senza lo 0 di testa e senza la coda di finitura. */
function nucleo(a: ArticoloDaAbbinare): string {
  const fin = finituraDiCodice(a.code);
  const senzaCoda = fin ? a.code.slice(0, a.code.lastIndexOf("-")) : a.code;
  return senzaZeroIniziale(senzaCoda.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
}

/**
 * Articolo → chiave Blob della sua foto. Gli articoli senza foto **non compaiono**
 * nella mappa: `undefined` è la risposta, e non esiste una chiave «di riserva».
 *
 * Tre gradini, in ordine di forza, e tutti e tre sono cose che COLOMBO ha scritto:
 *
 *  3. il **codice** dell'articolo è nel nome del file (`ID313 RS_45.jpg`). È
 *     l'unica affermazione che COLOMBO faccia su un codice d'ordine, quindi vince
 *     su tutto, e raggiunge maniglioni, pomoli, bocchette e complementi — che per
 *     nome di modello sarebbero irraggiungibili. 322 codici sul listino vero.
 *  2. la **finitura** del file è quella dell'articolo (`Fedra_1OL` → `0AC11R-OL`):
 *     l'agente vede il colore che il cliente comprerà. 994 codici.
 *  1. la foto del **modello**, in una finitura qualunque. 679 codici.
 *
 * Su tutti e tre pesa il filtro della variante ZERO, e sul gradino 1 la `serie`
 * dichiarata in `ARCHIVI`.
 */
export function abbinaFoto(
  articoli: ArticoloDaAbbinare[],
  foto: FotoArchivio[],
): Map<string, string> {
  const usabili = foto
    .filter((f) => scattoDiProdotto(f.nome))
    .map((f) => ({
      archivio: f.archivio,
      chiave: chiaveFoto(f.archivio, f.nome),
      nomeNorm: f.nome.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      finitura: finituraDiFoto(f.nome),
      zero: varianteZero(f.nome),
    }))
    // Ordine stabile: l'abbinamento non deve dipendere dall'ordine in cui si sono
    // letti gli zip, o la stessa richiesta darebbe due chiavi diverse a due run.
    .sort((a, b) => a.chiave.localeCompare(b.chiave));

  const out = new Map<string, string>();
  for (const a of articoli) {
    const nu = nucleo(a);
    if (nu.length >= MIN_NUCLEO) {
      const perCodice = usabili.filter((f) => f.nomeNorm.includes(nu));
      if (perCodice.length > 0) {
        // Il match più lungo: fra `PB13` e `PB1304` vince chi dice di più.
        const scelta = [...perCodice].sort(
          (x, y) => y.nomeNorm.length - x.nomeNorm.length || x.chiave.localeCompare(y.chiave),
        )[0]!;
        out.set(a.id, scelta.chiave);
        continue;
      }
    }

    const etichetta = browseLabel(a.name);
    if (etichetta === null) continue;
    const zero = varianteZero(a.name);
    const serieDelCodice = senzaZeroIniziale(a.codeNorm);
    const candidate = usabili.filter((f) => {
      const voce = ARCHIVI[f.archivio];
      if (!voce || voce.etichetta !== etichetta) return false;
      if (voce.serie && !serieDelCodice.startsWith(voce.serie)) return false;
      return f.zero === zero;
    });
    if (candidate.length === 0) continue;

    const finitura = finituraDiCodice(a.code);
    const esatta = finitura ? candidate.find((f) => f.finitura === finitura) : undefined;
    out.set(a.id, (esatta ?? candidate[0]!).chiave);
  }
  return out;
}
