// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { ErrorBanner } from "./error-banner";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ErrorBanner", () => {
  it("errore recuperabile: countdown decrementa ogni secondo e si ferma a 0 (mai negativo)", () => {
    vi.useFakeTimers();
    render(
      <ErrorBanner
        error={{ recoverable: true, retryAfter: 3, message: "Troppe richieste." }}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Riprovo tra 3s…")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Riprovo tra 2s…")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Riprovo tra 1s…")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Pronto per un nuovo tentativo.")).toBeTruthy();

    // Ulteriori tick oltre lo zero non devono produrre un countdown negativo.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("Pronto per un nuovo tentativo.")).toBeTruthy();
    expect(screen.queryByText(/-\d/)).toBeNull();
  });

  it("pulisce l'interval allo smontaggio", () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(
      <ErrorBanner
        error={{ recoverable: true, retryAfter: 5, message: "Errore." }}
        onRetry={vi.fn()}
      />,
    );
    const callsBeforeUnmount = clearSpy.mock.calls.length;
    unmount();
    expect(clearSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);
    clearSpy.mockRestore();
  });

  it("errore recuperabile: toni warning, bottone «Riprova» chiama onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorBanner error={{ recoverable: true, message: "Errore." }} onRetry={onRetry} />);
    const btn = screen.getByRole("button", { name: "Riprova" });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalled();
  });

  it("errore non recuperabile: toni danger, bottone «Rigenera», nessun countdown", () => {
    const onRetry = vi.fn();
    render(<ErrorBanner error={{ recoverable: false, message: "Errore fatale." }} onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Errore fatale.");
    const btn = screen.getByRole("button", { name: "Rigenera" });
    expect(screen.queryByText(/Riprovo tra/)).toBeNull();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalled();
  });
});
