import { firstWord, secondToken } from "./taxonomy";

/**
 * CURATELA DELLO SFOGLIO — le correzioni chieste da Andrea sulle etichette di
 * primo livello, dopo aver usato il catalogo vero.
 *
 * Vive QUI e non nell'import, di proposito: riscrivere `articles.name`
 * cancellerebbe la parola scritta da COLOMBO e, in particolare, farebbe sparire
 * `BOCCEHTTA` dall'indice trigram — cioè la proprietà blindata da un test
 * d'integrazione, per cui chi cerca «bocchetta» trova anche l'articolo che il
 * fornitore ha digitato storto. Un pezzo che è sullo scaffale e non si trova è
 * ciò che riporta l'agente al telefono. Il nome storto resta a DB e resta
 * cercabile: cambia solo COME lo si elenca.
 *
 * E vive in un modulo foglia, non in una tabella a DB: quattordici regole che
 * cambiano di rado non valgono una schermata di amministrazione.
 *
 * ⚠️ LE RIMOZIONI VALGONO SOLO PER LO SFOGLIO (decisione dell'utente,
 * 2026-08-04). Chi scrive «vite» nella ricerca continua a trovarla: lo sfoglio
 * serve a guardare, la ricerca a rispondere «esiste? è ordinabile?».
 *
 * ⚠️ Il verdetto del `/llm-council` della sessione precedente diceva
 * «abbreviazioni: nessuna riga di codice, in alfabetico `ROS.` e `ROSETTA` sono
 * adiacenti, la fusione la fa l'occhio». Andrea ha usato la cosa vera e ha
 * chiesto la fusione di otto etichette, incluse esattamente quelle. L'adiacenza
 * era vera e irrilevante: vedere due chip vicine non è avere una voce sola, e
 * chi rifornisce il magazzino conta le voci.
 */

/**
 * Etichette del fornitore che sono la stessa cosa scritta in modi diversi.
 * Misurate sul listino `LP 02-26`: sono le stringhe VERE, non quelle che Andrea
 * ha scritto a memoria.
 */
const FUSIONI: Record<string, string> = {
  BOCCEHTTA: "BOCCHETTA", //      2 codici — refuso del fornitore
  NOTTOLIN: "NOTTOLINO", //       1
  KITPORTE: "KIT", //             1 — «KIT PORTE» è scritto attaccato
  "DUMMY/C": "DUMMY", //          3
  "MOV.GRATZ": "MOVIMENTO", //    1 ┐ Andrea ha detto «Mov.»: sono due etichette
  "MOV.MARTELLINA": "MOVIMENTO", // 2 ┘
  "ROS.": "ROSETTA", //          58
  ROBOCINQUQ: "ROBOCINQUE", //    1 — il codice `ID61RSB` è la serie del base
  ROBOTE: "ROBOTRE", //           1 — il codice `CD92DK` è la serie di Robotre
};

/**
 * Etichette che non si sfogliano: non servono ad Andrea né agli agenti.
 * 63 codici in tutto. Restano cercabili scrivendo.
 *
 * `RONDELLE` (2 codici) NON è qui pur essendo la stessa cosa di `RONDELLA`:
 * Andrea non l'ha citata, e sulla sua tassonomia la fonte di verità è lui, non
 * la simmetria. Idem per gli altri nove casi identici che non ha nominato
 * (`MANIG.`/`MANIGLIA`/`MANIGLIONE`…, `PL.`/`PLACCA`…): vanno mostrati a lui.
 */
const ESCLUSE = new Set(["VITE", "VITI", "RONDELLA", "DADO", "CHIAVE"]);

/**
 * Etichette in cui la «S» del secondo token è un PRODOTTO DIVERSO e non una
 * variante — e non è un'opinione nostra: COLOMBO tiene `01_Robot4.zip` e
 * `01_Robot4S.zip` come archivi fotografici separati, e il suo listino elenca
 * «roboquattro» e «roboquattro S» come voci distinte.
 */
const DIVISE = new Set(["ROBOCINQUE", "ROBOQUATTRO"]);

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
export function browseLabel(name: string): string | null {
  return labelFromTokens(firstWord(name), secondToken(name));
}

/**
 * La stessa regola a partire dai due token già separati — è la forma che serve
 * al livello 1, dove il `GROUP BY` restituisce i token e non le descrizioni.
 * Una regola sola per le due strade: se fossero due potrebbero divergere, e il
 * numero contato non sarebbe più il numero mostrato.
 */
function labelFromTokens(first: string, second: string | null): string | null {
  if (ESCLUSE.has(first)) return null;
  if (DIVISE.has(first) && MARCATORE_S.test(second ?? "")) return `${first} S`;
  return FUSIONI[first] ?? first;
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
export function foldBrowseGroups(rows: TokenCount[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = labelFromTokens(r.first, r.second || null);
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
 * Lista vuota per un'etichetta esclusa: senza, `?tipo=VITE` nell'URL
 * rimetterebbe a schermo un gruppo che abbiamo tolto dall'elenco.
 */
export function sourceFirstWords(label: string): string[] {
  if (ESCLUSE.has(label)) return [];
  const base = label.endsWith(" S") ? label.slice(0, -2) : label;
  if (label.endsWith(" S")) return DIVISE.has(base) ? [base] : [];
  const words = new Set([base]);
  for (const [storta, giusta] of Object.entries(FUSIONI)) {
    if (giusta === label) words.add(storta);
  }
  return [...words].sort();
}
