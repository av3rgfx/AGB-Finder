import { copertinaDiGruppo, etichetteModello } from "./foto-archivio";

/**
 * La chiave Blob da mostrare sulla TESSERA di un gruppo, o `null` per «nessuna
 * area immagine».
 *
 * Due sorgenti in ordine, e nessuna terza:
 *
 *  1. la foto di un suo articolo — **solo** per i gruppi che COLOMBO fotografa
 *     come MODELLO. Alle TIPOLOGIE non si conferisce un esemplare: una foto
 *     sola sarebbe un modello su 56 spacciato per la categoria, e sbaglierebbe
 *     l'OGGETTO là dove la regola delle finiture, che ha già tolto 509 foto,
 *     non tollera nemmeno di sbagliare il COLORE.
 *  2. la copertina DICHIARATA in `FILE_MODELLO`, che esiste anche dove nessun
 *     codice ha una foto provata.
 *
 * `null` non è un ripiego: è la risposta vera per una tipologia — una foto
 * della categoria non esiste — e la tessera la disegna come tessera-parola
 * invece che come riquadro vuoto.
 *
 * ⚠️ Vive in un modulo suo e non nel router perché è una REGOLA DI DOMINIO,
 * come la disponibilità e la serie: al router arriva già decisa.
 */
export function previewDiGruppo(etichetta: string, daArticolo: string | null): string | null {
  if (!etichetteModello().has(etichetta)) return null;
  return daArticolo ?? copertinaDiGruppo(etichetta);
}
