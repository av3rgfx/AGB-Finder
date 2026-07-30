import { describe, it, expect } from "vitest";
import { MOVIMENTO_ANGOLARE, incontriNottolino } from "./artech-legno-shared";

/**
 * `PER_MANO`, `PILOT_GEOMETRY` e `assertPilotGeometry` sono state rimosse dal
 * modulo il 2026-07-29 (cutover della geometria a discriminatore): i loro test
 * sono spariti con loro. La coppia di mano è ora in `artech-geometrie.test.ts`,
 * riga per riga; il rifiuto della sede 30 in `assertSeatConfigSupportata`.
 * Restano qui le due cose davvero condivise fra le tipologie legno.
 */
describe("artech-legno-shared", () => {
  it("MOVIMENTO_ANGOLARE è il fisso 125x125 in quantità 2", () => {
    expect(MOVIMENTO_ANGOLARE.code).toBe("A50302.01.02");
    expect(MOVIMENTO_ANGOLARE.quantity).toBe(2);
  });

  it("incontriNottolino: 2 base + scatti passo 600 in altezza e larghezza", () => {
    expect(incontriNottolino(550, 1820)).toBe(5); // golden A/R: 2+floor(1820/600)+floor(550/600)
    expect(incontriNottolino(600, 1300)).toBe(5); // golden battente: 2+floor(1300/600)+floor(600/600)
  });
});
