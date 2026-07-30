import { z } from "zod";

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

/**
 * Percentuale di sconto valida: 0-100 con al massimo due decimali, perché le
 * colonne sono `Decimal(5,2)` e troncare in silenzio falsificherebbe i totali.
 *
 * Sta QUI, in un posto solo, perché la serve sia `customer` sia `kit`, e la
 * verifica dei due decimali ha una trappola che copiata a mano si sbaglia:
 * `Number.isInteger(40.55 * 100)` è **falso** (fa `4054.9999999999995`), quindi
 * il controllo ovvio rifiuterebbe uno sconto perfettamente legittimo. Si
 * confronta con l'intero più vicino a meno di un epsilon.
 */
export const scontoPercentSchema = z
  .number()
  .min(0, "Lo sconto non può essere negativo.")
  .max(100, "Lo sconto non può superare 100.")
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9,
    "Lo sconto ammette al massimo due decimali.",
  );
