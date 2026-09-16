/**
 * L'INDICE PUBBLICO DEI DOCUMENTI DELL'AREA DOWNLOAD COLOMBO.
 *
 * **Perché esiste.** Fino al 2026-09 sapevamo dei prodotti nuovi perché
 * `foto:colombo` raschiava l'elenco degli archivi fotografici e segnalava
 * quelli non in tabella: è così che comparvero i cinque modelli del 2026, mesi
 * prima del listino. COLOMBO ha rifatto il sito e quell'elenco non esiste più.
 *
 * L'indice dei documenti è la superficie che il fornitore mantiene viva, è
 * **pubblica** (nessuna password) ed è di fatto il segnale che ha fatto partire
 * le ultime due sessioni: `Vision 2026 catalogue` ed `ER catalogue 2026` sono
 * lì. Va adottato sui suoi meriti, non come consolazione.
 *
 * **Il modulo è PURO** — due parser e un diff, niente rete — perché un
 * rilevatore che non si può osservare mentre rileva è un commento che costa CI.
 * La rete sta in `scripts/vigila-colombo.ts`, lo stato atteso in
 * `documenti-colombo.ts`.
 */

/** Una voce dell'indice: `mostra.php?lang=en&catalogo=<id>` più il suo titolo. */
export interface Categoria {
  id: string;
  titolo: string;
}

/** Lo stato dell'area download: id di categoria → titolo e file pubblicati. */
export type Indice = Record<string, { titolo: string; file: string[] }>;

/**
 * Le categorie dell'indice, dall'HTML della homepage.
 *
 * Il titolo si ripulisce dal markup e dagli spazi, ma **non** dai caratteri
 * decorativi che COLOMBO ci mette dentro: se un giorno li togliesse sarebbe un
 * cambiamento del sito, e vogliamo saperlo.
 */
export function parseCategorie(html: string): Categoria[] {
  const out = new Map<string, Categoria>();
  for (const m of html.matchAll(
    /href="mostra\.php\?lang=en&catalogo=(\d+)"[^>]*>([\s\S]*?)<\/a>/g,
  )) {
    const id = m[1]!;
    if (out.has(id)) continue;
    const titolo = m[2]!
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    out.set(id, { id, titolo });
  }
  return [...out.values()];
}

/**
 * I file pubblicati da una pagina di categoria: **qualunque cosa sotto
 * `/download/`**, non i soli PDF.
 *
 * Il «non i soli PDF» è deliberato e vale quanto il resto: se COLOMBO
 * ripubblicasse l'indice dell'archivio fotografico, i suoi `.zip` comparirebbero
 * qui e il confronto li nominerebbe. È l'intento dello scraper che abbiamo
 * scartato — una regex ritagliata su un markup che non esiste più, il cui esito
 * «niente» era indistinguibile da «il selettore non combacia più» — ottenuto
 * senza lo scraper, e **osservabile**: questo codice trova qualcosa tutte le
 * settimane, quindi si sa che funziona.
 */
export function parseDocumenti(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="(\/download\/[^"]+)"/g)) out.add(m[1]!);
  return [...out].sort();
}

/**
 * Le differenze fra ciò che il sito mostra e ciò che il repo si aspetta, in
 * righe leggibili. Vuoto = niente di nuovo.
 *
 * **Non filtra nulla**: un titolo che cambia («ER catalogue 2026» → «2027») *è*
 * il segnale, e filtrarlo vorrebbe dire indovinare quale cambiamento conta.
 */
export function confronta(attuale: Indice, atteso: Indice): string[] {
  const righe: string[] = [];
  for (const id of Object.keys(attuale).sort()) {
    const a = attuale[id]!;
    const b = atteso[id];
    if (b === undefined) {
      righe.push(`NUOVA categoria ${id}: «${a.titolo}» → ${a.file.join(", ")}`);
      continue;
    }
    if (a.titolo !== b.titolo) {
      righe.push(`CAMBIATO titolo di ${id}: «${b.titolo}» → «${a.titolo}»`);
    }
    if (a.file.join("|") !== b.file.join("|")) {
      righe.push(
        `CAMBIATI i file di ${id} «${a.titolo}»: ${b.file.join(", ")} → ${a.file.join(", ")}`,
      );
    }
  }
  for (const id of Object.keys(atteso).sort()) {
    if (!(id in attuale)) righe.push(`SPARITA categoria ${id}: «${atteso[id]!.titolo}»`);
  }
  return righe;
}
