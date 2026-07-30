import { describe, it, expect } from "vitest";
import {
  incontroNottolino,
  incontroRibalta,
  incontroDss,
  formatoIncontro,
} from "./artech-incontri";
import { GEOMETRIE, type ArtechGeometryId } from "./artech-geometrie";
import { KitGenerationError } from "./types";

describe("incontroNottolino", () => {
  it("aria 12 è ambidestro: la mano non cambia il codice", () => {
    expect(incontroNottolino("A12_I13_B20", "DESTRA")).toBe("A51400.05.02");
    expect(incontroNottolino("A12_I13_B20", "SINISTRA")).toBe("A51400.05.02");
  });

  it("aria 12 interasse 13 standard usa il 13x24", () => {
    expect(incontroNottolino("A12_I13_B18", "DESTRA")).toBe("A51400.CR.13");
  });

  it("aria 4 asse 9 ha la mano (famiglia A514DX/SX)", () => {
    expect(incontroNottolino("A4_I85_B15", "DESTRA")).toBe("A514DX.01.02");
    expect(incontroNottolino("A4_I85_B15", "SINISTRA")).toBe("A514SX.01.02");
  });

  it("aria 4 asse 13 ha la mano su una famiglia DIVERSA (A48011/A48012)", () => {
    expect(incontroNottolino("A4_I13_B18", "DESTRA")).toBe("A48011.DC.02");
    expect(incontroNottolino("A4_I13_B18", "SINISTRA")).toBe("A48012.DC.02");
  });
});

describe("incontroRibalta", () => {
  it("il pilota conserva lo zama viti dritte ambidestro", () => {
    expect(incontroRibalta("A12_I13_B20", "SINISTRA")).toBe("A51400.05.70");
  });

  it("aria 4 asse 9: a listino esiste solo l'acciaio, con la mano", () => {
    expect(incontroRibalta("A4_I9_B18", "DESTRA")).toBe("A514DX.01.64");
    expect(incontroRibalta("A4_I9_B18", "SINISTRA")).toBe("A514SX.01.64");
  });

  it("aria 4 asse 13: zama con la mano", () => {
    expect(incontroRibalta("A4_I13_B18", "DESTRA")).toBe("A514DX.DC.70");
  });
});

describe("incontroDss", () => {
  it("aria 12 9x18 ambidestro", () => {
    expect(incontroDss("A12_I13_B20", "DESTRA")).toBe("A51400.05.03");
  });

  it("aria 12 13x24 ambidestro, su famiglia A48010", () => {
    expect(incontroDss("A12_I13_B18", "DESTRA")).toBe("A48010.CR.03");
  });

  it("aria 4 ha la mano", () => {
    expect(incontroDss("A4_I9_B18", "DESTRA")).toBe("A48011.01.03");
    expect(incontroDss("A4_I9_B18", "SINISTRA")).toBe("A48012.01.03");
  });
});

describe("formatoIncontro", () => {
  /**
   * Il caso che ha motivato la funzione: `GEOMETRIE.A12_I13_B20` dichiara asse 13
   * e sede 18, ma `chiave()` instrada il pilota sul 9x18 (famiglia `.05`, asse 9).
   * Stampando quei due campi la riga d'ordine affermava «asse 13 sede 18», cioè il
   * formato `13x18` — che a listino NON esiste (domanda 3b). Derivando il formato
   * dalla stessa chiave dei codici, la contraddizione non è più stampabile.
   */
  it("il pilota dichiara il 9x18 che davvero ordina, non un inesistente 13x18", () => {
    expect(formatoIncontro("A12_I13_B20")).toBe("asse 9x18");
    expect(formatoIncontro("A12_I13_B20")).not.toContain("13x18");
    // …ed è lo stesso formato della famiglia emessa: `.05` = 9x18.
    expect(incontroDss("A12_I13_B20", "DESTRA")).toBe("A51400.05.03");
  });

  it("l'altra aria 12 asse 13 è il 13x24", () => {
    expect(formatoIncontro("A12_I13_B18")).toBe("asse 13x24");
  });

  it("per l'aria 4 il listino parla di fresatura, non di sede (p0469 (467))", () => {
    expect(formatoIncontro("A4_I85_B15")).toBe("asse 9 (fresatura)");
    expect(formatoIncontro("A4_I9_B18")).toBe("asse 9 (fresatura)");
    expect(formatoIncontro("A4_I13_B18")).toBe("asse 13 (fresatura)");
  });
});

describe("chiave() — mappatura esplicita ed esaustiva dei formati incontro", () => {
  const TUTTE = Object.keys(GEOMETRIE) as ArtechGeometryId[];

  it("tutte e 7 le geometrie coperte danno un formato valido e tre codici, per entrambe le mani", () => {
    expect(TUTTE).toHaveLength(7);
    for (const id of TUTTE) {
      // Solo i formati che il generatore copre: fresatura per l'aria 4, 9x18 o
      // 13x24 per l'aria 12. Un «asse 9x20» o «asse 13x30» qui sarebbe un formato
      // inventato.
      expect(formatoIncontro(id), id).toMatch(
        /^asse (9 \(fresatura\)|13 \(fresatura\)|9x18|13x24)$/,
      );
      for (const mano of ["DESTRA", "SINISTRA"] as const)
        for (const incontro of [incontroNottolino, incontroRibalta, incontroDss])
          expect(incontro(id, mano), `${id} ${mano}`).toMatch(/^A[0-9A-Z]{5}\.[0-9A-Z]{2}\.\d{2}$/);
    }
  });

  /**
   * PERCHÉ UNA MUTAZIONE E NON UN INPUT. L'ottava geometria — asse 9 / **sede 20**,
   * il formato `9x20` che la spec dichiara fuori perimetro — non è costruibile da
   * input validati: `ArtechGeometryId` ha sette valori e `GEOMETRIE` sette righe,
   * tutte coperte, quindi il ramo di rifiuto è oggi irraggiungibile dalla UI e dal
   * router. Si esegue simulando quella riga (`sedeMm` 18 → 20) e ripristinandola in
   * `finally`: è l'unico modo di provare che il `throw` c'è e morde. Senza questa
   * prova il vecchio ternario `sedeMm === 18 ? "9x18" : "13x24"` avrebbe risposto
   * `13x24` — gli incontri di un'altra finestra — in perfetto silenzio.
   */
  it("una sede fuori mappa (9x20) viene RIFIUTATA, non instradata al 13x24", () => {
    const riga = GEOMETRIE.A12_I9_B18;
    const sedeOriginale = riga.sedeMm;
    riga.sedeMm = 20;
    try {
      for (const chiamata of [
        () => incontroNottolino("A12_I9_B18", "DESTRA"),
        () => incontroRibalta("A12_I9_B18", "SINISTRA"),
        () => incontroDss("A12_I9_B18", "DESTRA"),
        () => formatoIncontro("A12_I9_B18"),
      ]) {
        expect(chiamata).toThrow(KitGenerationError);
        expect(chiamata).toThrow(/aria 12 · asse 9 · sede 20 mm/);
      }
      try {
        formatoIncontro("A12_I9_B18");
        expect.unreachable("atteso rifiuto del formato 9x20");
      } catch (err) {
        expect((err as KitGenerationError).ruleId).toBe("artech.incontri");
      }
    } finally {
      riga.sedeMm = sedeOriginale;
    }
    // Ripristino verificato: gli altri test del file leggono la stessa riga.
    expect(formatoIncontro("A12_I9_B18")).toBe("asse 9x18");
  });
});
