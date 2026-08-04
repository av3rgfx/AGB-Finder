import { familyOf } from "./taxonomy";

/**
 * SFOGLIO, livello 2: le famiglie dentro un gruppo di primo livello.
 *
 * TypeScript puro, non raw SQL, e non è una preferenza di stile: «qual è la
 * famiglia» è una REGOLA DI DOMINIO, e nel reparto maniglie le regole di dominio
 * stanno fuori dalle query — come la disponibilità, che vive in
 * `stock-status.ts` tutta in Prisma proprio per non finire dentro un `$queryRaw`.
 * Riscriverla in SQL significherebbe averne due versioni che possono divergere.
 *
 * Il costo è nullo: il gruppo più numeroso del listino vero è MANIGLIONE con 338
 * righe, e sono già state lette per contarle.
 *
 * Misurato sul listino vero (3.456 codici): 533 famiglie distinte, mediana 3
 * codici ciascuna.
 */

export interface BrowseRow {
  id: string;
  code: string;
  codeNorm: string;
  name: string;
}

export interface FamilyGroup {
  family: string;
  count: number;
}

/**
 * La famiglia di una riga, DENTRO un gruppo di primo livello.
 *
 * `null` anche quando la famiglia trovata coincide con la parola del gruppo: è
 * il caso di `KIT PORTE SCORREVOLI` col codice `XKIT/PS-CM`, dove «KIT» sta
 * dentro il codice e verrebbe preso per famiglia. «KIT › KIT» non divide nulla,
 * ripete l'etichetta di sopra e fa sembrare classificato ciò che non lo è.
 */
function familyInGroup(row: BrowseRow, groupWord: string): string | null {
  const fam = familyOf(row.name, row.codeNorm);
  return fam === null || fam === groupWord ? null : fam;
}

/**
 * Il gruppo diviso nelle sue due parti: le famiglie, e i codici che una famiglia
 * non ce l'hanno.
 *
 * Una funzione sola e non due, di proposito: su 114 gruppi veri soltanto 23
 * hanno copertura piena e SETTANTA sono parziali (MANIGLIONE 333/338, BOCCHETTA
 * 250/288). Chi chiedesse le sole famiglie lascerebbe fuori dallo schermo dei
 * codici che hanno prezzo e disponibilità — invisibili a chi sfoglia, e
 * invisibili anche a chi scrive il codice, perché nessun conteggio andrebbe a
 * zero. Restituendo le due parti insieme, dimenticarne una è impossibile invece
 * che sconsigliato.
 *
 * `families` vuoto è il segnale, per il chiamante, di saltare il livello 2 e
 * mostrare direttamente i codici (decisione utente: nessun bucket «Altro»).
 */
export function splitGroup(
  rows: BrowseRow[],
  groupWord: string,
): { families: FamilyGroup[]; loose: BrowseRow[] } {
  const counts = new Map<string, number>();
  const loose: BrowseRow[] = [];

  for (const r of rows) {
    const fam = familyInGroup(r, groupWord);
    if (fam === null) loose.push(r);
    else counts.set(fam, (counts.get(fam) ?? 0) + 1);
  }

  const families = [...counts.entries()]
    .map(([family, count]) => ({ family, count }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));

  return { families, loose };
}

/** Le righe di quella famiglia, nell'ordine ricevuto. */
export function filterByFamily(
  rows: BrowseRow[],
  groupWord: string,
  family: string,
): BrowseRow[] {
  return rows.filter((r) => familyInGroup(r, groupWord) === family);
}
