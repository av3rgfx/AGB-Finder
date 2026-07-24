// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ProductImage } from "./product-image";

afterEach(() => cleanup());

describe("ProductImage", () => {
  it("punta alla route con il codice", () => {
    render(<ProductImage code="E10157.14.93" />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/api/product-image?code=E10157.14.93");
    expect(img.getAttribute("alt")).toContain("E10157.14.93");
  });

  it("si nasconde se l'immagine non carica (404)", () => {
    const { container } = render(<ProductImage code="E10157.14.93" />);
    fireEvent.error(screen.getByRole("img"));
    expect(container.querySelector("img")).toBeNull();
  });

  it("mostra il fallback su errore quando fornito", () => {
    render(<ProductImage code="X" fallback={<span data-testid="ph">ph</span>} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByTestId("ph")).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
