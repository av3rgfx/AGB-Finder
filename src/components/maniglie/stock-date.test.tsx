// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { StockDate, formatStockDate } from "./stock-date";

afterEach(cleanup);

describe("formatStockDate", () => {
  it("formato esteso italiano", () => {
    expect(formatStockDate(new Date("2026-07-28T09:00:00Z"))).toBe("28 luglio 2026");
  });

  // Il server è in UTC, il giorno di calendario è quello di Roma: le 23:30 UTC
  // del 27 luglio sono già il 28 in Italia.
  it("usa il fuso di Roma, non UTC", () => {
    expect(formatStockDate(new Date("2026-07-27T23:30:00Z"))).toBe("28 luglio 2026");
  });
});

describe("StockDate", () => {
  it("dice a quando è aggiornata la pronta consegna, con la data in evidenza", () => {
    render(<StockDate importedAt={new Date("2026-07-28T09:00:00Z")} />);
    expect(screen.getByText(/Pronta consegna aggiornata al/)).toBeTruthy();
    const forte = screen.getByText("28 luglio 2026");
    expect(forte.tagName).toBe("STRONG");
  });

  it("è una fascia bassa (surface-sunken) con l'icona orologio", () => {
    const { container } = render(<StockDate importedAt={new Date("2026-07-28T09:00:00Z")} />);
    expect(container.firstElementChild?.className).toContain("bg-surface-sunken");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  // Senza import NON si inventa una data: si dice che il dato non c'è.
  it("senza pronta consegna caricata non scrive alcuna data", () => {
    const { container } = render(<StockDate importedAt={null} />);
    expect(screen.getByText("Nessuna pronta consegna caricata")).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d{4}/);
    expect(container.textContent).not.toMatch(/aggiornata/i);
  });
});
