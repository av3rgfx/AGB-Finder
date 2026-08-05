import { firstWord, secondToken } from "./taxonomy";

/**
 * CURATELA DELLO SFOGLIO — le correzioni alle etichette di primo livello.
 *
 * Vive QUI e non nell'import, di proposito: riscrivere `articles.name`
 * cancellerebbe la parola scritta da COLOMBO e, in particolare, farebbe sparire
 * `BOCCEHTTA` dall'indice trigram — cioè la proprietà blindata da un test
 * d'integrazione, per cui chi cerca «bocchetta» trova anche l'articolo che il
 * fornitore ha digitato storto. Un pezzo che è sullo scaffale e non si trova è
 * ciò che riporta l'agente al telefono. Il nome storto resta a DB e resta
 * cercabile: cambia solo COME lo si elenca.
 *
 * E vive in un modulo foglia, non in una tabella a DB: sedici regole che
 * cambiano di rado non valgono una schermata di amministrazione. Il segnale per
 * cambiare idea non è il numero di voci, è la prima volta che qualcuno aspetta
 * un deploy per una correzione urgente.
 *
 * ⚠️ LE RIMOZIONI VALGONO SOLO PER LO SFOGLIO (decisione dell'utente,
 * 2026-08-04). Chi scrive «vite» nella ricerca continua a trovarla: lo sfoglio
 * serve a guardare, la ricerca a rispondere «esiste? è ordinabile?».
 */

/**
 * Le tabelle sono PER MARCA.
 *
 * `browseLabel` non aveva `brand`, e con HOPPE, OLIVARI, DND e GHIDINI in
 * arrivo le correzioni scritte guardando il listino COLOMBO si sarebbero
 * applicate in silenzio alle loro etichette: nessun conteggio sarebbe andato a
 * zero, e nessuno se ne sarebbe accorto. Costa un parametro oggi, un incidente
 * invisibile alla marca #3.
 */
interface Curatela {
  /** Etichette del fornitore che sono la stessa cosa scritta in modi diversi. */
  fusioni: Record<string, string>;
  /** Etichette che non si sfogliano. Restano cercabili scrivendole. */
  escluse: ReadonlySet<string>;
  /** Etichette in cui la «S» del secondo token è un PRODOTTO DIVERSO. */
  divise: ReadonlySet<string>;
}

const CURATELE: Record<string, Curatela> = {
  COLOMBO: {
    // Misurate sul listino `LP 02-26`: sono le stringhe VERE, non quelle
    // scritte a memoria.
    fusioni: {
      BOCCEHTTA: "BOCCHETTA", //          2 codici — refuso del fornitore
      NOTTOLIN: "NOTTOLINO", //           1
      KITPORTE: "KIT", //                 1 — «KIT PORTE» è scritto attaccato
      "DUMMY/C": "DUMMY", //              3
      "MOV.GRATZ": "MOVIMENTO", //        1 ┐ Andrea ha detto «Mov.»: sono due
      "MOV.MARTELLINA": "MOVIMENTO", //   2 ┘ etichette
      "ROS.": "ROSETTA", //              58
      ROBOCINQUQ: "ROBOCINQUE", //        1 — il codice `ID61RSB` è del base
      ROBOTE: "ROBOTRE", //               1 — il codice `CD92DK` è di Robotre

      // ── 2026-08-05, chieste dal titolare e misurate ─────────────────────
      // Le quattro etichette «maniglia» dicono TUTTE «INCASSO»: 56 righe su
      // 57, 4 su 4, 28 su 28, 1 su 1. La voce fusa lo dice, o prometterebbe
      // tutte le maniglie e ne conterebbe 90 — mentre le 129 di ROBOT sono
      // maniglie che stanno in un'altra voce. Sarebbe un avanzo con nome di
      // categoria.
      "MANIG.": "MANIGLIA INCASSO", //   57
      "MANIG.INCASSO": "MANIGLIA INCASSO", // 4
      MANIGLIA: "MANIGLIA INCASSO", //   28
      MANIGLIE: "MANIGLIA INCASSO", //    1
      MANIGLIONI: "MANIGLIONE", //        8 — plurale
      RG: "DUMMY", //                     1 — «RG ADAPTOR PER DUMMY»

      // ── 2026-08-05, seconda tornata di Andrea ──────────────────────────
      // `PL.` è l'abbreviazione di `PLACCA`. La sessione precedente le teneva
      // separate perché MISURATE come due prodotti (placche in ottone `PB02*`
      // contro placche dei maniglioni `0AM113PL*`), e la misura era giusta ma
      // rispondeva alla domanda sbagliata: non «sono lo stesso oggetto» ma
      // «come li chiama chi li ordina». La distinzione non si perde — la fa il
      // livello 2, che divide gli 87 codici in 14 serie.
      "PL.": "PLACCA", //                22
      "PL.OTT.": "PLACCA", //             1
      "PL.OTT.YALE": "PLACCA", //        11
      // Il plurale, che arriva sciogliendo `COPPIA`: senza questa riga
      // «COPPIA BOCCHETTE YALE» fonderebbe un gruppo nuovo da 28 codici, e
      // nessun conteggio andrebbe a zero. Trovato misurando, non leggendo.
      BOCCHETTE: "BOCCHETTA", //         28 (via COPPIA)
      // Le due cremonesi tornano dalla loro maniglia. ⚠️ La foto NON le segue:
      // ci pensa la `serie` dichiarata sugli archivi in `foto-archivio.ts`,
      // perché la regola sulle finiture NON basterebbe — `0CD32-UB`
      // prenderebbe `Heidi_R_UB`, finitura provata GIUSTA e prodotto
      // SBAGLIATO.
      "HEIDI/PETER": "HEIDI", //          2
      LUNDCREM: "LUND", //                1
    },
    // `RONDELLE` (2 codici) entra qui il 2026-08-05, e non è una svista di
    // tassonomia: la pagina dichiarava già «viti, dadi, chiavi e rondelle non
    // si sfogliano» mentre esclusa era solo `RONDELLA`. Era una frase falsa a
    // schermo.
    escluse: new Set(["VITE", "VITI", "RONDELLA", "RONDELLE", "DADO", "CHIAVE"]),
    // Non è un'opinione nostra: COLOMBO tiene `01_Robot4.zip` e
    // `01_Robot4S.zip` come archivi fotografici separati, e il suo listino
    // elenca «roboquattro» e «roboquattro S» come voci distinte.
    divise: new Set(["ROBOCINQUE", "ROBOQUATTRO"]),
  },
};

/** Una marca senza curatela non riceve le correzioni scritte per un'altra. */
const VUOTA: Curatela = { fusioni: {}, escluse: new Set(), divise: new Set() };
const curatelaDi = (brand: string): Curatela => CURATELE[brand] ?? VUOTA;

/**
 * Il marcatore della S, in tutte e tre le forme che il listino usa davvero:
 * `S` (77 righe), `S'` (21) e `S'ID51RSB` (1, con lo spazio mancante). Leggerne
 * una sola spaccherebbe il gruppo a metà **senza che nulla vada a zero**.
 */
const MARCATORE_S = /^S'?$|^S'/;

/**
 * L'etichetta sotto cui una riga si elenca nello sfoglio.
 * `null` = non si sfoglia (ma resta cercabile).
 */
export function browseLabel(brand: string, name: string): string | null {
  return labelFromTokens(brand, firstWord(name), secondToken(name));
}

/**
 * La stessa regola a partire dai due token già separati — è la forma che serve
 * al livello 1, dove il `GROUP BY` restituisce i token e non le descrizioni.
 * Una regola sola per le due strade: se fossero due potrebbero divergere, e il
 * numero contato non sarebbe più il numero mostrato.
 */
function labelFromTokens(brand: string, first: string, second: string | null): string | null {
  const c = curatelaDi(brand);
  if (c.escluse.has(first)) return null;
  if (c.divise.has(first) && MARCATORE_S.test(second ?? "")) return `${first} S`;
  return c.fusioni[first] ?? first;
}

/** Una riga del `GROUP BY` di livello 1: i due token e quanti codici. */
export interface TokenCount {
  first: string;
  second: string;
  count: number;
}

/**
 * I gruppi da mostrare, curati e sommati. In ordine alfabetico italiano, deciso
 * QUI e non con un `ORDER BY`: la collation è del database e può differire fra
 * il Postgres locale e Neon, mentre l'ordine è una promessa fatta a schermo.
 */
export function foldBrowseGroups(
  brand: string,
  rows: TokenCount[],
): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = labelFromTokens(brand, r.first, r.second || null);
    if (label === null) continue;
    counts.set(label, (counts.get(label) ?? 0) + r.count);
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => a.word.localeCompare(b.word, "it"));
}

/**
 * Le prime parole del listino che possono produrre quell'etichetta — il verso
 * inverso di `browseLabel`, per il `WHERE` di chi sa leggere solo la parola
 * cruda. Chi le usa DEVE poi rifiltrare con `browseLabel`: le divisioni
 * condividono la sorgente col loro gruppo base.
 *
 * `base` si include sempre, anche quando è un'etichetta coniata dalla fusione
 * (`MANIGLIA INCASSO`, che contiene uno spazio e quindi non può essere la prima
 * parola di nulla): un valore in più nella `IN` non aggancia niente, e il
 * rifiltro con `browseLabel` esclude comunque i falsi positivi. La regola più
 * semplice che funziona.
 *
 * Lista vuota per un'etichetta esclusa: senza, `?tipo=VITE` nell'URL
 * rimetterebbe a schermo un gruppo che abbiamo tolto dall'elenco.
 */
export function sourceFirstWords(brand: string, label: string): string[] {
  const c = curatelaDi(brand);
  if (c.escluse.has(label)) return [];
  const base = label.endsWith(" S") ? label.slice(0, -2) : label;
  if (label.endsWith(" S")) return c.divise.has(base) ? [base] : [];
  const words = new Set([base]);
  for (const [storta, giusta] of Object.entries(c.fusioni)) {
    if (giusta === label) words.add(storta);
  }
  return [...words].sort();
}

/**
 * L'etichetta corrente per un `tipo` che arriva dall'URL.
 *
 * Un link condiviso prima di una fusione porta la parola VECCHIA: senza questa
 * risoluzione il gruppo si aprirebbe vuoto, perché `articleIdsByFirstWord`
 * rifiltra con `browseLabel` e nessuna riga risponde più a quel nome. Uno
 * schermo vuoto senza spiegazione, su un link che prima funzionava.
 *
 * `null` = quella parola non si sfoglia.
 */
export function resolveLabel(brand: string, tipo: string): string | null {
  const c = curatelaDi(brand);
  if (c.escluse.has(tipo)) return null;
  return c.fusioni[tipo] ?? tipo;
}

/**
 * Tutte le prime parole citate dalle tabelle di una marca.
 *
 * Serve al gate che impedisce alla curatela di marcire: il test esistente
 * verifica solo che le etichette storte NON compaiano, e passerebbe identico il
 * giorno in cui COLOMBO corregge `BOCCEHTTA` e la voce diventa morta. Una voce
 * morta non si vede a schermo, perché nessun conteggio va a zero.
 */
export function vociCuratela(brand: string): string[] {
  const c = curatelaDi(brand);
  return [...Object.keys(c.fusioni), ...c.escluse, ...c.divise].sort();
}
