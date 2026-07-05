// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DistintaTable } from "./distinta-table";

afterEach(cleanup);

const components = [
  { id: "c1", componentCode: "A50122.15.07", componentName: "CREMONESE ARTECH", position: "cremonese", quantity: 1, unitPrice: 13.655, totalPrice: 13.655, ruleDescription: "Cremonese per H 1820" },
  { id: "c2", componentCode: "A51401.05.02", componentName: "INC NOTT", position: "incontri-nottolino", quantity: 5, unitPrice: 0.677, totalPrice: 3.385, ruleDescription: "Incontri nottolino" },
];

describe("DistintaTable", () => {
  it("mostra codici mono, quantità e totale kit", () => {
    render(<DistintaTable components={components} totalPrice={17.04} warnings={[]} />);
    expect(screen.getByText("A50122.15.07")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText(/17,04/)).toBeTruthy();
  });

  it("mostra i warning quando presenti", () => {
    render(<DistintaTable components={components} totalPrice={0} warnings={["Codice X non a listino: verificare con AGB."]} />);
    expect(screen.getByRole("alert").textContent).toContain("non a listino");
  });
});
