// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveScroll, loadScroll, clearScroll, shouldRestoreScroll } from "./archivio-scroll";

beforeEach(() => window.sessionStorage.clear());

describe("save/load/clear per chiave", () => {
  it("roundtrip e clear", () => {
    saveScroll("k1", 320.7);
    expect(loadScroll("k1")).toBe(321); // arrotondato
    clearScroll("k1");
    expect(loadScroll("k1")).toBeNull();
  });

  it("null su chiave assente o vuota", () => {
    expect(loadScroll("nope")).toBeNull();
    expect(loadScroll("")).toBeNull();
    saveScroll("", 10);
    expect(loadScroll("")).toBeNull();
  });

  it("fail-soft se sessionStorage lancia (quota/private)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveScroll("k", 1)).not.toThrow();
    spy.mockRestore();
  });
});

describe("shouldRestoreScroll", () => {
  const ok = {
    hasData: true,
    isPlaceholder: false,
    viewLoaded: true,
    categoriesReady: true,
    alreadyRestored: false,
    savedY: 100,
  };
  it("true solo con tutte le condizioni", () => {
    expect(shouldRestoreScroll(ok)).toBe(true);
    expect(shouldRestoreScroll({ ...ok, hasData: false })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, isPlaceholder: true })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, viewLoaded: false })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, categoriesReady: false })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, alreadyRestored: true })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, savedY: null })).toBe(false);
  });
});
