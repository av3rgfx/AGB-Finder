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
import type { KitInput } from "./types";

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

  // Prodotto cartesiano 7 geometrie × 2 mani = 14 combinazioni: sono TUTTE le
  // distinte ordinabili dal modulo (la geometria e la mano sono gli unici due
  // discriminatori che cambiano i codici emessi, a parità di dimensioni/finitura).
  const combinazioni = (Object.keys(GEOMETRIE) as ArtechGeometryId[]).flatMap((geometry) =>
    (["DESTRA", "SINISTRA"] as const).map((openingSide) => ({ geometry, openingSide })),
  );

  it.each(combinazioni)(
    "$geometry / $openingSide — nessun codice orfano",
    async ({ geometry, openingSide }) => {
      const lines = artechAntaRibaltaLegno.generate({
        ...base,
        geometry,
        openingSide,
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
      expect(codici.length, "distinta vuota: il gate non avrebbe verificato nulla").toBeGreaterThanOrEqual(16);

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
});
