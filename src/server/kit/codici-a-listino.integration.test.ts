// Gate «ogni codice emettibile esiste a catalogo con prezzo» — Task 7.
//
// PERCHÉ QUESTO TEST E NON BASTA QUELLO UNITARIO. `rules-artech-legno.test.ts`
// mocka `product.findMany`: un codice sbagliato in tabella (typo, famiglia
// inesistente, variante mai pubblicata a listino) produce comunque righe e il
// mock risponde "sì" a qualunque query. È esattamente il difetto che ha fatto
// disattivare PVC e battente (Fase 1g/1h) — codici plausibili ma assenti dal
// listino reale, scoperti solo con il DB vero. Questo test percorre le 7
// geometrie ARTECH legno (`artech-geometrie.ts`) per entrambe le mani e
// verifica ogni codice emesso contro il catalogo reale importato da AGB: deve
// esistere ED avere un prezzo. Nessun warning, nessuna tolleranza: hard fail.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GEOMETRIE } from "./artech-geometrie";
import { artechAntaRibaltaLegno } from "./rules-artech-legno";
import type { ArtechGeometryId } from "./artech-geometrie";
import { ENTRATE, type KitInput } from "./types";
import {
  opzioniSquadraAngolare,
  squadraAngolare,
  opzioniIncontroRibalta,
  incontroRibaltaVariante,
  opzioniIncontroNottolino,
  incontroNottolinoVariante,
  movimentoAngolareCodice,
  piastrinoCodice,
} from "./artech-varianti";

const url = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(url))("ogni codice emettibile esiste a catalogo con prezzo", () => {
  let db: PrismaClient;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  // `seatConfig: "STANDARD"` — non "SEDE_30": quest'ultima è respinta a monte
  // da `assertSeatConfigSupportata` (il listino 2026 non pubblica un incontro
  // DSS 13x30), quindi non è un input che il gate deve coprire.
  // `supplementaryClosures: true` porta la distinta a 16 righe/21 pezzi: senza,
  // il gate coprirebbe solo le 12 righe obbligatorie e lascerebbe scoperte le
  // 4 righe delle chiusure supplementari.
  const base = {
    windowType: "ANTA_RIBALTA",
    series: "ARTECH",
    material: "LEGNO",
    widthMm: 550,
    heightMm: 1820,
    seatConfig: "STANDARD",
    openingDir: "TIRARE",
    finish: "ARGENTO",
    supplementaryClosures: true,
  } as const;

  // 7 geometrie × 2 mani × 2 ENTRATE = 28 combinazioni: tutte le distinte
  // ordinabili dal modulo. L'entrata è il terzo discriminatore che cambia i
  // codici emessi — e i nove A50122.08.* non erano mai passati per il catalogo
  // reale prima di questo gate.
  const combinazioni = (Object.keys(GEOMETRIE) as ArtechGeometryId[]).flatMap((geometry) =>
    (["DESTRA", "SINISTRA"] as const).flatMap((openingSide) =>
      ENTRATE.map((entrata) => ({ geometry, openingSide, entrata })),
    ),
  );

  it.each(combinazioni)(
    "$geometry / $openingSide / entrata $entrata — nessun codice orfano",
    async ({ geometry, openingSide, entrata }) => {
      const lines = artechAntaRibaltaLegno.generate({
        ...base,
        geometry,
        openingSide,
        entrata,
      } as KitInput);

      const codici = [...new Set(lines.map((l) => l.code))];

      // Non-vuotezza ESPLICITA, prima del confronto. Senza questa riga il gate
      // passerebbe a vuoto su una distinta vuota: `orfani` sarebbe `[]` e
      // `toEqual([])` sarebbe verde pur non avendo verificato nulla — il modo
      // peggiore di fallire per un test che esiste per dare fiducia.
      // Oggi non può succedere, perché `pick()`/`requireKey()` in kit-shared.ts
      // SOLLEVANO invece di restituire una riga mancante. Ma quella garanzia vive
      // in un altro file: se un domani `generate()` tornasse a restituire `[]` per
      // un caso limite, questo gate ridiventerebbe silenziosamente inutile. La
      // soglia è il set obbligatorio (12) più le 4 chiusure supplementari.
      expect(
        codici.length,
        "distinta vuota: il gate non avrebbe verificato nulla",
      ).toBeGreaterThanOrEqual(16);

      const trovati = await db.product.findMany({
        where: { agbCode: { in: codici } },
        select: { agbCode: true, basePrice: true },
      });
      const prezzati = new Set(
        trovati
          .filter((p) => p.basePrice !== null && Number(p.basePrice) > 0)
          .map((p) => p.agbCode),
      );
      const orfani = codici.filter((c) => !prezzati.has(c));
      expect(orfani, `codici assenti o senza prezzo: ${orfani.join(", ")}`).toEqual([]);
    },
  );

  // Le 28 combinazioni sopra fissano anche `widthMm: 550`, quindi esercitano UNA
  // banda su 5 di `FORBICI` e UNA su 4 di `BRACCI_GRUPPI`. Il codice del braccio
  // è `A5191{1=DX,2=SX}.{mid}.0{gruppo}`: con 5 `mid` distinti fra le 7 geometrie
  // fanno 40 codici, di cui il gate ne verificava **10**. Più 4 dei 5 codici
  // forbice mai passati per il catalogo reale — la stessa lacuna che fece
  // disattivare PVC e battente.
  //
  // Ogni larghezza cade nell'INTERNO NON SOVRAPPOSTO della sua banda: le bande si
  // accavallano (476-490 sta sia nella prima sia nella seconda), e un valore
  // nella sovrapposizione verificherebbe la banda che `pick()` trova per prima
  // invece di quella voluta.
  //
  // `entrata` resta fissa: cambia SOLO la riga della cremonese, già coperta dal
  // test delle 9 bande HBB qui sotto. Stesso criterio con cui quello fissa la
  // geometria.
  const LARGHEZZE = [400, 550, 700, 900, 1100];

  const perLarghezza = LARGHEZZE.flatMap((widthMm) =>
    (Object.keys(GEOMETRIE) as ArtechGeometryId[]).flatMap((geometry) =>
      (["DESTRA", "SINISTRA"] as const).map((openingSide) => ({ widthMm, geometry, openingSide })),
    ),
  );

  it.each(perLarghezza)(
    "larghezza $widthMm / $geometry / $openingSide — nessun codice orfano",
    async ({ widthMm, geometry, openingSide }) => {
      const lines = artechAntaRibaltaLegno.generate({
        ...base,
        widthMm,
        geometry,
        openingSide,
        entrata: "E15",
      } as KitInput);

      const codici = [...new Set(lines.map((l) => l.code))];
      expect(
        codici.length,
        "distinta vuota: il gate non avrebbe verificato nulla",
      ).toBeGreaterThanOrEqual(16);

      const trovati = await db.product.findMany({
        where: { agbCode: { in: codici } },
        select: { agbCode: true, basePrice: true },
      });
      const prezzati = new Set(
        trovati
          .filter((p) => p.basePrice !== null && Number(p.basePrice) > 0)
          .map((p) => p.agbCode),
      );
      const orfani = codici.filter((c) => !prezzati.has(c));
      expect(orfani, `codici assenti o senza prezzo: ${orfani.join(", ")}`).toEqual([]);
    },
  );

  // Guardia del test precedente. Se un domani le bande di FORBICI o
  // BRACCI_GRUPPI cambiano, `LARGHEZZE` va rifatta — e questo lo DICE, invece di
  // lasciare il gate a coprire silenziosamente di meno. È lo stesso difetto che
  // questo task chiude: una copertura che cala senza che nulla protesti.
  it("le 5 larghezze coprono tutti i codici forbice e tutti i gruppi braccio", () => {
    const forbici = new Set<string>();
    const gruppi = new Set<string>();
    for (const widthMm of LARGHEZZE) {
      const lines = artechAntaRibaltaLegno.generate({
        ...base,
        widthMm,
        geometry: "A12_I13_B20",
        openingSide: "DESTRA",
        entrata: "E15",
      } as KitInput);
      for (const l of lines) {
        if (l.code.startsWith("A50510.")) forbici.add(l.code);
        if (/^A5191[12]\./.test(l.code)) gruppi.add(l.code.slice(-2));
      }
    }
    expect(forbici.size, `forbici coperte: ${[...forbici].sort().join(", ")}`).toBe(5);
    expect(gruppi.size, `gruppi braccio coperti: ${[...gruppi].sort().join(", ")}`).toBe(4);
  });

  // Le 28 combinazioni sopra fissano `heightMm: 1820`: l'unica riga che dipende
  // dall'altezza — la cremonese — non varia mai, quindi il gate esercita un solo
  // codice per entrata (`.07`) sui nove pubblicati (`A50122.08.02`…`.10` per
  // entrata 7,5, `A50122.15.02`…`.10` per entrata 15). Allargare le 28 alle
  // altezze (28×9 = 252 casi) verificherebbe una riga sola per un costo
  // sproporzionato. Qui si isola quella riga: le stesse 9 altezze rappresentative
  // di `rules-artech-legno.test.ts` (tabella `BANDE`) — ciascuna cade in UNA sola
  // banda HBB, vedi il commento lì sulla sovrapposizione a hbb 2100 — × le 2
  // entrate = 18 cremonesi, tutte e nove le bande di entrambe le famiglie.
  it("le 9 bande HBB × 2 entrate: 18 cremonesi, tutte a catalogo con prezzo", async () => {
    const HBB = [700, 900, 1100, 1300, 1500, 1700, 1900, 2150, 2400];

    const cremonesi = HBB.flatMap((hbb) =>
      ENTRATE.map((entrata) => {
        const lines = artechAntaRibaltaLegno.generate({
          ...base,
          geometry: "A12_I13_B20",
          openingSide: "DESTRA",
          heightMm: hbb + 10,
          entrata,
          // OFF, a differenza di `base`: le chiusure verticali sono un'altra
          // tabella con la propria banda d'altezza (1520-2120, vedi
          // `CHIUSURE_VERTICALI`) — con `true` alcune delle 9 altezze
          // rappresentative (fuori da quella banda, dentro le bande HBB della
          // cremonese) farebbero fallire `generate()` per un motivo estraneo a
          // ciò che questo test verifica.
          supplementaryClosures: false,
        } as KitInput);
        return lines.find((l) => l.position === "cremonese")!.code;
      }),
    );

    const codici = [...new Set(cremonesi)];
    // 9 bande × 2 entrate devono restare 18 codici DISTINTI: se due bande
    // collassassero sullo stesso codice (o l'entrata smettesse di cambiarlo), il
    // controllo sotto verificherebbe meno di 18 codici in silenzio.
    expect(codici.length, "attese 18 cremonesi distinte (9 bande × 2 entrate)").toBe(18);

    const trovati = await db.product.findMany({
      where: { agbCode: { in: codici } },
      select: { agbCode: true, basePrice: true },
    });
    const prezzati = new Set(
      trovati.filter((p) => p.basePrice !== null && Number(p.basePrice) > 0).map((p) => p.agbCode),
    );
    const orfani = codici.filter((c) => !prezzati.has(c));
    expect(orfani, `codici assenti o senza prezzo: ${orfani.join(", ")}`).toEqual([]);
  });

  // PERCHÉ LE TABELLE E NON LE DISTINTE. I test sopra percorrono `generate()`,
  // quindi vedono solo i codici che il motore emette OGGI — quelli di default.
  // Il registro delle varianti (`artech-varianti.ts`) pubblica anche i codici
  // che l'agente sceglie esplicitamente in UI (squadra angolare, incontro
  // ribalta/nottolino, movimento angolare, piastrino) e che una distinta col
  // solo standard non tocca mai. Un codice sbagliato lì — la stessa famiglia di
  // errore che ha fatto disattivare PVC e battente — resterebbe invisibile
  // finché nessun agente lo sceglie in produzione.
  it("ogni codice del registro varianti esiste a catalogo con prezzo", async () => {
    const codici = new Set<string>();
    for (const geometry of Object.keys(GEOMETRIE) as ArtechGeometryId[]) {
      for (const mano of ["DESTRA", "SINISTRA"] as const) {
        // Il DEFAULT va raccolto ESPLICITAMENTE (chiamando la funzione con
        // `undefined`), non basta iterare le `opzioni*`: `opzioniIncontroRibalta`
        // torna [] quando per la geometria esiste UNA SOLA scelta possibile —
        // "una variante con una sola opzione non è una scelta" per la UI, ma il
        // codice resta quello che il motore emette DAVVERO per quel serramento.
        // Succede per aria 4 asse 9 (A4_I85_B15, A4_I9_B18): senza questa riga
        // `A514DX.01.64`/`A514SX.01.64` — i codici reali di MC e Peruzzi —
        // non entrerebbero mai nel Set (il conto scenderebbe da 74 a 72).
        codici.add(squadraAngolare(geometry, mano, undefined));
        for (const o of opzioniSquadraAngolare(geometry))
          codici.add(squadraAngolare(geometry, mano, o.id));

        codici.add(incontroRibaltaVariante(geometry, mano, undefined));
        for (const o of opzioniIncontroRibalta(geometry))
          codici.add(incontroRibaltaVariante(geometry, mano, o.id));

        codici.add(incontroNottolinoVariante(geometry, mano, undefined));
        for (const o of opzioniIncontroNottolino(geometry))
          codici.add(incontroNottolinoVariante(geometry, mano, o.id));
      }
    }
    // Movimento angolare e piastrino non hanno una funzione `opzioni*` (sono un
    // enum fisso, non una tabella per geometria): si elencano per esteso.
    codici.add(movimentoAngolareCodice("UN_NOTTOLINO"));
    codici.add(movimentoAngolareCodice("DUE_NOTTOLINI"));
    for (const e of ENTRATE) codici.add(piastrinoCodice(e));

    // GUARDIA DI COPERTURA: se un domani una tabella si svuota per errore (o la
    // raccolta sopra dimentica un ramo), il confronto sotto passerebbe
    // verificando zero codici — il difetto che questo stesso task chiude. 74 è
    // il numero verificato sul listino 2026 il 2026-07-31 con questa raccolta
    // (default + opzioni, deduplicati).
    expect(codici.size).toBe(74);

    const trovati = await db.product.findMany({
      where: { agbCode: { in: [...codici] } },
      select: { agbCode: true, basePrice: true },
    });
    const prezzati = new Set(
      trovati.filter((p) => p.basePrice !== null && Number(p.basePrice) > 0).map((p) => p.agbCode),
    );
    const orfani = [...codici].filter((c) => !prezzati.has(c));
    expect(orfani, `codici assenti o senza prezzo: ${orfani.join(", ")}`).toEqual([]);
  });
});
