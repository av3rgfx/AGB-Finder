// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { StockBadge } from "./stock-badge";

afterEach(cleanup);

describe("StockBadge", () => {
  it("in pronta consegna: testo esplicito e pillola verde chiara", () => {
    const { container } = render(<StockBadge inStock />);
    const badge = screen.getByText("In pronta consegna");
    expect(badge.className).toContain("bg-[#EAF4EC]");
    expect(badge.className).toContain("text-[#215C2C]");
    // Pallino PIENO: il colore non è mai l'unico canale, ma la forma aiuta.
    expect(container.querySelector(".bg-success")).toBeTruthy();
  });

  it("da ordinare: testo esplicito, pillola neutra, pallino vuoto", () => {
    const { container } = render(<StockBadge inStock={false} />);
    const badge = screen.getByText("Da ordinare");
    expect(badge.className).toContain("bg-surface-sunken");
    expect(container.querySelector(".bg-success")).toBeNull();
    // Vuoto = solo bordo, niente riempimento.
    const dot = container.querySelector("span > span");
    expect(dot?.className).toContain("border");
    expect(dot?.className).toContain("rounded-full");
  });

  // «Da ordinare» è la condizione ORDINARIA (3.278 su 3.456): colorarla di
  // rosso trasformerebbe la normalità in un allarme, e in due giorni l'agente
  // smetterebbe di guardare i colori.
  it("«Da ordinare» non è mai rosso", () => {
    const { container } = render(<StockBadge inStock={false} />);
    const markup = container.innerHTML;
    expect(markup).not.toMatch(/danger|text-red|bg-red|#B32424/i);
  });

  // Lo stato non deve MAI dipendere dal solo colore.
  it("lo stato è sempre scritto a parole", () => {
    const { container: si } = render(<StockBadge inStock />);
    expect(si.textContent).toBe("In pronta consegna");
    cleanup();
    const { container: no } = render(<StockBadge inStock={false} />);
    expect(no.textContent).toBe("Da ordinare");
  });

  it("il pallino è decorativo per gli screen reader", () => {
    const { container } = render(<StockBadge inStock />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});
