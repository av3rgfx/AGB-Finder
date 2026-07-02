// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SpecTable } from "./spec-table";

afterEach(cleanup);

describe("SpecTable", () => {
  it("rende le specifiche con etichette italiane e formatta la confezione", () => {
    render(
      <SpecTable
        specifications={{
          finitura: "Ottonato lucido",
          materiale: "ACCIAIO",
          confezione: { scatola: 25, cartone: 250 },
          classeSconto: "A2",
          colonne: { lunghezza: "238 mm" }, // grezzo: NON visualizzato
        }}
      />,
    );
    expect(screen.getByText("Finitura")).toBeDefined();
    expect(screen.getByText("Ottonato lucido")).toBeDefined();
    expect(screen.getByText("Confezione")).toBeDefined();
    expect(screen.getByText("25 pz/scatola · 250 pz/cartone")).toBeDefined();
    expect(screen.queryByText("colonne")).toBeNull();
    expect(screen.queryByText("lunghezza")).toBeNull();
  });

  it("non rende nulla senza specifiche", () => {
    const { container } = render(<SpecTable specifications={null} />);
    expect(container.innerHTML).toBe("");
  });
});
