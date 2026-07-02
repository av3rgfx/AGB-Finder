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

import { ProductCard, type ProductSummary } from "./product-card";

afterEach(cleanup);

const product: ProductSummary = {
  id: "p1",
  agbCode: "B00590.15.03",
  name: "Larghezza 22 mm, bordo tondo spessore 3 mm, Ottonato lucido, 238 mm",
  basePrice: 1.23,
  discountedPrice: null,
  isAvailable: true,
  stockQuantity: 0,
  categoryName: "Serrature",
  imageUrls: [],
};

describe("ProductCard", () => {
  it("renders the AGB code in monospace", () => {
    render(<ProductCard product={product} />);
    const code = screen.getByText("B00590.15.03");
    expect(code.className).toContain("font-mono");
  });

  it("formats the price in EUR (it-IT)", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByText(/1,23\s*€/)).toBeTruthy();
  });

  it("links to the product detail page", () => {
    render(<ProductCard product={product} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/archivio/p1");
  });

  it("shows the category name", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByText("Serrature")).toBeTruthy();
  });
});
