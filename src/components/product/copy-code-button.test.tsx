// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyCodeButton } from "./copy-code-button";

/**
 * Il pulsante è CONDIVISO coi serramenti, dove i codici sono `A50122.08.07` e
 * togliere i punti sarebbe sbagliato. Il default protegge quel reparto: senza
 * `copyAs` si copia esattamente ciò che si vede, quindi nessuna chiamata
 * esistente cambia comportamento e chi aggiunge una schermata non deve
 * ricordarsi di nulla.
 */
describe("CopyCodeButton", () => {
  const writeText = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  afterEach(cleanup);

  test("senza copyAs copia ciò che mostra — è il caso dei serramenti", async () => {
    render(<CopyCodeButton code="A50122.08.07" />);
    await userEvent.click(screen.getByRole("button"));
    expect(writeText).toHaveBeenCalledWith("A50122.08.07");
  });

  test("con copyAs mostra il codice col trattino e copia quello normalizzato", async () => {
    render(<CopyCodeButton code="0ID41R-CR" copyAs="0ID41RCR" />);
    expect(screen.getByRole("button").textContent).toContain("0ID41R-CR");
    await userEvent.click(screen.getByRole("button"));
    expect(writeText).toHaveBeenCalledWith("0ID41RCR");
  });

  test("l'etichetta accessibile nomina il codice VISIBILE, non quello copiato", () => {
    render(<CopyCodeButton code="0ID41R-CR" copyAs="0ID41RCR" />);
    expect(screen.getByLabelText("Copia codice 0ID41R-CR")).toBeDefined();
  });
});
