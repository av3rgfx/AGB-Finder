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

/**
 * Le grafie con cui COLOMBO scrive una finitura A PAROLE nei nomi dei file,
 * quando non usa il suo codice. Ricavate dal vocabolario CHIUSO dei nomi reali
 * — 638 scatti di prodotto ridotti a 195 code distinte, guardate una per una —
 * e non indovinate: ognuna compare nell'archivio.
 *
 * `cromo mat` è la più importante e la meno ovvia: vale **Cromat**, non Cromo.
 * Lo dimostra l'archivio `01_Ama`, dove COLOMBO scrive `cromat` sulla variante
 * zero e `cromo matte` su quella liscia — stessa finitura, due generazioni di
 * nomi. Senza questa riga il match più lungo direbbe «Cromo» su 64 file.
 */
const GRAFIE: Record<string, string> = {
  cromomat: "CM",
  oromat: "OM",
  neromat: "NM", //    «nero matte»
  biancomat: "BI", //  «bianco matte»
  matwhite: "BI", //   le stesse due parole in ordine inverso, stesso archivio
  nickelmat: "NI", //  Nikelmat scritto all'inglese
};

/** `matte` e `mat` sono la stessa parola; i separatori non contano. */
function normalizzaTesto(s: string): string {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((t) => (t === "matte" ? "mat" : t))
    .join("");
}

/**
 * Gli aghi in ordine di LUNGHEZZA DECRESCENTE: quattro nomi ufficiali sono
 * prefisso di un altro (`Bronze`⊂`Umber Bronze`, `Silver`⊂`Silvermat`,
 * `Grafite`⊂`Grafite Mat`, `Vintage`⊂`Vintage Mat`), e col primo che capita si
 * affermerebbe la finitura sbagliata con la stessa sicurezza della giusta.
 *
 * Sotto i quattro caratteri un ago aggancerebbe per puro caso.
 */
const AGHI: { codice: string; ago: string }[] = [
  ...FINITURE.map((f) => ({ codice: f.codice, ago: normalizzaTesto(f.nome) })),
  ...Object.entries(GRAFIE).map(([ago, codice]) => ({ codice, ago })),
]
  .filter((x) => x.ago.length >= 4)
  .sort((a, b) => b.ago.length - a.ago.length);

/** Tutte le posizioni in cui un ago compare, non solo la prima. */
function occorrenze(testo: string, ago: string): { da: number; a: number }[] {
  const out: { da: number; a: number }[] = [];
  for (let i = testo.indexOf(ago); i !== -1; i = testo.indexOf(ago, i + 1)) {
    out.push({ da: i, a: i + ago.length });
  }
  return out;
}

/**
 * La finitura NOMINATA in un testo libero, `null` se non ce n'è.
 *
 * `null` anche per i **bicolori** (`cromo-cromo matte`, 16 file dell'archivio):
 * due finiture nello stesso nome non fanno una delle 31, e sceglierne una
 * sarebbe inventare — la stessa ragione per cui `CR8` e `OL9` non stanno nella
 * tabella qui sopra.
 *
 * ⚠️ «Due finiture nominate» non è «due aghi che agganciano»: in
 * `Umber bronze` agganciano sia `umberbronze` sia `bronze`, ma è UNA finitura
 * il cui nome ne CONTIENE un altro. A distinguerli è la SOVRAPPOSIZIONE — un
 * bicolore ha due nomi in posizioni disgiunte (`cromo`-`cromo mat`), un nome
 * lungo ha il corto dentro di sé. Senza questo, i quattro nomi che sono
 * prefisso di un altro sarebbero tutti letti come bicolori e persi.
 */
export function finituraDiTesto(s: string): string | null {
  const n = normalizzaTesto(s);
  const trovati = AGHI.flatMap(({ codice, ago }) =>
    occorrenze(n, ago).map((p) => ({ codice, ...p })),
  );
  if (trovati.length === 0) return null;

  // Il più lungo vince: `AGHI` è già ordinato, quindi il primo trovato è quello.
  const scelto = trovati[0]!;
  const altrove = trovati.some(
    (t) => t.codice !== scelto.codice && (t.a <= scelto.da || t.da >= scelto.a),
  );
  return altrove ? null : scelto.codice;
}
