import { describe, it, expect } from "vitest";
import { formatDate, formatPrice, startOfTodayRome } from "./format";

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
    expect(formatDate(new Date("2026-01-15T12:00:00Z"))).toBe("15/01/26");
    // Timezone-independent: 22:30Z = 00:30 Europe/Rome next day (CEST)
    expect(formatDate(new Date("2026-07-04T22:30:00Z"))).toBe("05/07/26");
  });
});

describe("startOfTodayRome", () => {
  it("inverno (CET, +1) → mezzanotte Roma = 23:00Z del giorno prima", () => {
    const r = startOfTodayRome(new Date("2026-01-15T10:00:00Z"));
    expect(r.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("estate (CEST, +2) → mezzanotte Roma = 22:00Z del giorno prima", () => {
    const r = startOfTodayRome(new Date("2026-07-06T10:00:00Z"));
    expect(r.toISOString()).toBe("2026-07-05T22:00:00.000Z");
  });

  it("subito dopo mezzanotte Roma (ancora giorno UTC precedente) → confine ≤ now e cattura il giorno di Roma", () => {
    const now = new Date("2026-07-05T22:30:00Z"); // Roma 2026-07-06 00:30 CEST
    const r = startOfTodayRome(now);
    expect(r.toISOString()).toBe("2026-07-05T22:00:00.000Z");
    expect(r.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
