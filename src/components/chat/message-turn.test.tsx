// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/listino/listino-viewer-provider", () => ({
  useListinoViewer: () => ({ open: vi.fn() }),
}));

import { MessageTurn } from "./message-turn";
import type { ChatProductSummary } from "@/lib/chat/chat-events";

afterEach(cleanup);

const product: ChatProductSummary = {
  id: "p1",
  agbCode: "E10073.10.16",
  name: "COMPACT DX",
  shortDescription: null,
  basePrice: 51.59,
  priceUnit: "EUR",
  isAvailable: true,
  stockQuantity: 4,
  listinoPage: null,
};

describe("MessageTurn", () => {
  it("il messaggio utente è una pill allineata a destra", () => {
    render(<MessageTurn role="USER" content="ciao" />);
    const root = screen.getByText("ciao").closest("[data-role]");
    expect(root?.getAttribute("data-role")).toBe("USER");
    expect(root?.className).toContain("justify-end");
  });

  it("il messaggio assistant è full-width, senza bolla né bordo sinistro colorato", () => {
    const { container } = render(<MessageTurn role="ASSISTANT" content="Ciao, come posso aiutarti?" />);
    const root = container.querySelector('[data-role="ASSISTANT"]');
    expect(root).not.toBeNull();
    // Nessuna classe di bordo sinistro (il vecchio design di message-bubble.tsx usava
    // `border-l-[3px] border-brand bg-brand-light`) né bolla piena sul contenuto.
    expect(container.innerHTML).not.toContain("border-l-");
    expect(screen.getByText("Assistente")).toBeTruthy();
  });

  it("mostra il testo markdown dell'assistente", () => {
    render(<MessageTurn role="ASSISTANT" content="Ti consiglio la **E10073.10.16**." />);
    expect(screen.getByText("E10073.10.16")).toBeTruthy();
  });

  it("Copia copia il markdown grezzo (non il testo renderizzato) e mostra il feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<MessageTurn role="ASSISTANT" content="Ti consiglio la **E10073.10.16**." />);
    fireEvent.click(screen.getByRole("button", { name: "Copia risposta" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Ti consiglio la **E10073.10.16**."),
    );
    expect(screen.getByRole("button", { name: "Risposta copiata" })).toBeTruthy();
  });

  it("Rigenera chiama onRegenerate", () => {
    const onRegenerate = vi.fn();
    render(<MessageTurn role="ASSISTANT" content="Risposta completa." onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getByRole("button", { name: "Rigenera" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("mentre streaming mostra il cursore e nasconde le azioni", () => {
    const { container } = render(
      <MessageTurn role="ASSISTANT" content="Sto scrivendo" streaming onRegenerate={vi.fn()} />,
    );
    expect(container.querySelector(".chat-caret")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Copia risposta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rigenera" })).toBeNull();
  });

  it("stato ERROR mostra il messaggio d'errore e Riprova chiama onRegenerate", () => {
    const onRegenerate = vi.fn();
    render(
      <MessageTurn
        role="ASSISTANT"
        content=""
        status="ERROR"
        errorMessage="Assistente momentaneamente non disponibile."
        onRegenerate={onRegenerate}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("momentaneamente non disponibile");
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("stato ERROR senza onRegenerate non mostra bottone di retry", () => {
    render(<MessageTurn role="ASSISTANT" content="" status="ERROR" errorMessage="Errore." />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("i prodotti citati appaiono sotto la risposta via InlineProducts", () => {
    render(<MessageTurn role="ASSISTANT" content="Ecco un articolo." products={[product]} />);
    expect(screen.getByRole("button", { name: /1 prodotto/ })).toBeTruthy();
  });

  it("senza prodotti non mostra la chip", () => {
    render(<MessageTurn role="ASSISTANT" content="Nessun prodotto citato." products={[]} />);
    expect(screen.queryByRole("button", { name: /prodott/ })).toBeNull();
  });
});
