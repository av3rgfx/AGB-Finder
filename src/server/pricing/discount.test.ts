import { describe, expect, it } from "vitest";
import {
  applicaSconto,
  centToEuro,
  euroToCent,
  scontoPercentSchema,
  superaSoglia,
} from "./discount";

describe("applicaSconto", () => {
  it("il caso del golden: 90,20 € meno 40% fa 54,12 €", () => {
    expect(applicaSconto(9020, 40)).toEqual({ nettoCent: 5412, scontoCent: 3608 });
  });

  it("senza sconto il netto è il lordo", () => {
    expect(applicaSconto(9020, null)).toEqual({ nettoCent: 9020, scontoCent: 0 });
  });

  it("sconto zero è come nessuno sconto", () => {
    expect(applicaSconto(9020, 0)).toEqual({ nettoCent: 9020, scontoCent: 0 });
  });

  it("sconto 100% azzera il netto", () => {
    expect(applicaSconto(9020, 100)).toEqual({ nettoCent: 0, scontoCent: 9020 });
  });

  it("arrotonda il mezzo centesimo per eccesso, una volta sola", () => {
    // 101 × 50 / 100 = 50,5 centesimi
    expect(applicaSconto(101, 50)).toEqual({ nettoCent: 50, scontoCent: 51 });
  });

  it("accetta le percentuali con decimali", () => {
    // 100 × 45,5 / 100 = 45,5 → 46 centesimi di sconto, netto 54
    expect(applicaSconto(100, 45.5)).toEqual({ nettoCent: 54, scontoCent: 46 });
  });

  it("netto + sconto fa sempre il lordo, su cento percentuali diverse", () => {
    for (let p = 0; p <= 100; p += 1) {
      const { nettoCent, scontoCent } = applicaSconto(9020, p);
      expect(nettoCent + scontoCent).toBe(9020);
    }
  });

  it("un lordo a zero resta a zero", () => {
    expect(applicaSconto(0, 40)).toEqual({ nettoCent: 0, scontoCent: 0 });
  });
});

describe("superaSoglia", () => {
  it("nessuno sconto non può essere fuori soglia", () => {
    expect(superaSoglia(null, 40)).toBe(false);
  });

  it("il confronto è stretto: pari alla soglia è dentro", () => {
    expect(superaSoglia(40, 40)).toBe(false);
  });

  it("sopra la soglia è fuori", () => {
    expect(superaSoglia(40.01, 40)).toBe(true);
  });

  it("sotto la soglia è dentro", () => {
    expect(superaSoglia(39.99, 40)).toBe(false);
  });
});

describe("conversione euro/centesimi", () => {
  it("euroToCent non lascia code di virgola mobile", () => {
    // `0.29 * 100` fa 28.999999999999996 e `766.51 * 100` fa 76650.99999999999:
    // è la ragione per cui la conversione arrotonda invece di troncare.
    expect(euroToCent(0.29)).toBe(29);
    expect(euroToCent(766.51)).toBe(76651);
    // I totali veri delle distinte che abbiamo, come regressione parlante.
    expect(euroToCent(90.2)).toBe(9020);
    expect(euroToCent(96.29)).toBe(9629);
    expect(euroToCent(450.03)).toBe(45003);
  });

  it("centToEuro torna indietro", () => {
    expect(centToEuro(5412)).toBe(54.12);
    expect(centToEuro(0)).toBe(0);
  });
});

describe("scontoPercentSchema", () => {
  it.each([0, 40, 40.5, 42.5, 100, 0.01, 99.99])("accetta %s", (v) => {
    expect(scontoPercentSchema.safeParse(v).success).toBe(true);
  });

  it("accetta 40,55 — il controllo ovvio `Number.isInteger(v*100)` lo rifiuterebbe", () => {
    // 40.55 * 100 fa 4054.9999999999995: è la trappola per cui questo schema
    // vive in un posto solo invece di essere ricopiato nei due router.
    expect(Number.isInteger(40.55 * 100)).toBe(false);
    expect(scontoPercentSchema.safeParse(40.55).success).toBe(true);
  });

  it.each([-1, 101, 40.555])("rifiuta %s", (v) => {
    expect(scontoPercentSchema.safeParse(v).success).toBe(false);
  });
});
