import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { articleTotal, parseListinoDecimal } from "./price";

const D = (v: string | number) => new Prisma.Decimal(v);

/**
 * Andrea: «nel listino è presente il prezzo già sommato e l'agente deve vedere
 * quello». Si mostra il totale, ma si salvano le DUE METÀ, perché il surcharge
 * 3,5% è *temporary* per definizione e il giorno che sparisce serve sapere quale
 * metà togliere. Il totale resta derivato, MAI persistito — stessa regola di
 * `totalPrice` nel kit.
 *
 * L'arrotondamento non è un vezzo: il 96% delle righe della colonna SOMMA ha più
 * di due decimali e il 36% ne ha 13-16 per errori di virgola mobile di Excel
 * (`99,25649999999999`). Il file NON è mostrabile com'è.
 */
describe("articleTotal", () => {
  it("somma le due metà e arrotonda a 2 decimali", () => {
    expect(articleTotal(D("101.00"), D("3.535")).toString()).toBe("104.54");
  });

  it("arrotonda 104,535 a 104,54 e non a 104,53", () => {
    // La trappola: 104.535 in virgola mobile è 104.53499999999999, quindi un
    // toFixed(2) ingenuo darebbe 104.53. Il calcolo DEVE stare in Decimal.
    expect(articleTotal(D("104.535"), D("0")).toString()).toBe("104.54");
    expect((104.535).toFixed(2)).toBe("104.53"); // documenta perché non si usa
  });

  it("assorbe la spazzatura float di Excel", () => {
    expect(articleTotal(D("99.25649999999999"), D("0")).toString()).toBe("99.26");
  });

  it("arrotonda per eccesso a metà esatta (arrotondamento standard)", () => {
    expect(articleTotal(D("1.005"), D("0")).toString()).toBe("1.01");
    expect(articleTotal(D("2.345"), D("0")).toString()).toBe("2.35");
  });

  it("un surcharge assente vale zero, non fa fallire il conto", () => {
    expect(articleTotal(D("50.00"), null).toString()).toBe("50");
  });

  it("resta esatto su un prezzo con molte cifre", () => {
    expect(articleTotal(D("1234.5678"), D("43.2088")).toString()).toBe("1277.78");
  });

  it("non è mai un numero in virgola mobile", () => {
    expect(articleTotal(D("101.00"), D("3.535"))).toBeInstanceOf(Prisma.Decimal);
  });
});

describe("parseListinoDecimal", () => {
  it("legge un numero nativo di Excel", () => {
    expect(parseListinoDecimal(104.535)?.toString()).toBe("104.535");
  });

  it("legge la virgola decimale italiana", () => {
    expect(parseListinoDecimal("104,535")?.toString()).toBe("104.535");
  });

  it("regge il separatore delle migliaia", () => {
    expect(parseListinoDecimal("1.234,56")?.toString()).toBe("1234.56");
    expect(parseListinoDecimal("1234.56")?.toString()).toBe("1234.56");
  });

  it("toglie il simbolo di valuta e gli spazi", () => {
    expect(parseListinoDecimal(" € 104,54 ")?.toString()).toBe("104.54");
  });

  it("restituisce null su cella vuota o non numerica", () => {
    // Il listino misurato ha ZERO prezzi mancanti, ma un file futuro può averne:
    // meglio una riga scartata con un avviso che un prezzo inventato a 0.
    expect(parseListinoDecimal("")).toBeNull();
    expect(parseListinoDecimal(null)).toBeNull();
    expect(parseListinoDecimal(undefined)).toBeNull();
    expect(parseListinoDecimal("n.d.")).toBeNull();
  });

  it("non scambia lo zero per assente", () => {
    expect(parseListinoDecimal(0)?.toString()).toBe("0");
    expect(parseListinoDecimal("0,00")?.toString()).toBe("0");
  });
});
