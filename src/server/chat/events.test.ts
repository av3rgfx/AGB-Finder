import { describe, it, expect } from "vitest";
import { toolLabel } from "./events";

describe("toolLabel", () => {
  it("mappa i tool noti", () => {
    expect(toolLabel("search_products")).toBe("Sto cercando nel catalogo…");
    expect(toolLabel("get_product_by_code")).toBe("Sto recuperando la scheda…");
  });

  it("fallback per tool ignoti", () => {
    expect(toolLabel("boh")).toBe("Sto consultando il catalogo…");
  });
});
