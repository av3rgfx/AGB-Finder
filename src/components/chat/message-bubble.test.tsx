// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MessageBubble } from "./message-bubble";

afterEach(cleanup);

describe("MessageBubble", () => {
  it("messaggio utente allineato a destra", () => {
    render(<MessageBubble role="USER" content="ciao" />);
    const bubble = screen.getByText("ciao").closest("[data-role]");
    expect(bubble?.getAttribute("data-role")).toBe("USER");
  });

  it("i codici AGB nel testo sono resi in monospace", () => {
    render(<MessageBubble role="ASSISTANT" content="Ti consiglio la E10073.10.16 per l'anta." />);
    const code = screen.getByText("E10073.10.16");
    expect(code.tagName).toBe("CODE");
  });

  it("stato ERROR: mostra il messaggio d'errore e Riprova chiama onRetry", () => {
    const onRetry = vi.fn();
    render(
      <MessageBubble
        role="ASSISTANT"
        content=""
        status="ERROR"
        errorMessage="Assistente momentaneamente non disponibile."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("momentaneamente non disponibile");
    fireEvent.click(screen.getByRole("button", { name: /riprova/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
