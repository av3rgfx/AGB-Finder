import { describe, it, expect } from "vitest";
import { decodeVision } from "./vision-decode";

describe("decodeVision", () => {
  it("scala di +29 i byte di testo", () => {
    // «9LVLRQ» cifrato vale «Vision»: è la firma con cui si riconosce il file.
    expect(decodeVision(Buffer.from("9LVLRQ", "latin1"))).toBe("Vision");
  });

  it("NON tocca i byte di struttura: \\n, \\f, \\r e lo spazio", () => {
    // Scalare lo spazio lo trasforma in «=» e riempie la pagina di rumore.
    const raw = Buffer.from([0x39, 0x20, 0x0a, 0x0c, 0x0d, 0x4c]); // 9 _ \n \f \r L
    expect(decodeVision(raw)).toBe("V \n\f\ri");
  });

  it("decodifica le CIFRE, che stanno sotto il byte 32", () => {
    // Saltare i byte < 32 perde esattamente le cifre: lo «0» cifrato è \x13.
    // È l'errore che aveva fatto concludere che nel PDF non ci fossero prezzi.
    // '0'=0x30-29=0x13 · '3'=0x33-29=0x16 · ','=0x2c-29=0x0f · '2'=0x15 · '5'=0x18
    expect(decodeVision(Buffer.from([0x13, 0x16, 0x0f, 0x15, 0x18]))).toBe("03,25");
  });

  it("torna indietro oltre 255 senza esplodere", () => {
    expect(decodeVision(Buffer.from([0xff]))).toBe(String.fromCharCode(28));
  });
});
