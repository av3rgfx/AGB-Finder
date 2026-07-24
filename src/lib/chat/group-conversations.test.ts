import { describe, it, expect } from "vitest";
import { groupConversations } from "./group-conversations";

const now = new Date("2026-07-24T12:00:00Z");

describe("groupConversations", () => {
  it("assegna i gruppi per data", () => {
    const g = groupConversations(
      [
        { id: "a", title: "A", updatedAt: new Date("2026-07-24T09:00:00Z") },
        { id: "b", title: "B", updatedAt: new Date("2026-07-23T09:00:00Z") },
        { id: "c", title: "C", updatedAt: new Date("2026-07-20T09:00:00Z") },
        { id: "d", title: "D", updatedAt: new Date("2026-06-01T09:00:00Z") },
      ],
      now
    );
    expect(g.map((x) => x.label)).toEqual([
      "Oggi",
      "Ieri",
      "Ultimi 7 giorni",
      "Più vecchie",
    ]);
  });

  it("omette i gruppi vuoti", () => {
    const g = groupConversations([{ id: "a", title: "A", updatedAt: now }], now);
    expect(g).toHaveLength(1);
    expect(g[0]!.label).toBe("Oggi");
  });

  it("gestisce lista vuota", () => {
    const g = groupConversations([], now);
    expect(g).toHaveLength(0);
  });

  it("mette item futuro in Oggi", () => {
    const future = new Date("2026-07-24T23:59:59Z");
    const g = groupConversations(
      [{ id: "x", title: "X", updatedAt: future }],
      now
    );
    expect(g).toHaveLength(1);
    expect(g[0]!.label).toBe("Oggi");
  });
});
