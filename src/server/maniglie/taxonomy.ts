import { normalizeArticleCode } from "./code-norm";

/**
 * Le due regole di raggruppamento del catalogo maniglie — la «prima parola» e la
 * «famiglia» — in un modulo foglia, perché ne esista UNA definizione sola: la
 * usano lo script di misura, il router e la ricerca.
 *
 * Nessuna delle due deduce nulla dal codice con una regexp (§9 della spec): la
 * prima parola è una parola scritta da COLOMBO nella descrizione, la famiglia è
 * il token della descrizione che compare ANCHE nel codice. Si intersecano due
 * campi che COLOMBO ha scritto entrambi; non si inventa una grammatica.
 *
 * Misurato sul listino vero (3.456 codici, `LP 02-26`): 114 prime parole
 * distinte, famiglia trovata per il 79,8% dei codici. Il 20% scoperto è quasi
 * tutto accessoristica (KIT, ROS., POMOLINO…) che una famiglia non ce l'ha.
 */

/**
 * Il gemello SQL di `firstWord`, come costante e non copiato a mano nelle query:
 * se le due definizioni divergessero, il numero contato dal `GROUP BY` non
 * sarebbe più il numero mostrato a schermo. `search.integration.test.ts` le lega
 * su tutta la tabella.
 *
 * `\s+ → ' '` serve perché 45 descrizioni del listino vero hanno spazi doppi
 * (`PEGASO  INCASSO AM111`): senza, `split_part` restituirebbe stringa vuota.
 */
export const SQL_FIRST_WORD = `split_part(regexp_replace(upper(trim(name)), '\\s+', ' ', 'g'), ' ', 1)`;

/** Prima parola della descrizione, in maiuscolo. Spazi multipli collassati. */
export function firstWord(name: string): string {
  return name.trim().toUpperCase().split(/\s+/)[0] ?? "";
}

/** Secondo token della descrizione. `null` se la descrizione ha una parola sola. */
export function secondToken(name: string): string | null {
  const parts = name.trim().toUpperCase().split(/\s+/);
  return parts.length >= 2 ? parts[1]! : null;
}

/**
 * Un token di un carattere solo aggancerebbe quasi qualunque codice per puro
 * caso: sotto i due caratteri non si conta come famiglia.
 */
const MIN_FAMILY_LEN = 2;

/**
 * Indice del token della descrizione che compare nel codice — la famiglia,
 * ovunque stia. `null` se nessuno la contiene.
 *
 * La posizione NON è fissa: `FEDRA AC11R …` la mette seconda, `PLACCA PEGASO
 * PL70 …` terza, `PLACCA Y PER AM113 …` quarta. Sul listino vero: 66% al secondo
 * token, 26% al terzo. Una regola posizionale sbaglierebbe un codice su tre.
 */
export function familyTokenIndex(name: string, codeNorm: string): number | null {
  const tokens = name.trim().toUpperCase().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    if (tokenMatchesCode(tokens[i]!, codeNorm)) return i;
  }
  return null;
}

/** Un token della descrizione compare nel codice? È la regola, in un posto solo. */
export function tokenMatchesCode(token: string, codeNorm: string): boolean {
  const norm = normalizeArticleCode(token);
  return norm.length >= MIN_FAMILY_LEN && codeNorm.includes(norm);
}

/** La famiglia come parola: è ciò che serve al raggruppamento. */
export function familyOf(name: string, codeNorm: string): string | null {
  const i = familyTokenIndex(name, codeNorm);
  return i === null ? null : name.trim().toUpperCase().split(/\s+/)[i]!;
}
