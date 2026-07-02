// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SpecTable } from "./product-detail";

afterEach(cleanup);

describe("SpecTable", () => {
  it("renders Italian labels for known specification keys, skips nulls", () => {
    render(
      <SpecTable
        specifications={{
          finitura: "Ottonato lucido",
          materiale: "ACCIAIO",
          mano: null,
          confezione: { scatola: 25, cartone: 250 },
        }}
      />,
    );
    expect(screen.getByText("Finitura")).toBeTruthy();
    expect(screen.getByText("Ottonato lucido")).toBeTruthy();
    expect(screen.getByText("Materiale")).toBeTruthy();
    expect(screen.getByText(/25 pz \/ cartone 250/)).toBeTruthy();
    expect(screen.queryByText("Mano")).toBeNull();
  });

  it("renders nothing for empty specifications", () => {
    const { container } = render(<SpecTable specifications={{}} />);
    expect(container.textContent).toBe("");
  });

  it("tolerates non-object specifications", () => {
    const { container } = render(<SpecTable specifications={null} />);
    expect(container.textContent).toBe("");
  });
});
