/**
 * Lettura del listino COLOMBO «Vision 2026» (edizione 05/26) già decodificato.
 *
 * ⚠️ Le BANDE sono **dichiarate**, non dedotte: il layout a due colonne di
 * *questo* documento è un fatto, non una regola generale, e un parser generico
 * ricavato da un solo esemplare sarebbe YAGNI. In cambio il parser **fallisce
 * rumorosamente** se il documento non è quello che crede (le tre guardie sotto):
 * meglio un import che non parte di 251 prezzi plausibili e sbagliati.
 *
 * Modulo puro: nessun accesso a rete, disco o database.
 */

/**
 * Le 13 grafie con cui il listino 05/26 nomina una finitura. Elenco CHIUSO, e
 * la chiusura è una guardia: una finitura che non è qui non si scarta in
 * silenzio, sbilancia il blocco e lo fa cadere (guardia 1).
 *
 * `silver mat` e `silvermat` sono entrambe del listino — ID66 usa la prima,
 * ID713 la seconda.
 */
const FINITURE_LISTINO = [
  "zirconium HPS/1",
  "grafite mat",
  "umber bronze",
  "dark green",
  "silver mat",
  "silvermat",
  "biancomat",
  "neromat",
  "oroplus",
  "oromat",
  "cromat",
  "cromo",
  "cherry",
] as const;

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ordine di lunghezza decrescente: `silvermat` contiene `silver mat`? no, ma
 * `cromat` e `cromo` condividono il prefisso, e `silver mat` è prefisso di
 * nulla mentre `silvermat` lo è. Col primo che capita si aggancerebbe la grafia
 * corta dentro quella lunga e il conteggio dei nomi sballerebbe.
 */
const RX_FINITURA = new RegExp(
  [...FINITURE_LISTINO].sort((a, b) => b.length - a.length).map(esc).join("|"),
  "g",
);
const RX_PREZZO = /\b\d{1,3},\d{2}\b/g;

/** Un blocco del documento: dove guardare, e quali modelli condividono la colonna. */
export interface VisionBanda {
  pagina: number;
  /** I modelli che condividono UNA colonna di prezzi (`AM41 R` + `AM41 RY`). */
  modelli: string[];
  daRiga: number;
  aRiga: number;
  daColonna: number;
  aColonna: number;
}

export interface VisionRiga {
  finitura: string;
  /** Come stampato: `105,30`. La conversione a Decimal sta a valle. */
  prezzo: string;
}

export interface VisionBlocco {
  pagina: number;
  modelli: string[];
  righe: VisionRiga[];
}

interface Segno {
  riga: number;
  col: number;
  testo: string;
}

const perLettura = (a: Segno, b: Segno): number => a.riga - b.riga || a.col - b.col;

export function parseVision(testo: string, bande: VisionBanda[]): VisionBlocco[] {
  const pagine = testo.split("\f").map((p) => p.split("\n"));

  // GUARDIA 0 — il documento ha le pagine che le bande presuppongono.
  //
  // ⚠️ Non è pedanteria: `\f` non è solo il salto pagina vero. La cifratura è
  // «testo + 29», quindi il carattere `)` del testo è memorizzato come 0x0C, che
  // È il form feed — e `decodeVision` lo lascia stare, perché non può sapere se
  // quel byte era una pagina o una parentesi. Una `)` nella prosa legale
  // inserirebbe una pagina fantasma e sfaserebbe OGNI indice qui sotto.
  //
  // Senza questa guardia il sintomo sarebbe silenzioso: una banda che punta a
  // una pagina che non esiste legge `[]`, il ciclo non parte, e la guardia 1
  // passa come `0 === 0`. L'import scriverebbe meno articoli senza dire niente.
  const attese = Math.max(...bande.map((b) => b.pagina)) + 1;
  if (pagine.length < attese) {
    throw new Error(
      `Vision: il documento ha ${pagine.length} pagine, le bande ne presuppongono ` +
        `almeno ${attese}. Non è il listino che questo parser sa leggere: ` +
        `nessuna riga importata.`,
    );
  }

  const blocchi: VisionBlocco[] = [];

  for (const b of bande) {
    const righe = pagine[b.pagina]!;
    const nomi: Segno[] = [];
    const prezzi: Segno[] = [];

    for (let i = b.daRiga; i <= Math.min(b.aRiga, righe.length - 1); i++) {
      const linea = righe[i]!;
      for (const m of linea.matchAll(RX_FINITURA)) {
        if (m.index >= b.daColonna && m.index <= b.aColonna) {
          nomi.push({ riga: i, col: m.index, testo: m[0] });
        }
      }
      for (const m of linea.matchAll(RX_PREZZO)) {
        if (m.index >= b.daColonna && m.index <= b.aColonna) {
          prezzi.push({ riga: i, col: m.index, testo: m[0] });
        }
      }
    }

    // I prezzi stanno a DESTRA dei nomi: un numero più a sinistra è una quota
    // del disegno tecnico (`137,5`), non un prezzo.
    const colNomi = nomi.length > 0 ? Math.min(...nomi.map((n) => n.col)) : 0;
    const soloDestra = prezzi.filter((p) => p.col > colNomi + 6);

    // GUARDIA 1 — si appaiano in ORDINE DI LETTURA, che è ciò che significa il
    // layout a colonne: l'ennesimo nome va con l'ennesimo prezzo anche quando
    // cadono su righe diverse. Se i due elenchi non hanno la stessa lunghezza
    // l'appaiamento sarebbe arbitrario, e un prezzo sulla finitura sbagliata non
    // si vede: esiste, è plausibile, e non produce nessun errore.
    if (nomi.length !== soloDestra.length) {
      throw new Error(
        `Vision: blocco «${b.modelli.join(" + ")}» (pagina ${b.pagina}): ` +
          `${nomi.length} finiture e ${soloDestra.length} prezzi. ` +
          `Il documento non ha il layout previsto: nessuna riga importata.`,
      );
    }

    // …e che ne abbia trovato almeno UNO. Una banda dichiarata è un blocco che
    // sappiamo esserci: se non produce righe, la finestra non guarda più dove
    // credeva, e `0 === 0` sopra passerebbe senza dire nulla.
    if (nomi.length === 0) {
      throw new Error(
        `Vision: blocco «${b.modelli.join(" + ")}» (pagina ${b.pagina}, righe ` +
          `${b.daRiga}-${b.aRiga}, colonne ${b.daColonna}-${b.aColonna}): nessuna ` +
          `finitura nella finestra dichiarata. Nessuna riga importata.`,
      );
    }

    const nomiOrd = [...nomi].sort(perLettura);
    const prezziOrd = [...soloDestra].sort(perLettura);

    blocchi.push({
      pagina: b.pagina,
      modelli: b.modelli,
      righe: nomiOrd.map((n, i) => ({ finitura: n.testo, prezzo: prezziOrd[i]!.testo })),
    });
  }

  return riconcilia(blocchi);
}

/**
 * I disaccordi del documento che abbiamo **guardato uno per uno e deciso**.
 *
 * Non è una tolleranza: è un elenco chiuso. Un disaccordo che non sta qui ferma
 * l'import, perché «il listino si contraddice» è esattamente ciò che nessuno
 * scoprirebbe a valle — due prezzi plausibili, e a DB entra quello della banda
 * dichiarata per ultima, cioè per caso.
 *
 * ⚠️ Qui si dichiara **quale disaccordo è noto, non quale prezzo scegliere**. Il
 * valore lo decide una REGOLA — vince la **pagina più bassa**, che è quella del
 * prodotto, dove il listino lo descrive, contro il riepilogo in coda. Tre
 * ragioni, tutte concrete:
 *
 * 1. il repo è **PUBBLICO** e i prezzi del fornitore non si committano mai;
 * 2. un valore scritto a mano resta quello anche quando l'edizione successiva
 *    cambia il prezzo su **entrambe** le pagine: il parser non vedrebbe più
 *    alcun disaccordo e continuerebbe a scrivere il numero vecchio;
 * 3. la regola vale per la coppia modello+finitura e non per la riga, che in una
 *    banda a due modelli (`FF13 BB` + `FF13 Y`) è condivisa.
 *
 * L'unico del Vision 2026 è `BT19 BZG` in oromat: la pagina del prodotto e il
 * riepilogo dei nottolini non concordano, con 21 prezzi ripetuti su 22 d'accordo.
 * La domanda è aperta per Andrea.
 */
const DISACCORDI_NOTI: { modello: string; finitura: string }[] = [
  { modello: "BT19 BZG", finitura: "oromat" },
];

/**
 * La chiave di una coppia modello+finitura. `JSON.stringify` di una coppia e
 * non una concatenazione con un separatore: così non serve ragionare su
 * quale carattere non possa comparire in un nome di modello o di finitura.
 */
function chiave(modello: string, finitura: string): string {
  return JSON.stringify([modello, finitura]);
}

const NOTI = new Set(DISACCORDI_NOTI.map((d) => chiave(d.modello, d.finitura)));

/**
 * GUARDIA 3 — i prodotti che il listino stampa su DUE pagine devono costare lo
 * stesso, salvo i disaccordi dichiarati sopra.
 *
 * Oltre a verificare, **riconcilia**: dove il disaccordo è noto tiene il prezzo
 * della PAGINA PIÙ BASSA — quella del prodotto — e lo riscrive su tutte le
 * occorrenze, così a valle il prezzo è uno solo e non dipende dall'ordine in cui
 * le bande sono state dichiarate.
 *
 * ⚠️ Un disaccordo dichiarato che **non si presenta più** fa fallire: se
 * l'edizione successiva mette d'accordo le due pagine, la voce in
 * `DISACCORDI_NOTI` è diventata una deroga a un problema che non esiste, e una
 * deroga morta non si vede — resta lì a coprire il prossimo disaccordo vero
 * sulla stessa coppia.
 */
function riconcilia(blocchi: VisionBlocco[]): VisionBlocco[] {
  const visti = new Map<string, { prezzo: string; pagina: number }>();
  /** Le coppie per cui il disaccordo dichiarato si è davvero manifestato. */
  const confermati = new Set<string>();
  /** Le coppie stampate su più di una pagina: solo lì un accordo è verificabile. */
  const ripetuti = new Set<string>();
  /** Coppia → prezzo della pagina più bassa in cui compare. */
  const scelto = new Map<string, string>();

  for (const b of blocchi) {
    for (const mod of b.modelli) {
      for (const r of b.righe) {
        const k = chiave(mod, r.finitura);
        const prima = visti.get(k);

        if (prima === undefined) {
          visti.set(k, { prezzo: r.prezzo, pagina: b.pagina });
          scelto.set(k, r.prezzo);
          continue;
        }
        ripetuti.add(k);
        if (prima.prezzo === r.prezzo) continue;

        if (!NOTI.has(k)) {
          throw new Error(
            `Vision: «${mod}» in ${r.finitura} ha due prezzi diversi, a pagina ` +
              `${prima.pagina} e a pagina ${b.pagina}. Il listino si contraddice: ` +
              `nessuna riga importata.`,
          );
        }
        confermati.add(k);
        // Vince la pagina più bassa: è quella del prodotto, dove il listino lo
        // descrive, contro il riepilogo che sta in coda al documento.
        if (b.pagina < prima.pagina) {
          visti.set(k, { prezzo: r.prezzo, pagina: b.pagina });
          scelto.set(k, r.prezzo);
        }
      }
    }
  }

  // Una deroga è MORTA quando la coppia è stampata su più pagine — cioè quando
  // un disaccordo sarebbe visibile — e le pagine vanno d'accordo. Se la coppia
  // in questo documento non c'è, o compare una volta sola, la deroga non è morta:
  // è solo inapplicabile, e `parseVision` deve restare una funzione pura che
  // legge qualunque coppia testo/bande le si dia.
  for (const d of DISACCORDI_NOTI) {
    const k = chiave(d.modello, d.finitura);
    if (ripetuti.has(k) && !confermati.has(k)) {
      throw new Error(
        `Vision: il disaccordo dichiarato su «${d.modello}» in ${d.finitura} non ` +
          `si presenta più: le pagine concordano. La deroga è diventata morta e ` +
          `va tolta da DISACCORDI_NOTI, o coprirà il prossimo disaccordo vero.`,
      );
    }
  }

  if (confermati.size === 0) return blocchi;
  return blocchi.map((b) => ({
    ...b,
    righe: b.righe.map((r) => {
      // La scelta vale per la coppia modello+finitura, non per la riga: in una
      // banda a due modelli (`FF13 BB` + `FF13 Y`) la riga è condivisa, e una
      // deroga dichiarata per uno solo non deve riscrivere il prezzo dell'altro.
      const chiavi = b.modelli.map((mod) => chiave(mod, r.finitura));
      if (!chiavi.every((k) => confermati.has(k))) return r;
      const v = scelto.get(chiavi[0]!);
      return v === undefined ? r : { ...r, prezzo: v };
    }),
  }));
}

/**
 * Le 37 bande del documento, misurate sul file vero (scaricato il 2026-09-15).
 * `pagina` è l'indice dopo lo split su `\f` (la copertina è 0), `daRiga`/`aRiga`
 * sono indici di riga dentro la pagina, `daColonna`/`aColonna` colonne di
 * carattere del testo prodotto da `pdftotext -layout`.
 *
 * ⚠️ Le tre bande di pagina 13 ripetono i nottolini delle pagine 6-8 e NON sono
 * una svista: sono la materia della guardia 3. Toglierle la spegne senza che
 * nessun test diventi rosso.
 */
export const BANDE_VISION_2026: VisionBanda[] = [
  // p6 — LACONICA
  { pagina: 6, modelli: ["AM41 R", "AM41 RY"], daRiga: 16, aRiga: 42, daColonna: 40, aColonna: 200 },
  { pagina: 6, modelli: ["AM41 RSB"], daRiga: 43, aRiga: 75, daColonna: 40, aColonna: 130 },
  { pagina: 6, modelli: ["AM42 DK/SM"], daRiga: 43, aRiga: 75, daColonna: 130, aColonna: 230 },
  { pagina: 6, modelli: ["FF13 BB", "FF13 Y"], daRiga: 76, aRiga: 117, daColonna: 40, aColonna: 130 },
  { pagina: 6, modelli: ["AM41 RSM", "AM41 RSMY"], daRiga: 118, aRiga: 146, daColonna: 40, aColonna: 200 },
  { pagina: 6, modelli: ["AM19 BZG"], daRiga: 147, aRiga: 170, daColonna: 40, aColonna: 200 },
  // p7 — ROBOT6
  { pagina: 7, modelli: ["ID81 R", "ID81 RY"], daRiga: 16, aRiga: 43, daColonna: 40, aColonna: 200 },
  { pagina: 7, modelli: ["ID81 RSB"], daRiga: 44, aRiga: 77, daColonna: 40, aColonna: 132 },
  { pagina: 7, modelli: ["ID82 DK/SM"], daRiga: 44, aRiga: 77, daColonna: 132, aColonna: 230 },
  { pagina: 7, modelli: ["FF13 BB", "FF13 Y"], daRiga: 78, aRiga: 119, daColonna: 40, aColonna: 132 },
  { pagina: 7, modelli: ["ID81 RSM", "ID81 RSMY"], daRiga: 120, aRiga: 149, daColonna: 40, aColonna: 200 },
  { pagina: 7, modelli: ["FF19 BZG"], daRiga: 150, aRiga: 175, daColonna: 40, aColonna: 200 },
  // p8 — ROBOT6 S
  { pagina: 8, modelli: ["ID91 R", "ID91 RY"], daRiga: 16, aRiga: 43, daColonna: 40, aColonna: 200 },
  { pagina: 8, modelli: ["ID91 RSB"], daRiga: 44, aRiga: 77, daColonna: 40, aColonna: 136 },
  { pagina: 8, modelli: ["ID92 DK/SM"], daRiga: 44, aRiga: 77, daColonna: 136, aColonna: 230 },
  { pagina: 8, modelli: ["BT13 BB", "BT13 Y"], daRiga: 78, aRiga: 120, daColonna: 40, aColonna: 136 },
  { pagina: 8, modelli: ["ID91 RSM", "ID91 RSMY"], daRiga: 121, aRiga: 151, daColonna: 40, aColonna: 200 },
  { pagina: 8, modelli: ["BT19 BZG"], daRiga: 152, aRiga: 175, daColonna: 40, aColonna: 200 },
  // p9 — HALO
  { pagina: 9, modelli: ["AM15 R", "AM15 RY"], daRiga: 21, aRiga: 49, daColonna: 40, aColonna: 130 },
  { pagina: 9, modelli: ["AM15 RSB"], daRiga: 50, aRiga: 72, daColonna: 40, aColonna: 130 },
  { pagina: 9, modelli: ["AM15 FISSO"], daRiga: 73, aRiga: 98, daColonna: 40, aColonna: 130 },
  { pagina: 9, modelli: ["AM25 FISSO"], daRiga: 73, aRiga: 98, daColonna: 130, aColonna: 240 },
  { pagina: 9, modelli: ["FF13 BB", "FF13 Y"], daRiga: 99, aRiga: 130, daColonna: 40, aColonna: 130 },
  // p10 — KUBO
  { pagina: 10, modelli: ["ID45 R", "ID45 RY"], daRiga: 18, aRiga: 46, daColonna: 40, aColonna: 133 },
  { pagina: 10, modelli: ["ID45 RSB"], daRiga: 47, aRiga: 69, daColonna: 40, aColonna: 133 },
  { pagina: 10, modelli: ["ID45 FISSO"], daRiga: 70, aRiga: 89, daColonna: 40, aColonna: 133 },
  { pagina: 10, modelli: ["ID55 FISSO"], daRiga: 70, aRiga: 89, daColonna: 133, aColonna: 240 },
  { pagina: 10, modelli: ["ID13 BB", "ID13 Y"], daRiga: 90, aRiga: 120, daColonna: 50, aColonna: 132 },
  // p11 — maniglioni senza rosette
  { pagina: 11, modelli: ["AM16"], daRiga: 5, aRiga: 37, daColonna: 90, aColonna: 240 },
  { pagina: 11, modelli: ["ID66"], daRiga: 38, aRiga: 70, daColonna: 90, aColonna: 240 },
  // p12 — maniglioni per alzante scorrevole
  { pagina: 12, modelli: ["AM313/0"], daRiga: 5, aRiga: 40, daColonna: 90, aColonna: 240 },
  { pagina: 12, modelli: ["AM413 Y/0"], daRiga: 41, aRiga: 78, daColonna: 90, aColonna: 240 },
  { pagina: 12, modelli: ["ID713 Q"], daRiga: 79, aRiga: 125, daColonna: 90, aColonna: 240 },
  { pagina: 12, modelli: ["ID813 YQ"], daRiga: 126, aRiga: 160, daColonna: 90, aColonna: 240 },
  // p13 — riepilogo nottolini: ripete p6/p7/p8, ed è la materia della guardia 3
  { pagina: 13, modelli: ["AM19 BZG"], daRiga: 5, aRiga: 24, daColonna: 40, aColonna: 240 },
  { pagina: 13, modelli: ["FF19 BZG"], daRiga: 25, aRiga: 55, daColonna: 40, aColonna: 240 },
  { pagina: 13, modelli: ["BT19 BZG"], daRiga: 56, aRiga: 95, daColonna: 40, aColonna: 240 },
];
