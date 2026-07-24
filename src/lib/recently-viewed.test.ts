// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { pushViewed, getViewed } from "./recently-viewed";

beforeEach(() => window.localStorage.clear());
const p = (id: string) => ({ id, agbCode: `A${id}`, name: `Prodotto ${id}` });

describe("recently-viewed", () => {
  it("push: ultimo in testa, dedup per id, cap 8", () => {
    for (let i = 1; i <= 10; i++) pushViewed(p(String(i)));
    pushViewed(p("3")); // re-view → torna in testa senza duplicare
    const list = getViewed();
    expect(list).toHaveLength(8);
    expect(list[0]!.id).toBe("3");
    expect(list.filter((v) => v.id === "3")).toHaveLength(1);
  });

  it("getViewed: scarta voci malformate e [] su JSON rotto", () => {
    window.localStorage.setItem("archivio:recently-viewed", JSON.stringify([{ id: "x" }, p("1")]));
    expect(getViewed()).toEqual([p("1")]);
    window.localStorage.setItem("archivio:recently-viewed", "{non-json");
    expect(getViewed()).toEqual([]);
  });

  it("fail-soft se setItem lancia", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => pushViewed(p("1"))).not.toThrow();
    spy.mockRestore();
  });
});
