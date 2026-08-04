/**
 * Normalizzazione del codice articolo: la chiave di aggancio del dominio maniglie.
 *
 * Le tre fonti COLOMBO scrivono lo stesso codice in tre modi (misurato sui file
 * veri, non assunto): il listino con separatori (`0CD41R-CM`), la pronta consegna
 * senza (`0CD41RCM`), il catalogo spaziato (`SE 11 R-RY`). Ridotti ai soli
 * caratteri [A-Z0-9] coincidono, e sui 3.456 codici del listino la riduzione
 * produce ZERO collisioni: è quindi una chiave sicura, non un'euristica.
 *
 * Il vincolo `@@unique([brand, codeNorm])` esiste perché, se un giorno una
 * collisione comparisse davvero, deve far esplodere l'import invece di agganciare
 * in silenzio la riga di giacenza all'articolo sbagliato.
 *
 * Modulo foglia: nessun import, così è usabile da script, router e UI.
 */
export function normalizeArticleCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
