// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/listino/listino-viewer-provider", () => ({
  useListinoViewer: () => ({ open: () => undefined }),
}));

import { ProductRow } from "./product-row";

afterEach(cleanup);

const base = {
  id: "p1",
  agbCode: "B00590.15.03",
  name: "Cerniera X",
  basePrice: 1.23,
  categoryName: "Serrature",
  isAvailable: true,
};

describe("ProductRow", () => {
  it("linka al dettaglio, codice mono, senza listinoPage niente pulsante", () => {
    render(<ProductRow product={base} />);
    expect(screen.getByRole("link")).toHaveProperty(
      "href",
      expect.stringContaining("/archivio/p1"),
    );
    expect(screen.getByText("B00590.15.03").className).toContain("font-mono");
    expect(screen.queryByLabelText(/nel listino/)).toBeNull();
  });

  it("con listinoPage mostra il pulsante listino", () => {
    render(<ProductRow product={{ ...base, listinoPage: 42 }} />);
    expect(screen.getByLabelText("Visualizza B00590.15.03 nel listino")).toBeDefined();
  });
});
