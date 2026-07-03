// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ProductPanel } from "./product-panel";

afterEach(cleanup);

const product = {
  id: "p1",
  agbCode: "E10073.10.16",
  name: "COMPACT DX",
  shortDescription: "Cerniere · ACCIAIO",
  basePrice: 51.59,
  priceUnit: "EUR",
  isAvailable: true,
  stockQuantity: 4,
};

describe("ProductPanel", () => {
  it("stato vuoto dedicato senza prodotti", () => {
    render(<ProductPanel products={[]} />);
    expect(screen.getByText(/nessun prodotto citato/i)).toBeTruthy();
  });

  it("card prodotto con codice, prezzo e link al dettaglio Archivio", () => {
    render(<ProductPanel products={[product]} />);
    expect(screen.getByText("E10073.10.16")).toBeTruthy();
    expect(screen.getByText("COMPACT DX").closest("a")?.getAttribute("href")).toBe("/archivio/p1");
    expect(screen.getByText(/51,59/)).toBeTruthy();
    expect(screen.getByText(/disponibile/i)).toBeTruthy();
  });
});
