/**
 * Valida la chiave Blob prima di passarla a `get()` (anti-SSRF / path-injection),
 * con la stessa disciplina di `parsePageParam` del listino: forma canonica
 * ancorata, tutto il resto → `null` e la route risponde 400.
 *
 * Il prefisso è nostro e chiuso: nessuna chiave fuori da `maniglie/colombo/` è
 * raggiungibile, quindi la route non può servire il listino né altro che stia
 * sullo stesso store privato.
 *
 * ⚠️ `\n` è escluso a mano dalle classi: in JavaScript `$` accetta anche la fine
 * di riga, e senza escluderlo «chiave valida + a capo + qualunque cosa» passerebbe.
 * La forma delle chiavi è quella di `chiaveFoto` in `foto-archivio.ts`.
 */
const CHIAVE = /^maniglie\/colombo\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,80}$/;

export function parseChiaveFoto(raw: string | null): string | null {
  if (raw === null || raw.includes("\n") || raw.includes("\r")) return null;
  return CHIAVE.test(raw) ? raw : null;
}

/**
 * Solo i due formati che lo script genera. Un terzo darebbe un 404 dopo aver
 * interrogato Blob per nulla, e sarebbe una richiesta che il nostro codice non
 * emette mai.
 */
export function parseSizeFoto(raw: string | null): 320 | 900 | null {
  return raw === "320" ? 320 : raw === "900" ? 900 : null;
}
