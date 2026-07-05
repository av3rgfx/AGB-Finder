import { describe, it, expect } from "vitest";
import { formatDate, formatPrice } from "./format";

describe("formatPrice", () => {
  it("formatta in EUR it-IT", () => {
    // NBSP/narrow-NBSP normalizzati per stabilità cross-ICU.
    expect(formatPrice(1.23).replace(/[  ]/g, " ")).toBe("1,23 €");
    expect(formatPrice(13357 / 100).replace(/[  ]/g, " ")).toBe("133,57 €");
  });
});

describe("formatDate", () => {
  it("formatta in stile it-IT (gg/mm/aa)", () => {
    expect(formatDate("2026-07-05T10:00:00Z")).toBe("05/07/26");
    expect(formatDate(new Date("2026-01-15T00:00:00Z"))).toBe("15/01/26");
  });
});
