import { inflateRawSync } from "node:zlib";

/**
 * Il minimo di ZIP che serve per prendere UNA foto da un archivio remoto senza
 * scaricarlo: l'archivio COLOMBO pesa 3,5 GB e le foto che ci servono sono 228.
 *
 * Niente dipendenze: la central directory è qualche `readUInt*LE` e `inflateRaw`
 * sta in `node:zlib`. Una libreria zip qui non toglierebbe codice — le richieste
 * Range servirebbero comunque, e sono la parte che conta.
 *
 * Formato: APPNOTE.TXT. Nessun supporto a ZIP64 né alla cifratura: l'archivio
 * COLOMBO non li usa (verificato su tutti e 79 gli zip), e un file che li usasse
 * farebbe fallire il parse invece di restituire byte plausibili.
 */

export interface VoceZip {
  nome: string;
  /** 0 = STORE, 8 = DEFLATE. */
  metodo: number;
  csize: number;
  usize: number;
  /** Offset del local header dentro lo zip. */
  offset: number;
}

const FIRMA_LOCALE = 0x04034b50;
const FIRMA_CENTRALE = 0x02014b50;
const EOCD = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

/**
 * Posizione e lunghezza della central directory, lette dall'EOCD.
 * `coda` sono gli ultimi byte del file (bastano 64 KiB + 22).
 */
export function leggiCentralDirectory(
  coda: Buffer,
  dimensioneTotale: number,
): { inizio: number; lunghezza: number } {
  const i = coda.lastIndexOf(EOCD);
  if (i < 0 || i + 20 > coda.length) {
    throw new Error("EOCD non trovato: l'archivio non è uno zip leggibile");
  }
  const lunghezza = coda.readUInt32LE(i + 12);
  const inizio = coda.readUInt32LE(i + 16);
  if (inizio + lunghezza > dimensioneTotale) {
    throw new Error("central directory dichiarata fuori dal file");
  }
  return { inizio, lunghezza };
}

export function parseCentralDirectory(cd: Buffer): VoceZip[] {
  const out: VoceZip[] = [];
  let p = 0;
  while (p + 46 <= cd.length && cd.readUInt32LE(p) === FIRMA_CENTRALE) {
    const nlen = cd.readUInt16LE(p + 28);
    const elen = cd.readUInt16LE(p + 30);
    const clen = cd.readUInt16LE(p + 32);
    out.push({
      nome: cd.subarray(p + 46, p + 46 + nlen).toString("utf8"),
      metodo: cd.readUInt16LE(p + 10),
      csize: cd.readUInt32LE(p + 20),
      usize: cd.readUInt32LE(p + 24),
      offset: cd.readUInt32LE(p + 42),
    });
    p += 46 + nlen + elen + clen;
  }
  return out;
}

/**
 * Dove cominciano i byte della voce. Si calcola SEMPRE dal local header e mai
 * dalla central directory: i campi «extra» dei due possono avere lunghezze
 * diverse, e usare quello sbagliato sposta l'inizio di qualche byte — cioè
 * restituisce dati plausibili e corrotti.
 */
export function inizioDati(localHeader: Buffer, voce: VoceZip): number {
  return voce.offset + 30 + localHeader.readUInt16LE(26) + localHeader.readUInt16LE(28);
}

/** I byte originali della voce. `corpo` è il tratto compresso, già scaricato. */
export function datiVoce(localHeader: Buffer, corpo: Buffer, voce: VoceZip): Buffer {
  if (localHeader.readUInt32LE(0) !== FIRMA_LOCALE) {
    throw new Error("local header non valido: offset sbagliato o archivio corrotto");
  }
  return voce.metodo === 0 ? corpo : inflateRawSync(corpo);
}
