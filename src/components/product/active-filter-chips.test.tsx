// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ActiveFilterChips } from "./active-filter-chips";

afterEach(cleanup);

const noop = () => undefined;

describe("ActiveFilterChips", () => {
  it("nessun chip → non renderizza nulla", () => {
    const { container } = render(
      <ActiveFilterChips filters={{}} categoryName={() => undefined} onRemove={noop} onClearAll={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("mostra i chip attivi con nome categoria risolto", () => {
    render(
      <ActiveFilterChips
        filters={{ categoryId: "c1", inStockOnly: true }}
        categoryName={(id) => (id === "c1" ? "Cerniere" : undefined)}
        onRemove={noop}
        onClearAll={noop}
      />,
    );
    expect(screen.getByText(/Categoria: Cerniere/)).toBeDefined();
    expect(screen.getByText(/Solo disponibili/)).toBeDefined();
  });

  it("il ✕ del prezzo rimuove entrambe le chiavi; 'Azzera tutto' chiama onClearAll", () => {
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(
      <ActiveFilterChips
        filters={{ priceMin: 10, priceMax: 50 }}
        categoryName={() => undefined}
        onRemove={onRemove}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Rimuovi filtro Prezzo/));
    expect(onRemove).toHaveBeenCalledWith(["priceMin", "priceMax"]);
    fireEvent.click(screen.getByText("Azzera tutto"));
    expect(onClearAll).toHaveBeenCalled();
  });
});
