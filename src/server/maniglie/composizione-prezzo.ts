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
export type ComposizionePrezzo =
  | { kind: "conMaggiorazione"; percento: number }
  | { kind: "netto" };

export function composizionePrezzo(
  priceList: number,
  surcharge: number | null,
): ComposizionePrezzo {
  if (surcharge === null) return { kind: "netto" };
  // Un listino a zero non esiste, ma dividerci produrrebbe NaN o Infinity in
  // un'etichetta mostrata a schermo.
  if (priceList === 0) return { kind: "netto" };
  return { kind: "conMaggiorazione", percento: Math.round((surcharge / priceList) * 1000) / 10 };
}
