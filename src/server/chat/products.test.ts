import { describe, it, expect } from "vitest";
import { CHAT_PRODUCT_SELECT } from "./products";

describe("CHAT_PRODUCT_SELECT", () => {
  it("non seleziona i campi di disponibilità", () => {
    expect("isAvailable" in CHAT_PRODUCT_SELECT).toBe(false);
    expect("stockQuantity" in CHAT_PRODUCT_SELECT).toBe(false);
  });
});
