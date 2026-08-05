/**
 * Le tendine aperte dello sfoglio vivono nell'URL, come la ricerca, i filtri e
 * la pagina: «dove si è, sta scritto nella barra». Il link che si manda a un
 * collega apre quello che si sta guardando, il tasto indietro chiude l'ultima
 * tendina, e tornando dalla scheda di un articolo la pagina si ricompone
 * identica — che è ciò che rende sensato il ripristino dello scroll, altrimenti
 * calcolato su una pagina che nel frattempo si è accorciata.
 *
 * Il parametro resta `fam` e non diventa `serie`: i link già condivisi valgono
 * più della coerenza del nome interno, e un vecchio `?fam=CB71R` è già un
 * elenco valido di una voce sola.
 *
 * Modulo foglia, senza dipendenze: lo usano la pagina e i suoi test.
 */

/** Le serie aperte, da `?fam=`. Elenco vuoto se il parametro non c'è. */
export function leggiSerieAperte(param: string | null): string[] {
  if (!param) return [];
  return param
    .split(",")
    .map((s) => decodeURIComponent(s).trim())
    .filter(Boolean);
}

/**
 * `null` quando non c'è nulla di aperto, così il parametro sparisce dall'URL
 * invece di restarci vuoto.
 *
 * I nomi si codificano uno per uno: `HPS/1` è una serie vera del listino, e la
 * sua barra in un URL non è un carattere qualunque.
 */
export function scriviSerieAperte(aperte: string[]): string | null {
  if (aperte.length === 0) return null;
  return aperte.map((s) => encodeURIComponent(s)).join(",");
}
