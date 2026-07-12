import { describe, it, expect } from "vitest";
import { PER_MANO, MOVIMENTO_ANGOLARE, incontriNottolino } from "./artech-legno-shared";

describe("artech-legno-shared", () => {
  it("PER_MANO ha varianti DX/SX per squadra angolare e supporto cerniera", () => {
    expect(PER_MANO.DESTRA.squadraAngolare).toBe("A50904.36.01");
    expect(PER_MANO.SINISTRA.squadraAngolare).toBe("A50904.36.02");
    expect(PER_MANO.DESTRA.supportoCerniera).toBe("A50801.01.01");
    expect(PER_MANO.SINISTRA.supportoCerniera).toBe("A50801.01.02");
  });

  it("MOVIMENTO_ANGOLARE è il fisso 125x125 in quantità 2", () => {
    expect(MOVIMENTO_ANGOLARE.code).toBe("A50302.01.02");
    expect(MOVIMENTO_ANGOLARE.quantity).toBe(2);
  });

  it("incontriNottolino: 2 base + scatti passo 600 in altezza e larghezza", () => {
    expect(incontriNottolino(550, 1820)).toBe(5); // golden A/R: 2+floor(1820/600)+floor(550/600)
    expect(incontriNottolino(600, 1300)).toBe(5); // golden battente: 2+floor(1300/600)+floor(600/600)
  });
});
