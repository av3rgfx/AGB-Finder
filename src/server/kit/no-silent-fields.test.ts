import { describe, it, expect } from "vitest";
import { artechAntaRibaltaLegno } from "./rules-artech-legno";
import { artechVasistasLegno } from "./rules-artech-vasistas-legno";
import { tourBilicoLegno } from "./rules-tour-bilico-legno";
import { artechInputSchema, tourInputSchema } from "./types";
import type { KitInput, KitLine, RuleModule } from "./types";
import {
  opzioniSquadraAngolare,
  opzioniIncontroRibalta,
  opzioniIncontroNottolino,
} from "./artech-varianti";

/**
 * `series` e `windowType` sono i DISCRIMINATORI: mutarli non significa «un'altra
 * distinta», significa «un altro modulo». Sono gli unici campi legittimamente
 * fuori dalle due liste.
 */
const CAMPI_STRUTTURALI = new Set(["series", "windowType"]);

/**
 * IL BUG CHE QUESTO FILE ESISTE PER IMPEDIRE.
 *
 * La bonifica del 2026-07-25 ha trovato che i quattro campi geometria erano
 * «raccolti, validati e IGNORATI»: un agente chiedeva aria 4 e riceveva in
 * silenzio i codici dell'aria 12 — una distinta perfettamente plausibile, di
 * un'altra finestra. È il difetto peggiore possibile per questo motore, perché
 * non somiglia a un guasto: somiglia a una risposta.
 *
 * Quella correzione però è stata **puntuale** (una guardia sui quattro campi
 * noti). Qui la stessa classe di bug viene chiusa **strutturalmente**: per ogni
 * modulo attivo si muta ogni campo dell'input, e il modulo deve **cambiare
 * output o sollevare**. Un output identico in silenzio è un fallimento.
 *
 * I campi che legittimamente non spostano la distinta vanno dichiarati in
 * `inerti` **con la ragione**. La lista è verificata nei due sensi: un campo
 * dichiarato inerte che invece cambia l'output fallisce anch'esso. Così la lista
 * non può marcire — né in eccesso né in difetto.
 */

interface Caso {
  nome: string;
  modulo: RuleModule;
  base: KitInput;
  /** Mutazioni da provare: il valore deve essere valido per lo schema zod. */
  mutazioni: { campo: string; valore: unknown }[];
  /** Campi che NON devono spostare la distinta, con la ragione. */
  inerti: { campo: string; valore: unknown; perche: string }[];
  /** Campi dello schema del ramo, per il controllo di esaustività. */
  campi: readonly string[];
}

const artechBase: KitInput = {
  windowType: "ANTA_RIBALTA",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 550,
  heightMm: 1820,
  geometry: "A12_I13_B20",
  entrata: "E15",
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  supplementaryClosures: true,
};

const vasistasBase: KitInput = {
  windowType: "VASISTAS",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 600,
  heightMm: 1000,
  geometry: "A12_I13_B20",
  entrata: "E15",
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
};

const tourBase: KitInput = {
  windowType: "BILICO",
  series: "TOUR",
  material: "LEGNO",
  widthMm: 700,
  heightMm: 900,
  finish: "MARRONE RAL 8019",
  tourSchema: 2,
};

const CASI: Caso[] = [
  {
    nome: "ARTECH anta-ribalta legno",
    modulo: artechAntaRibaltaLegno,
    base: artechBase,
    mutazioni: [
      { campo: "widthMm", valore: 1200 },
      { campo: "heightMm", valore: 1200 },
      { campo: "material", valore: "PVC" },
      { campo: "geometry", valore: "A4_I9_B18" },
      { campo: "seatConfig", valore: "SEDE_30" },
      { campo: "openingSide", valore: "DESTRA" },
      { campo: "finish", valore: "BRONZO" },
      { campo: "supplementaryClosures", valore: false },
      { campo: "entrata", valore: "E75" },
      // Task 7: STRATO 2 della garanzia (spec §6). `variants` è un oggetto
      // annidato: una mutazione sola su tutto il blob (Task 5) si accorgerebbe
      // di un modulo che ha smesso di leggere OGNI variante, ma non di uno che
      // ne ha smesso di leggere UNA sola continuando a leggere le altre. Qui
      // c'è una mutazione per chiave, con la fixture su cui ciascuna è
      // DAVVERO disponibile — vedi il test di disponibilità qui sotto — così
      // che un'inerzia non passi «a vuoto» perché il codice era comunque
      // irraggiungibile su questa geometria.
      { campo: "variants.squadraAngolare", valore: "BASE" },
      { campo: "variants.incontroRibalta", valore: "ACCIAIO_INCLINATE" },
      { campo: "variants.movimentoAngolare", valore: "DUE_NOTTOLINI" },
      { campo: "variants.incontroNottolino", valore: "ANTIEFFRAZIONE_INCLINATE" },
      { campo: "variants.piastrinoAntieffrazione", valore: true },
    ],
    campi: [
      ...Object.keys(artechInputSchema.shape).filter((c) => c !== "variants"),
      // DERIVATO dalla dichiarazione del modulo, non scritto a mano: una
      // variante aggiunta al registro e dichiarata dal modulo, ma senza
      // mutazione qui, fa fallire il test COL PROPRIO NOME. È lo strato 2
      // della garanzia (spec §6).
      ...artechAntaRibaltaLegno.varianti.map((id) => `variants.${id}`),
    ],
    inerti: [
      {
        campo: "openingDir",
        valore: "SPINGERE",
        perche:
          "RILIEVO APERTO (domanda 16): `openingDir` è raccolto, validato e persistito, ma " +
          "NESSUN modulo lo legge. L'agente dice che l'apertura è quasi sempre «a tirare», " +
          "ora è il default dello schema. Va risolto togliendolo dall'input o usandolo — " +
          "vedi docs/superpowers/kit-assunzioni/legno.md.",
      },
      { campo: "notes", valore: "nota libera", perche: "Testo per l'ordine, non un parametro." },
      {
        campo: "sashWeightKg",
        valore: 60,
        perche:
          "L'anta-ribalta non ha NB sul peso: le due che esistono sono dello schema vasistas.",
      },
    ],
  },
  {
    nome: "ARTECH vasistas legno",
    modulo: artechVasistasLegno,
    base: vasistasBase,
    mutazioni: [
      { campo: "widthMm", valore: 1000 },
      { campo: "heightMm", valore: 700 },
      { campo: "material", valore: "ALLUMINIO" },
      { campo: "geometry", valore: "A4_I9_B18" },
      { campo: "seatConfig", valore: "SEDE_30" },
      { campo: "sashWeightKg", valore: 75 },
      // Sulla vasistas la mutazione produce un RIFIUTO, che `esito()` codifica
      // come "__RIFIUTO__" ≠ riferimento: è la forma corretta di «non ignorato».
      { campo: "entrata", valore: "E75" },
    ],
    campi: Object.keys(artechInputSchema.shape),
    inerti: [
      {
        campo: "openingSide",
        valore: "DESTRA",
        perche:
          "Una ribalta pura è incernierata in basso e non ha mano: le uniche varianti sono le " +
          "due articolazioni speculari, ed escono sempre entrambe (1 DX + 1 SX).",
      },
      { campo: "openingDir", valore: "SPINGERE", perche: "Vedi il rilievo sull'anta-ribalta." },
      { campo: "notes", valore: "nota libera", perche: "Testo per l'ordine, non un parametro." },
      {
        campo: "finish",
        valore: "BRONZO",
        perche: "La vasistas non emette il blocco coperture, l'unico che dipende dalla finitura.",
      },
      {
        campo: "supplementaryClosures",
        valore: true,
        perche:
          "Voce 7 (terminale sui montanti) omessa di proposito: il modulo IGNORA il flag " +
          "perché non ha righe da accendere per questa tipologia — coerente col wizard, che " +
          "per VASISTAS non mostra la casella e forza il campo a false.",
      },
      {
        campo: "variants",
        valore: { piastrinoAntieffrazione: true },
        perche:
          "Il modulo dichiara `varianti: []`: le 5 chiavi del registro (squadra angolare, " +
          "incontri ribalta/nottolino, movimento angolare, piastrino) sono tutte specifiche " +
          "dell'anta-ribalta e non hanno un equivalente nello schema vasistas p0418 (416).",
      },
    ],
  },
  {
    nome: "TOUR bilico legno",
    modulo: tourBilicoLegno,
    base: tourBase,
    mutazioni: [
      { campo: "widthMm", valore: 1500 },
      { campo: "heightMm", valore: 1600 },
      { campo: "material", valore: "PVC" },
      { campo: "finish", valore: "CROMATO OPACO" },
      { campo: "tourSchema", valore: 3 },
      { campo: "sashWeightKg", valore: 201 },
    ],
    campi: Object.keys(tourInputSchema.shape),
    inerti: [
      { campo: "notes", valore: "nota libera", perche: "Testo per l'ordine, non un parametro." },
    ],
  },
];

/**
 * Assegna a un percorso di UN livello (`variants.squadraAngolare`). Serve perché
 * le varianti vivono in un oggetto annidato: uno spread piatto le
 * sostituirebbe in blocco invece di mutarne una, e il test passerebbe per il
 * motivo sbagliato.
 */
function setPath(base: KitInput, campo: string, valore: unknown): KitInput {
  const [testa, coda] = campo.split(".");
  if (coda === undefined) return { ...base, [testa!]: valore } as KitInput;
  const annidato = (base as Record<string, unknown>)[testa!] as Record<string, unknown> | undefined;
  return { ...base, [testa!]: { ...(annidato ?? {}), [coda]: valore } } as KitInput;
}

/** Firma stabile della distinta: codice, quantità e ordine. */
function firma(lines: KitLine[]): string {
  return lines.map((l) => `${l.position}|${l.code}|${l.quantity}`).join("\n");
}

function esito(modulo: RuleModule, input: KitInput): string {
  try {
    return firma(modulo.generate(input));
  } catch {
    return "__RIFIUTO__";
  }
}

describe.each(CASI)("nessun campo ignorato in silenzio — $nome", (caso) => {
  const riferimento = esito(caso.modulo, caso.base);

  it("ogni campo dello schema è dichiarato — mutazione o inerte, mai dimenticato", () => {
    const dichiarati = new Set([
      ...caso.mutazioni.map((m) => m.campo),
      ...caso.inerti.map((i) => i.campo),
    ]);
    const dimenticati = caso.campi.filter(
      (campo) => !CAMPI_STRUTTURALI.has(campo) && !dichiarati.has(campo),
    );
    expect(dimenticati).toEqual([]);
  });

  it("l'input di riferimento genera una distinta", () => {
    expect(riferimento).not.toBe("__RIFIUTO__");
    expect(riferimento.length).toBeGreaterThan(0);
  });

  it.each(caso.mutazioni)("mutare $campo cambia la distinta o viene rifiutato", (m) => {
    const mutato = setPath(caso.base, m.campo, m.valore);
    expect(esito(caso.modulo, mutato)).not.toBe(riferimento);
  });

  it.each(caso.inerti)("$campo è dichiarato inerte e lo è davvero — $perche", (i) => {
    const mutato = setPath(caso.base, i.campo, i.valore);
    expect(esito(caso.modulo, mutato)).toBe(riferimento);
  });
});

describe("disponibilità delle varianti sulla fixture ARTECH anta-ribalta", () => {
  // Il tranello del task: `artechBase` usa un'unica geometria (`A12_I13_B20`).
  // Alcune varianti sono disponibili solo su certe geometrie (vedi le tabelle
  // in `artech-varianti.ts`) — su una fixture sbagliata risulterebbero
  // «legittimamente inerti» e le mutazioni sopra passerebbero A VUOTO. Questo
  // test lo DIMOSTRA invece di darlo per scontato.
  it("ogni variante mutata nel caso anta-ribalta è DAVVERO disponibile sulla fixture", () => {
    expect(opzioniSquadraAngolare("A12_I13_B20").length).toBeGreaterThan(1);
    expect(opzioniIncontroRibalta("A12_I13_B20").length).toBeGreaterThan(1);
    expect(opzioniIncontroNottolino("A12_I13_B20").length).toBeGreaterThan(1);
  });

  // Rilievo reviewer (opzionale, Task 7): `{ squadraAngolare: undefined }` è la
  // CHIAVE presente col valore `undefined` — diverso dalla chiave assente, ma
  // gestito dallo stesso `??` di `artech-varianti.ts`. Non era mai stato
  // asserito esplicitamente.
  it("`variants: { squadraAngolare: undefined }` (chiave presente, valore assente) si comporta come nessuna scelta", () => {
    const conChiaveUndefined = setPath(artechBase, "variants.squadraAngolare", undefined);
    expect(esito(artechAntaRibaltaLegno, conChiaveUndefined)).toBe(
      esito(artechAntaRibaltaLegno, artechBase),
    );
  });
});
