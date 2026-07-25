// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { open } = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/components/listino/listino-viewer-provider", () => ({
  useListinoViewer: () => ({ open }),
}));

import { InlineProducts } from "./inline-products";
import type { ChatProductSummary } from "@/lib/chat/chat-events";

afterEach(() => {
  cleanup();
  open.mockReset();
});

const product: ChatProductSummary = {
  id: "p1",
  agbCode: "E10073.10.16",
  name: "COMPACT DX",
  shortDescription: "Cerniere · ACCIAIO",
  basePrice: 51.59,
  priceUnit: "EUR",
  isAvailable: true,
  stockQuantity: 4,
  listinoPage: 418,
};

describe("InlineProducts", () => {
  it("non renderizza nulla con lista vuota", () => {
    const { container } = render(<InlineProducts products={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("la chip mostra il conteggio ed è chiusa di default", () => {
    render(<InlineProducts products={[product]} />);
    expect(screen.getByRole("button", { name: /1 prodotto/ })).toBeTruthy();
    expect(screen.queryByText("E10073.10.16")).toBeNull();
  });

  it("pluralizza il conteggio con più prodotti", () => {
    const second: ChatProductSummary = { ...product, id: "p2", agbCode: "B00590.15.03" };
    render(<InlineProducts products={[product, second]} />);
    expect(screen.getByRole("button", { name: /2 prodotti/ })).toBeTruthy();
  });

  it("click sulla chip espande la lista con le card", () => {
    render(<InlineProducts products={[product]} />);
    fireEvent.click(screen.getByRole("button", { name: /1 prodotto/ }));
    expect(screen.getByText("E10073.10.16")).toBeTruthy();
    expect(screen.getByText("COMPACT DX").closest("a")?.getAttribute("href")).toBe("/archivio/p1");
    expect(screen.getByText(/51,59/)).toBeTruthy();
    expect(screen.getByText(/disponibile/i)).toBeTruthy();
  });

  it("il codice AGB è reso in monospace", () => {
    render(<InlineProducts products={[product]} />);
    fireEvent.click(screen.getByRole("button", { name: /1 prodotto/ }));
    const code = screen.getByText("E10073.10.16");
    expect(code.className).toContain("font-mono");
  });

  it("mostra il pulsante listino quando listinoPage è impostato", () => {
    render(<InlineProducts products={[product]} />);
    fireEvent.click(screen.getByRole("button", { name: /1 prodotto/ }));
    expect(screen.getByLabelText(/visualizza .* nel listino/i)).toBeTruthy();
  });

  it("nasconde il pulsante listino quando listinoPage è null", () => {
    render(<InlineProducts products={[{ ...product, listinoPage: null }]} />);
    fireEvent.click(screen.getByRole("button", { name: /1 prodotto/ }));
    expect(screen.queryByLabelText(/visualizza .* nel listino/i)).toBeNull();
  });

  it("prodotto non disponibile mostra il badge corretto", () => {
    render(<InlineProducts products={[{ ...product, isAvailable: false }]} />);
    fireEvent.click(screen.getByRole("button", { name: /1 prodotto/ }));
    expect(screen.getByText("Non disponibile")).toBeTruthy();
  });
});
