import { familyOf } from "./taxonomy";

/**
 * SFOGLIO, livello 2: le SERIE dentro un gruppo di primo livello.
 *
 * «Serie» è la parola di COLOMBO per questa cosa — l'indice del suo listino
 * stampa «130 round ID25», «128 robot CD45» — ed è già il nome del campo in
 * `foto-archivio.ts`. Prima si chiamava «famiglia», che a schermo non era mai
 * stata introdotta e che in «Senza famiglia» suonava come un errore d'importazione.
 *
 * TypeScript puro, non raw SQL, e non è una preferenza di stile: «qual è la
 * serie» è una REGOLA DI DOMINIO, e nel reparto maniglie le regole di dominio
 * stanno fuori dalle query — come la disponibilità, che vive in
 * `stock-status.ts` tutta in Prisma proprio per non finire dentro un `$queryRaw`.
 *
 * Il costo è nullo: il gruppo più numeroso del listino vero è MANIGLIONE con 338
 * righe, e sono già state lette per contarle.
 *
 * ⚠️ LA CLASSIFICAZIONE AVVIENE SULL'INSIEME INTERO DEL GRUPPO. I filtri
 * («solo pronta consegna», finitura) restringono ciò che si MOSTRA, mai ciò che
 * si è deciso: i gradini 2 e 3 dipendono dall'insieme, e classificare DOPO il
 * filtro spostava 27 articoli su 3.393 in una serie diversa — con un URL
 * condiviso che puntava a una tendina inesistente.
 *
 * Misurato sul listino vero (3.456 codici, `LP 02-26`): 591 serie, il 98,2% dei
 * codici sfogliabili ne ha una, e solo il 7,3% delle serie è da un codice solo.
 */

export interface BrowseRow {
  id: string;
  code: string;
  codeNorm: string;
  name: string;
  /** Chiave Blob della foto, o `null`. Serve alla foto rappresentativa. */
  imageUrl?: string | null;
}

export interface SerieGroup {
  serie: string;
  /** Le righe VISIBILI di quella serie, nell'ordine ricevuto. */
  rows: BrowseRow[];
  count: number;
}

const norm = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();

/** Un nome di serie sotto i due caratteri aggancerebbe per puro caso. */
const MIN_SERIE = 2;

/**
 * La RADICE del codice: senza lo zero di testa (un marcatore COLOMBO, non parte
 * della serie) e senza la coda dopo l'ultimo trattino.
 *
 * ⚠️ NON è `nucleo()` di `foto-archivio.ts`, e le due non vanno unificate:
 * quella toglie la coda UFFICIALE (le 31 finiture pubblicate) e pretende almeno
 * cinque caratteri, perché risponde a un'altra domanda — quale foto ritrae
 * questo codice. Qui la coda si toglie qualunque essa sia, perché le code vere
 * del listino sono 57 e le 26 non pubblicate sono bicolori (`CR8`, `GLS`, `OL9`):
 * usando l'elenco ufficiale, MILLA finiva 28 su 28 e ALBA 21 su 21 in serie da
 * un codice solo.
 */
export function radiceCodice(code: string): string {
  const i = code.lastIndexOf("-");
  return norm(i > 0 ? code.slice(0, i) : code).replace(/^0/, "");
}

/**
 * id → serie, per tutte le righe del gruppo. Chi non ce l'ha non compare.
 *
 * Tre gradini in ordine di forza, e nessuno inventa una grammatica dei codici:
 * si uniscono solo codici che condividono un prefisso LETTERALE scritto da
 * COLOMBO. (Il divieto della spec 2026-08-04 §9 vieta di parsificare il codice,
 * e il suo controesempio regge: `0CD63FP-CM` e `0CD63GB-CM` danno `CD63FP` e
 * `CD63GB`, quindi restano separati.)
 */
export function serieDelGruppo(all: BrowseRow[], groupWord: string): Map<string, string> {
  const out = new Map<string, string>();
  const senza: BrowseRow[] = [];

  // 1. Il token della descrizione che compare ANCHE nel codice: due campi
  //    scritti entrambi da COLOMBO. Copre il 77,8%.
  //    Si scarta la serie degenere (uguale alla parola del gruppo): è il caso di
  //    `KIT PORTE SCORREVOLI` col codice `XKIT/PS-CM`, dove «KIT» sta dentro il
  //    codice. «KIT › KIT» non divide nulla, ripete l'etichetta di sopra e fa
  //    sembrare classificato ciò che non lo è.
  for (const r of all) {
    const fam = familyOf(r.name, r.codeNorm);
    if (fam !== null && fam !== groupWord) out.set(r.id, fam);
    else senza.push(r);
  }

  // 2. Assorbimento in una serie GIÀ ESISTENTE del gruppo. Non inventa niente:
  //    quella serie esiste perché COLOMBO l'ha scritta nella descrizione di
  //    un'altra riga.
  //    a) IDENTITÀ (+17 codici): la radice È la stessa stringa del nome della
  //       serie. Non è un'inferenza. È il caso di `0ID51RSB-NM`, che la
  //       descrizione lascia fuori scrivendo `S'ID51RSB` senza lo spazio.
  //    b) PREFISSO UNICO (+276): la radice comincia con UNA SOLA serie
  //       esistente. È il caso portato dal campo: `0ID51RSMY-CM` → `ID51R`,
  //       fuori perché la descrizione dice `ID51RY` e il codice `ID51RSMY`.
  //    Con più candidate e nessuna identica (forma `AC11`/`AC11R`/`AC11RSM`)
  //    NON si assorbe: sceglierne una sarebbe una nostra decisione mai
  //    dichiarata. Cade al gradino 3, dove i cinque `0AC11RSMY-*` di FEDRA
  //    formano la loro serie da soli.
  const esistenti = [...new Set(out.values())].filter((s) => norm(s).length >= MIN_SERIE);
  const restano: BrowseRow[] = [];
  for (const r of senza) {
    const radice = radiceCodice(r.code);
    const cand = esistenti.filter((s) => radice.startsWith(norm(s)));
    const identica = cand.find((s) => norm(s) === radice);
    if (identica !== undefined) out.set(r.id, identica);
    else if (cand.length === 1) out.set(r.id, cand[0]!);
    else restano.push(r);
  }

  // 3. Radici condivise da ALMENO DUE codici (+400 in 58 voci). La soglia non è
  //    un numero arbitrario travestito: una tendina che contiene una riga sola è
  //    un involucro attorno a una riga, non una categoria. È qui che ROSETTA
  //    passa da 80 codici sciolti su 105 a zero.
  const perRadice = new Map<string, BrowseRow[]>();
  for (const r of restano) {
    const k = radiceCodice(r.code);
    if (k.length < MIN_SERIE) continue;
    if (!perRadice.has(k)) perRadice.set(k, []);
    perRadice.get(k)!.push(r);
  }
  for (const [k, righe] of perRadice) {
    if (righe.length < 2 || k === norm(groupWord)) continue;
    for (const r of righe) out.set(r.id, k);
  }

  return out;
}

/**
 * Il gruppo diviso: le serie con le loro righe VISIBILI, e i codici che una
 * serie non ce l'hanno.
 *
 * `visible` è l'insieme degli id che i filtri lasciano passare; `undefined`
 * significa «nessun filtro». La classificazione usa SEMPRE `all`: una serie
 * senza righe visibili si nasconde, ma nessun articolo cambia serie.
 *
 * Le due parti tornano insieme di proposito: chi chiedesse le sole serie
 * lascerebbe fuori dallo schermo dei codici che hanno prezzo e disponibilità —
 * invisibili a chi sfoglia, e invisibili anche a chi scrive il codice, perché
 * nessun conteggio andrebbe a zero.
 */
export function splitGroup(
  all: BrowseRow[],
  groupWord: string,
  visible?: ReadonlySet<string>,
): { serie: SerieGroup[]; senzaSerie: BrowseRow[] } {
  const mappa = serieDelGruppo(all, groupWord);
  const per = new Map<string, BrowseRow[]>();
  const senzaSerie: BrowseRow[] = [];

  for (const r of all) {
    if (visible !== undefined && !visible.has(r.id)) continue;
    const s = mappa.get(r.id);
    if (s === undefined) {
      senzaSerie.push(r);
      continue;
    }
    if (!per.has(s)) per.set(s, []);
    per.get(s)!.push(r);
  }

  const serie = [...per.entries()]
    .map(([nome, rows]) => ({ serie: nome, rows, count: rows.length }))
    .sort((a, b) => b.count - a.count || a.serie.localeCompare(b.serie));

  return { serie, senzaSerie };
}

/**
 * La foto che rappresenta un insieme di righe: la prima PER CODICE fra quelle
 * che ne hanno una.
 *
 * Riceve le righe VISIBILI, non tutte, e non ripiega sull'insieme intero: col
 * filtro colore acceso su Neromat la serie non deve mostrarsi in cromo, e una
 * foto presa da una riga che il filtro ha tolto illustrerebbe la vista con un
 * pezzo che lì non c'è.
 *
 * Dentro una serie tutti i codici sono lo stesso modello in finiture diverse,
 * quindi l'arbitrio si riduce alla finitura — ed è l'ordine del codice a
 * deciderla, in modo deterministico e testabile. Misurato: 376 serie su 533 ne
 * hanno una; per le altre il chiamante disegna il segnaposto neutro.
 */
export function fotoRappresentativa(rows: BrowseRow[]): string | null {
  let scelta: BrowseRow | null = null;
  for (const r of rows) {
    if (!r.imageUrl) continue;
    if (scelta === null || r.code.localeCompare(scelta.code) < 0) scelta = r;
  }
  return scelta?.imageUrl ?? null;
}
