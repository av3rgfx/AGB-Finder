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
  const w = firstWord(name);
  if (ESCLUSE.has(w)) return null;
  if (DIVISE.has(w) && MARCATORE_S.test(secondToken(name) ?? "")) return `${w} S`;
  return FUSIONI[w] ?? w;
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
