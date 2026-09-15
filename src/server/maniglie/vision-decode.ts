/**
 * Il testo estratto dal listino COLOMBO «Vision 2026» con `pdftotext -layout`
 * arriva cifrato con uno shift costante di **+29 per byte** — lo stesso del
 * catalogo `ER MAN 2026` (`9LVLRQ` → `Vision`).
 *
 * Due byte-classi NON vanno scalate, e sbagliarle è costato due tentativi:
 *
 * 1. **I byte di struttura** (`\n`, `\f`, `\r` e lo spazio 0x20) non sono testo
 *    del PDF: `\f` separa le pagine e lo spazio è la spaziatura che `-layout`
 *    inserisce per ricostruire le colonne. Scalarli trasforma ogni spazio in
 *    «=» e rende illeggibile la pagina.
 * 2. ⚠️ **I byte sotto 32 invece SÌ**: sono esattamente le CIFRE (lo «0» cifrato
 *    è `\x13`). Saltarli fa concludere che il listino non contenga prezzi —
 *    conclusione che è già stata tratta una volta, ed era falsa.
 *
 * ⚠️ Gli accentati restano illeggibili, ed è accettato: sono UTF-8 multi-byte e
 * lo shift li rompe (`qualità` → `qualitß¿`). Nel listino compaiono solo nella
 * prosa legale, mai nei codici, nelle finiture o nei prezzi — cioè mai in ciò
 * che questo modulo serve a leggere.
 *
 * Modulo foglia: nessuna dipendenza, nessun accesso a rete o disco.
 */
const STRUTTURA = new Set([0x0a, 0x0c, 0x0d, 0x20]);

export function decodeVision(raw: Buffer): string {
  let out = "";
  for (const b of raw) {
    out += String.fromCharCode(STRUTTURA.has(b) ? b : (b + 29) % 256);
  }
  return out;
}
