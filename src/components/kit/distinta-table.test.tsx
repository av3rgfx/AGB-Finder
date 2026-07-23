// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/listino/listino-viewer-provider", () => ({
  useListinoViewer: () => ({ open: vi.fn() }),
}));

import { DistintaTable } from "./distinta-table";

afterEach(cleanup);

const components = [
  { id: "c1", componentCode: "A50122.15.07", componentName: "CREMONESE ARTECH", position: "cremonese", quantity: 1, unitPrice: 13.655, totalPrice: 13.655, ruleDescription: "Cremonese per H 1820", listinoPage: 418 },
  { id: "c2", componentCode: "A51401.05.02", componentName: "INC NOTT", position: "incontri-nottolino", quantity: 5, unitPrice: 0.677, totalPrice: 3.385, ruleDescription: "Incontri nottolino", listinoPage: null },
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

  it("mostra «visualizza nel listino» solo per i componenti con pagina nota", () => {
    render(<DistintaTable components={components} totalPrice={17.04} warnings={[]} />);
    const buttons = screen.getAllByRole("button", { name: /nel listino/i });
    expect(buttons).toHaveLength(1); // solo c1 (listinoPage 418); c2 è null
  });
});
