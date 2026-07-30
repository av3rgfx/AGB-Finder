/**
 * Aritmetica dello sconto cliente.
 *
 * PURO DI PROPOSITO: niente Prisma, niente `server-only`. È aritmetica, e la
 * stessa funzione serve al router e al componente che mostra il riepilogo —
 * duplicarla lato client sarebbe il modo più veloce per far divergere il numero
 * mostrato da quello calcolato.
 *
 * TUTTO IN CENTESIMI INTERI, come già fa il catalogo (`parsePriceCents`). Sui
 * prezzi i float accumulano errore, e `0.1 + 0.2 !== 0.3` smette di essere un
 * aneddoto quando il numero finisce su un preventivo.
 */

/**
 * Applica una percentuale a un totale in centesimi.
 *
 * Si arrotonda **lo sconto**, non il netto, e una volta sola: così
 * `netto + sconto === lordo` per costruzione, e le due cifre che l'agente legge
 * sullo schermo tornano sempre. `Math.round` su un valore non negativo è
 * half-up, che è la convenzione commerciale attesa.
 */
export function applicaSconto(
  lordoCent: number,
  percent: number | null,
): { nettoCent: number; scontoCent: number } {
  if (percent === null || percent === 0) return { nettoCent: lordoCent, scontoCent: 0 };
  const scontoCent = Math.round((lordoCent * percent) / 100);
  return { nettoCent: lordoCent - scontoCent, scontoCent };
}

/**
 * Vero se la percentuale supera la soglia di avviso. Il confronto è **stretto**:
 * una percentuale pari alla soglia è ancora dentro.
 */
export function superaSoglia(percent: number | null, soglia: number): boolean {
  if (percent === null) return false;
  return percent > soglia;
}

/**
 * Euro → centesimi. Arrotonda invece di troncare perché `× 100` lascia code di
 * virgola mobile: `0.29 * 100` fa `28.999999999999996`, e `Math.trunc` darebbe
 * 28. I prezzi in ingresso hanno sempre due decimali (`Decimal(_,2)`), quindi
 * l'arrotondamento non nasconde mai una terza cifra vera.
 */
export function euroToCent(euro: number): number {
  return Math.round(euro * 100);
}

/** Centesimi → euro. */
export function centToEuro(cent: number): number {
  return cent / 100;
}
