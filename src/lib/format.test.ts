import { describe, it, expect } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it("formatta in EUR it-IT", () => {
    // NBSP/narrow-NBSP normalizzati per stabilità cross-ICU.
    expect(formatPrice(1.23).replace(/[  ]/g, " ")).toBe("1,23 €");
    expect(formatPrice(13357 / 100).replace(/[  ]/g, " ")).toBe("133,57 €");
  });
});
