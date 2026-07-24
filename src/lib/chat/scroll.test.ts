import { describe, it, expect } from "vitest";
import { isNearBottom } from "./scroll";

describe("isNearBottom", () => {
  it("vero se vicino al fondo", () => {
    expect(
      isNearBottom({ scrollTop: 880, scrollHeight: 1000, clientHeight: 100 })
    ).toBe(true);
  });

  it("falso se staccato", () => {
    expect(
      isNearBottom({ scrollTop: 200, scrollHeight: 1000, clientHeight: 100 })
    ).toBe(false);
  });

  it("vero esattamente al threshold", () => {
    // scrollHeight(1000) - scrollTop(880) - clientHeight(100) = 20 <= 120
    expect(
      isNearBottom({ scrollTop: 880, scrollHeight: 1000, clientHeight: 100 }, 20)
    ).toBe(true);
  });

  it("falso se oltre il threshold", () => {
    // scrollHeight(1000) - scrollTop(870) - clientHeight(100) = 30 > 20
    expect(
      isNearBottom({ scrollTop: 870, scrollHeight: 1000, clientHeight: 100 }, 20)
    ).toBe(false);
  });
});
