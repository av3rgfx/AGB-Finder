// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProductCard } from "./product-card";

afterEach(cleanup);

const product = {
  id: "p1",
  agbCode: "B00590.15.03",
  name: "Larghezza 22 mm Ottonato lucido 238 mm",
  basePrice: 1.23,
  categoryName: "Serrature",
  isAvailable: true,
};

describe("ProductCard", () => {
  it("mostra il codice AGB in monospace (regola di progetto)", () => {
    render(<ProductCard product={product} />);
    const code = screen.getByText("B00590.15.03");
    expect(code.className).toContain("font-mono");
  });

  it("linka al dettaglio e mostra nome, categoria e prezzo", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByRole("link")).toHaveProperty(
      "href",
      expect.stringContaining("/archivio/p1"),
    );
    expect(screen.getByText(product.name)).toBeDefined();
    expect(screen.getByText("Serrature")).toBeDefined();
    expect(screen.getByText(/1,23/)).toBeDefined();
  });

  it("espone lo stato di disponibilità in modo accessibile", () => {
    render(<ProductCard product={{ ...product, isAvailable: false }} />);
    expect(screen.getByLabelText("Non disponibile")).toBeDefined();
  });
});
