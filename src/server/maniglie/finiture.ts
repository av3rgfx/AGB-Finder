/**
 * Le 31 finiture che COLOMBO pubblica (catalogo `ER MAN 2026`, pagina stampata 13).
 *
 * Modulo foglia, senza dipendenze: lo usano il parser dei nomi delle foto e — dal
 * passo successivo — il filtro colori chiesto da Andrea. Sul listino `LP 02-26`
 * **3.065 codici su 3.456 (88,7%)** hanno come coda una di queste.
 *
 * ⚠️ Il COLORE è CAMPIONATO dalle pastiglie di catalogo, non dichiarato da COLOMBO:
 * va bene per un pallino in un filtro, NON per rappresentare la finitura reale di
 * un prodotto.
 *
 * ⚠️ Le code distinte del listino sono 57, non 31: le altre sono bicolori (`CR8` =
 * CROMO/CROMAT, 33 codici · `OL9` = OROPLUS/OROMAT, 24) e varianti. Qui stanno
 * SOLO quelle pubblicate — nessuna categoria inventata sulle code non riconosciute.
 */

export interface Finitura {
  /** La coda del codice articolo: `0CD41R-`**`CM`**. */
  codice: string;
  nome: string;
  /** Esadecimale campionato dalla pastiglia di catalogo, non dichiarato. */
  colore: string;
}

export const FINITURE: Finitura[] = [
  { codice: "OL", nome: "Oroplus", colore: "#F8EAB4" },
  { codice: "OM", nome: "Oromat", colore: "#E2CE90" },
  { codice: "HPS/1", nome: "Zirconium Stainless-Steel", colore: "#BDBBBB" },
  { codice: "GL", nome: "Grafite", colore: "#54504F" },
  { codice: "GM", nome: "Grafite Mat", colore: "#28201A" },
  { codice: "VL", nome: "Vintage", colore: "#CB9864" },
  { codice: "VM", nome: "Vintage Mat", colore: "#B98756" },
  { codice: "CR", nome: "Cromo", colore: "#EAE7E6" },
  { codice: "CM", nome: "Cromat", colore: "#D6D4D4" },
  { codice: "NI", nome: "Nikelmat", colore: "#A59D8F" },
  { codice: "BR", nome: "Bronzo", colore: "#895623" },
  { codice: "BA", nome: "Bronzo Antico", colore: "#61432B" },
  { codice: "OA", nome: "Ottone Antico", colore: "#B78F44" },
  { codice: "SM", nome: "Silvermat", colore: "#C6CBCE" },
  { codice: "CH", nome: "Cherry", colore: "#D94349" },
  { codice: "DG", nome: "Dark Green", colore: "#00532D" },
  { codice: "UB", nome: "Umber Bronze", colore: "#514B3E" },
  { codice: "NM", nome: "Neromat", colore: "#060706" },
  { codice: "BI", nome: "Biancomat", colore: "#F3F0F1" },
  { codice: "C01", nome: "White", colore: "#FFFEF2" },
  { codice: "C02", nome: "Bronze", colore: "#3D2110" },
  { codice: "C03", nome: "Black", colore: "#000F17" },
  { codice: "C04", nome: "Silver", colore: "#9C9898" },
  { codice: "C05", nome: "Titan", colore: "#0A1B23" },
  { codice: "C06", nome: "Ocean Blue", colore: "#637893" },
  { codice: "C07", nome: "Strawberry Red", colore: "#E21A52" },
  { codice: "C08", nome: "Sunset Orange", colore: "#F36F31" },
  { codice: "C09", nome: "Lemon Yellow", colore: "#FFD400" },
  { codice: "C10", nome: "Claret Violet", colore: "#5D0035" },
  { codice: "C11", nome: "Lime Green", colore: "#4DB857" },
  { codice: "C12", nome: "Capri Blue", colore: "#005596" },
];

export const FINITURE_PER_CODICE: ReadonlyMap<string, Finitura> = new Map(
  FINITURE.map((f) => [f.codice, f]),
);

/**
 * La finitura di un codice articolo, se la sua coda è una delle 31 pubblicate.
 * `null` quando la coda non c'è (237 codici del listino non hanno il trattino) o
 * non è ufficiale.
 */
export function finituraDiCodice(code: string): string | null {
  const i = code.lastIndexOf("-");
  if (i < 0) return null;
  const coda = code.slice(i + 1).toUpperCase();
  return FINITURE_PER_CODICE.has(coda) ? coda : null;
}

export interface FinituraCount extends Finitura {
  count: number;
}

/**
 * Quante volte ciascuna finitura ufficiale compare in coda a un elenco di codici,
 * **nell'ordine in cui COLOMBO le pubblica** — che è l'ordine per trattamento
 * (PVD, galvanico, a polvere), non l'alfabetico né la numerosità.
 *
 * Le finiture senza codici NON compaiono: offrire una scelta che dà uno schermo
 * vuoto è la stessa cosa che offrire un filtro che non filtra.
 *
 * Chi chiama passa i codici del contesto in cui l'elenco verrà mostrato (tutto il
 * catalogo, oppure il gruppo che si sta sfogliando): così il numero accanto al
 * nome conta l'insieme che si ha davanti, e non un altro.
 */
export function contaFiniture(codes: string[]): FinituraCount[] {
  const n = new Map<string, number>();
  for (const code of codes) {
    const f = finituraDiCodice(code);
    if (f) n.set(f, (n.get(f) ?? 0) + 1);
  }
  return FINITURE.filter((f) => n.has(f.codice)).map((f) => ({ ...f, count: n.get(f.codice)! }));
}
