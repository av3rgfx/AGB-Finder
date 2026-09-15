import { Prisma } from "@prisma/client";
import { normalizeArticleCode } from "./code-norm";
import { finituraDiTesto, FINITURE_PER_CODICE } from "./finiture";
import type { VisionBlocco } from "./vision-parse";

/**
 * Dai blocchi del listino Vision 2026 agli articoli.
 *
 * LA REGOLA — `codice = "0" + designazione senza separatori + "-" + sigla` — è
 * **misurata, non postulata**, ed è la differenza con §9 («non dedurre»): la
 * pronta consegna contiene 12 codici scritti da COLOMBO per questi stessi
 * prodotti nuovi (`0AM41RHPS1`, `0ID81RCM`, `0ID45FISSOCM`…) — erano i «23
 * orfani», cioè il listino nuovo arrivato in magazzino prima che a sistema — e
 * la regola li riproduce su **10 designazioni su 10**.
 *
 * ⚠️ Sui COMPONENTI CONDIVISI, che a listino ci sono già, la regola sbaglia 11
 * volte su 13: sono pezzi vecchi a cui il 2026 dà una designazione nuova. Lì il
 * codice si **legge**, e le sei voci stanno scritte per esteso qui sotto —
 * comprese le due che oggi coincidono con la regola, perché il codice di un
 * pezzo che esiste non deve dipendere da una regola per restare giusto domani.
 * È la stessa disciplina dei 74 codici delle varianti ARTECH, mai concatenati.
 */
const NUCLEO_ECCEZIONE: Record<string, string> = {
  "FF13 BB": "0FF13BB",
  "FF13 Y": "0FF13", //      la «Y» del listino non entra nel codice
  "BT13 BB": "0BT13BB",
  "BT13 Y": "0BT13",
  "FF19 BZG": "0FF19BZG6", // il «6» non è la serie: `BZG6` sta in 12 famiglie
  "BT19 BZG": "0BT19BZG6",
};

/**
 * Le designazioni che NON si possono risolvere, e per cui quindi non si scrive
 * nessun codice.
 *
 * Non è prudenza generica: sono i due casi in cui la regola generica è
 * **contraddetta da ogni istanza misurabile della sua stessa classe**.
 *
 * - le designazioni `… Y`: `FF13 Y`→`0FF13` e `BT13 Y`→`0BT13`, la Y non entra
 *   nel codice. 2 su 2. Ma a listino **6 bocchette su 110 la tengono**, quindi
 *   nemmeno la forma senza Y è una certezza.
 * - le designazioni `… BZG`: `FF19 BZG`→`0FF19BZG6` e `BT19 BZG`→`0BT19BZG6`,
 *   compare un 6. 2 su 2. Ma **5 nottolini su 159 hanno il BZG nudo**.
 *
 * `FF13 Y`, `BT13 Y`, `FF19 BZG` e `BT19 BZG` il codice ce l'hanno a listino e si
 * LEGGE (`NUCLEO_ECCEZIONE`). `ID13 Y` e `AM19 BZG` no: sono prodotti nuovi, e
 * per loro entrambe le forme esistono nel catalogo. Applicare lì la regola
 * generica significherebbe scrivere un codice che la classe smentisce 4 volte su
 * 4 — plausibile, ordinabile, senza fonte, e senza nulla che possa accorgersene.
 *
 * Escono dall'import come le righe HPS/1, ed entrano quando COLOMBO risponde.
 */
const NON_RISOLVIBILI: Record<string, string> = {
  "ID13 Y": "la «Y» entra nel codice o no? le due forme esistono entrambe",
  "AM19 BZG": "«BZG» o «BZG6»? le due forme esistono entrambe",
};

/** La serie commerciale per pagina del documento. */
const SERIE: Record<number, string> = {
  6: "LACONICA",
  7: "ROBOT6",
  8: "ROBOT6 S",
  9: "HALO",
  10: "KUBO",
};

export interface VisionArticolo {
  code: string;
  codeNorm: string;
  name: string;
  priceList: Prisma.Decimal;
}

export interface VisionEsito {
  articoli: VisionArticolo[];
  /**
   * Ciò che il documento pubblica e che NON si sa ordinare: le righe «zirconium
   * HPS/1» (la coda non è derivabile) e le due designazioni di `NON_RISOLVIBILI`.
   * `motivo` dice quale delle due, così l'operatore legge perché e non solo
   * quanti.
   */
  esclusi: { modello: string; finitura: string; motivo: string }[];
}

/**
 * Il nucleo del codice: `0` + la designazione **senza gli spazi**.
 *
 * ⚠️ Lo SLASH resta. Toglieva anche quello, e produceva `0AM42DKSM` dove il
 * listino scrive `0AM42DK/SM`: misurato sui 3.456, **224 codici `DK/SM` hanno lo
 * slash contro 35 che non ce l'hanno** (e quei 35 sono `DKSMSX`, un'altra
 * variante), **127 `/0` contro 5**. La pronta consegna non poteva smentirlo
 * perché dà la forma NORMALIZZATA — `0AM42DKSMI1` è compatibile con entrambe —
 * quindi la prova sta solo nel listino.
 *
 * Valeva 30 codici: i tre `DK/SM` e i due maniglioni ZERO.
 */
function nucleo(modello: string): string {
  return NUCLEO_ECCEZIONE[modello] ?? `0${modello.toUpperCase().replace(/\s+/g, "")}`;
}

/**
 * La descrizione, che l'import compone e che `curatela.ts` classifica per PRIMA
 * PAROLA. Si segue la convenzione di COLOMBO misurata sul listino vero: **nome
 * del modello** per maniglie e pomoli (`FEDRA AC11R CROMAT`), **tipo** per i
 * componenti condivisi (`BOCCHETTA Y FF13 CROMAT`, `NOTTOLINO FF19BZG6 CROMAT`).
 *
 * ⚠️ Mai iniziare con «MANIGLIA»: `curatela.ts` la fonde in `MANIGLIA INCASSO`,
 * e 144 righe finirebbero fra i maniglioni a incasso **senza che alcun conteggio
 * vada a zero**.
 *
 * Il nome della finitura si DERIVA da `finiture.ts` (verificato: le 11 sigle in
 * gioco danno esattamente la parola del listino), così non nasce una seconda
 * tabella libera di divergere da quella del filtro colori.
 *
 * ⚠️ La finitura resta **per esteso e ultima**. COLOMBO la tronca per stare nei
 * 35 caratteri (`VIOLA AR22DK SENZA MOV.VINTAGE`) ed è la causa dei 63
 * disaccordi finitura-codice del listino vecchio: non si imita un difetto.
 */
function descrizione(modello: string, pagina: number, sigla: string): string {
  const fin = FINITURE_PER_CODICE.get(sigla)!.nome.toUpperCase();
  // Il token viene dal NUCLEO risolto, non dalla designazione stampata: dove
  // c'è un'eccezione i due differiscono, e COLOMBO scrive il nucleo. Con la
  // designazione, i tre codici nuovi di `FF19 BZG` direbbero «NOTTOLINO
  // FF19BZG» accanto ai fratelli già a listino che dicono «FF19BZG6».
  // Nel CODICE lo slash resta; nella DESCRIZIONE COLOMBO lo scrive a parole —
  // `0JP11RSB/0-GM` si chiama «ALATO JP11RSB ZERO GRAFITE». Si segue quella.
  const [radice, variante] = nucleo(modello).slice(1).split("/");
  const cod = radice!;
  const zero = variante === "0" ? " ZERO" : "";
  const fam = modello.split(" ")[0]!;
  const suf = modello.includes(" ") ? modello.slice(fam.length + 1) : "";

  if (suf === "BB") return `BOCCHETTA F.NORM. ${fam} ${fin}`;
  if (suf === "Y") return `BOCCHETTA Y ${fam} ${fin}`;
  if (suf === "BZG") return `NOTTOLINO ${cod} ${fin}`;
  if (pagina === 11 || pagina === 12) return `MANIGLIONE ${cod}${zero} ${fin}`;

  // Oltre questo punto serve il nome della serie, e `SERIE` copre solo le pagine
  // prodotto. Senza la guardia una banda su una pagina non mappata produrrebbe
  // una descrizione che comincia con la parola «undefined»: TypeScript accetta
  // `${undefined}` in un template, e il gruppo di sfoglio si chiamerebbe così.
  const serie = SERIE[pagina];
  if (serie === undefined) {
    throw new Error(
      `Vision: nessuna serie dichiarata per la pagina ${pagina} (modello ` +
        `${modello}). Nessuna riga importata.`,
    );
  }

  if (suf === "FISSO") return `${serie} FISSO ${fam} ${fin}`;
  if (suf === "DK/SM") return `${serie} ${fam}DK S/MOV. ${fin}`;
  return `${serie} ${cod} ${fin}`;
}

export function articoliVision(blocchi: VisionBlocco[]): VisionEsito {
  const articoli: VisionArticolo[] = [];
  const esclusi: { modello: string; finitura: string; motivo: string }[] = [];
  // Due insiemi e non uno: qui convivono due spazi di chiavi diversi — i codici
  // (`0AM41R-OL`) e le coppie modello+finitura degli esclusi. Tenerli in un Set
  // solo funziona finché nessuna delle due forme somiglia all'altra, che è una
  // proprietà vera per caso e non per costruzione.
  const codiciVisti = new Set<string>();
  const esclusiVisti = new Set<string>();

  for (const b of blocchi) {
    for (const r of b.righe) {
      const sigla = finituraDiTesto(r.finitura);

      if (sigla === null) {
        // `finituraDiTesto` riconosce 12 delle 13 grafie del listino. L'unica che
        // rifiuta è «zirconium HPS/1», il cui nome in tabella è «Zirconium
        // Stainless-Steel» — e quelle righe restano comunque fuori, perché la
        // CODA di quella finitura non è derivabile: COLOMBO usa `I1` e `HPS1`
        // nella stessa serie (`0AM42DKSMI1` contro `0AM41RHPS1`), e a listino
        // coesistono cinque grafie.
        //
        // Qualunque ALTRA finitura non riconosciuta è un documento che non
        // capiamo: si ferma, non si scarta in silenzio.
        if (r.finitura !== "zirconium HPS/1") {
          throw new Error(
            `Vision: finitura «${r.finitura}» non riconosciuta (modello ` +
              `${b.modelli.join(" + ")}). Nessuna riga importata.`,
          );
        }
        for (const mod of b.modelli) {
          escludi(mod, r.finitura, "«zirconium HPS/1»: la coda non è derivabile");
        }
        continue;
      }

      for (const mod of b.modelli) {
        const perche = NON_RISOLVIBILI[mod];
        if (perche !== undefined) {
          escludi(mod, r.finitura, perche);
          continue;
        }
        const code = `${nucleo(mod)}-${sigla}`;
        // Lo stesso prodotto è stampato su due pagine (i nottolini): la guardia 3
        // del parser ha già provato che i prezzi coincidono, qui si deduplica.
        if (codiciVisti.has(code)) continue;
        codiciVisti.add(code);
        articoli.push({
          code,
          codeNorm: normalizeArticleCode(code),
          name: descrizione(mod, b.pagina, sigla),
          priceList: new Prisma.Decimal(r.prezzo.replace(",", ".")),
        });
      }
    }
  }
  return { articoli, esclusi };

  /**
   * Deduplicati come gli articoli, e per la stessa ragione: tre prodotti sono
   * stampati su due pagine, e questo numero lo legge l'operatore a fine import.
   * Contare le occorrenze direbbe 22 dove i modelli sono 19.
   */
  function escludi(modello: string, finitura: string, motivo: string): void {
    const k = JSON.stringify([modello, finitura]);
    if (esclusiVisti.has(k)) return;
    esclusiVisti.add(k);
    esclusi.push({ modello, finitura, motivo });
  }
}
