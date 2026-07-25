// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { CodeBlock } from "./code-block";

afterEach(cleanup);

describe("CodeBlock", () => {
  it("mostra il codice e il pulsante di copia", () => {
    render(<CodeBlock>{"A50122"}</CodeBlock>);
    expect(screen.getByText("A50122")).toBeDefined();
    expect(screen.getByRole("button", { name: "Copia codice" })).toBeDefined();
  });

  it("copia il testo negli appunti e mostra il feedback Copiato", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CodeBlock>{"A50122\nB00590.15.03"}</CodeBlock>);
    fireEvent.click(screen.getByRole("button", { name: "Copia codice" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("A50122\nB00590.15.03"));
    expect(screen.getByText("Copiato")).toBeDefined();
  });

  it("non lancia eccezioni se la clipboard non è disponibile", () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    render(<CodeBlock>{"A50122"}</CodeBlock>);
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Copia codice" })),
    ).not.toThrow();
  });
});
