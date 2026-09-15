/**
 * COSA CONTIENE il totale di un articolo — non quanto vale, che è `articleTotal`.
 *
 * Serve perché dal listino Vision 2026 il catalogo ha due convenzioni di prezzo
 * insieme: i 3.456 articoli del 02/26 comprendono il *temporary surcharge* del
 * 3,5 %, i 251 del 05/26 no, perché quel documento non lo dichiara mai. Sotto
 * un'etichetta costante «IVA esclusa» i due numeri si leggono come confrontabili
 * e non lo sono — ed è denaro che dieci agenti pronunciano a un cliente.
 *
 * ⚠️ Il difetto non è ereditato: **lo crea l'import**. Prima delle 251 righe la
 * colonna è omogenea su tutte e 3.456 e l'etichetta è vera. È l'ottava
 * occorrenza della classe già chiusa sette volte in questo progetto
 * (`isAvailable` costante, `openingDir` mai letto, l'entrata cablata a 15, il
 * default `A12_I13_B20`, `PILOT_GEOMETRY` ignorata): un valore plausibile che il
 * sistema decide da sé, che non produce nessun errore e che nessun conteggio
 * rivela.
 *
 * Il discriminante NON è una colonna nuova: è `surcharge === null`, che oggi è
 * esatto (il 3,5 % è presente su tutte e 3.456 le righe vecchie, verificato).
 * Una colonna «edizione» nascerebbe `NULL` su 3.456 righe, cioè la forma della
 * «disponibilità falsa» già rimossa da questo progetto.
 *
 * ⚠️ Il giorno in cui COLOMBO pubblicasse un listino con la maggiorazione su
 * alcune righe e non su altre, il discriminante dovrà diventare l'edizione.
 * Dichiarato ora, costruito allora.
 *
 * La percentuale si **deriva** dai due numeri: mai una seconda costante 3,5 nel
 * codice, o il giorno di un'aliquota diversa l'etichetta mentirebbe.
 *
 * Modulo foglia: nessuna dipendenza, nessun `server-only` — la legge anche la UI.
 */
/**
 * `percento` è `null` quando la percentuale non si può calcolare (prezzo di
 * listino a zero) ma una maggiorazione è comunque dichiarata: sono due cose
 * diverse, e confonderle farebbe dire «il listino non dichiara maggiorazioni»
 * di un totale che ne contiene una.
 */
export type ComposizionePrezzo =
  | { kind: "conMaggiorazione"; percento: number | null }
  | { kind: "netto" };

/**
 * Il DISCRIMINANTE, da solo: il prezzo è quello netto del listino 05/26?
 *
 * Sta qui e non sparso nelle schermate perché è la cosa che il commento sopra
 * avverte dovrà cambiare — il giorno di un listino con la maggiorazione su
 * alcune righe e non su altre diventerà l'edizione. Con `surcharge === null`
 * scritto qui e là, quel giorno la scheda cambierebbe e l'elenco no, senza un
 * errore di compilazione.
 *
 * Prende il solo `surcharge` di proposito: il RAMO non dipende dal prezzo, che
 * serve unicamente a calcolare la percentuale. Così un elenco può chiederlo
 * senza portarsi dietro anche il netto per ogni riga.
 */
export function prezzoNetto(surcharge: number | null): surcharge is null {
  return surcharge === null;
}

export function composizionePrezzo(
  priceList: number,
  surcharge: number | null,
): ComposizionePrezzo {
  // L'unica cosa che decide il RAMO è se il documento dichiari o no una
  // maggiorazione. Il calcolo della percentuale viene dopo, e se non riesce si
  // tace la percentuale — non il ramo.
  if (prezzoNetto(surcharge)) return { kind: "netto" };
  if (priceList === 0) return { kind: "conMaggiorazione", percento: null };
  return { kind: "conMaggiorazione", percento: Math.round((surcharge / priceList) * 1000) / 10 };
}
