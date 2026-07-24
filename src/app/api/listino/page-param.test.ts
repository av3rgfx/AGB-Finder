import { describe, it, expect } from "vitest";
import { parsePageParam } from "./page-param";

describe("parsePageParam", () => {
  const TOTAL = 959;

  it("accetta interi canonici in [1, total]", () => {
    expect(parsePageParam("1", TOTAL)).toBe(1);
    expect(parsePageParam("418", TOTAL)).toBe(418);
    expect(parsePageParam("959", TOTAL)).toBe(959);
  });

  it("rifiuta null / vuoto / non numerico", () => {
    expect(parsePageParam(null, TOTAL)).toBeNull();
    expect(parsePageParam("", TOTAL)).toBeNull();
    expect(parsePageParam("abc", TOTAL)).toBeNull();
    expect(parsePageParam("12abc", TOTAL)).toBeNull();
  });

  it("rifiuta forme non canoniche (zeri iniziali, segni, float, notazione, spazi)", () => {
    expect(parsePageParam("0", TOTAL)).toBeNull();
    expect(parsePageParam("01", TOTAL)).toBeNull();
    expect(parsePageParam("-1", TOTAL)).toBeNull();
    expect(parsePageParam("1.5", TOTAL)).toBeNull();
    expect(parsePageParam("1e3", TOTAL)).toBeNull();
    expect(parsePageParam(" 1", TOTAL)).toBeNull();
    expect(parsePageParam("1 ", TOTAL)).toBeNull();
    expect(parsePageParam("+1", TOTAL)).toBeNull();
  });

  it("rifiuta fuori range (0 già coperto, e > total)", () => {
    expect(parsePageParam("960", TOTAL)).toBeNull();
    expect(parsePageParam("100000", TOTAL)).toBeNull();
  });
});
