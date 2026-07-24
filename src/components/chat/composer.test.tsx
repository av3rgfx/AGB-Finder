// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Composer } from "./composer";

afterEach(cleanup);

function textarea() {
  return screen.getByLabelText("Messaggio per l'assistente") as HTMLTextAreaElement;
}

describe("Composer", () => {
  it("Invio invia il messaggio e svuota il campo", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} streaming={false} onStop={vi.fn()} />);
    fireEvent.change(textarea(), { target: { value: "ciao mondo" } });
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("ciao mondo");
    expect(textarea().value).toBe("");
  });

  it("Shift+Invio non invia (va a capo)", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} streaming={false} onStop={vi.fn()} />);
    fireEvent.change(textarea(), { target: { value: "riga" } });
    fireEvent.keyDown(textarea(), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("il bottone Invia è disabilitato a campo vuoto", () => {
    render(<Composer onSend={vi.fn()} streaming={false} onStop={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Invia messaggio" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("il submit del form non invia con campo vuoto/spazi", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} streaming={false} onStop={vi.fn()} />);
    fireEvent.change(textarea(), { target: { value: "   " } });
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("mentre streaming mostra STOP invece di Invia, e il click chiama onStop", () => {
    const onStop = vi.fn();
    render(<Composer onSend={vi.fn()} streaming onStop={onStop} />);
    expect(screen.queryByRole("button", { name: "Invia messaggio" })).toBeNull();
    const stopBtn = screen.getByRole("button", { name: "Interrompi" });
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });

  it("Invio durante la composizione IME non invia (isComposing)", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} streaming={false} onStop={vi.fn()} />);
    fireEvent.change(textarea(), { target: { value: "ねこ" } });
    fireEvent.keyDown(textarea(), { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("Invio non invia mentre streaming", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} streaming onStop={vi.fn()} />);
    fireEvent.change(textarea(), { target: { value: "ciao" } });
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("il contatore caratteri compare solo oltre soglia (3500)", () => {
    render(<Composer onSend={vi.fn()} streaming={false} onStop={vi.fn()} />);
    fireEvent.change(textarea(), { target: { value: "a".repeat(100) } });
    expect(screen.queryByText(/\/4000/)).toBeNull();
    fireEvent.change(textarea(), { target: { value: "a".repeat(3501) } });
    expect(screen.getByText("3501/4000")).toBeTruthy();
  });

  it("disabled=true impedisce l'invio anche a campo pieno", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} streaming={false} onStop={vi.fn()} disabled />);
    fireEvent.change(textarea(), { target: { value: "ciao" } });
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });
});
