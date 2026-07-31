// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfiloSerramento } from "./profilo-serramento";
import type { CustomerOption } from "./customer-picker";
import { geometriaLabel } from "@/server/kit/artech-geometrie";

afterEach(cleanup);

const FOSCA: CustomerOption = {
  id: "c1",
  companyName: "Fosca",
  discount: null,
  kitGeometry: "A12_I13_B18",
  kitEntrata: "E15",
};

describe("ProfiloSerramento", () => {
  it("non mostra nulla senza cliente", () => {
    const { container } = render(<ProfiloSerramento cliente={null} onApplica={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("non mostra nulla se il cliente non ha profilo", () => {
    const { container } = render(
      <ProfiloSerramento
        cliente={{ ...FOSCA, kitGeometry: null, kitEntrata: null }}
        onApplica={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("mostra i valori del profilo e di chi e`", () => {
    render(<ProfiloSerramento cliente={FOSCA} onApplica={vi.fn()} />);
    expect(screen.getByText(/Profilo di Fosca/)).toBeTruthy();
    expect(screen.getByText(new RegExp(geometriaLabel("A12_I13_B18")))).toBeTruthy();
    expect(screen.getByText(/Entrata 15/)).toBeTruthy();
  });

  // L'etichetta dice cio` che e` vero: il profilo lo digita l'agente, dalla
  // stessa memoria che e` il punto di rottura. Spacciarlo per un dato accertato
  // scoraggerebbe il controllo proprio dove serve.
  it("dichiara che il profilo non e` mai stato confrontato con un ordine", () => {
    render(<ProfiloSerramento cliente={FOSCA} onApplica={vi.fn()} />);
    expect(screen.getByText(/mai confrontato con un ordine/i)).toBeTruthy();
  });

  it("il pulsante applica entrambi i valori in un colpo", async () => {
    const onApplica = vi.fn();
    render(<ProfiloSerramento cliente={FOSCA} onApplica={onApplica} />);
    await userEvent.click(screen.getByRole("button", { name: /usa il profilo/i }));
    expect(onApplica).toHaveBeenCalledWith({ geometry: "A12_I13_B18", entrata: "E15" });
  });

  it("applica solo cio` che il profilo contiene", async () => {
    const onApplica = vi.fn();
    render(<ProfiloSerramento cliente={{ ...FOSCA, kitEntrata: null }} onApplica={onApplica} />);
    await userEvent.click(screen.getByRole("button", { name: /usa il profilo/i }));
    expect(onApplica).toHaveBeenCalledWith({ geometry: "A12_I13_B18" });
  });

  // Regola inviolabile «mobile-first»: a 375px il pulsante affiancato a due
  // righe di testo lungo si schiaccia a due caratteri.
  it("in colonna sotto sm, in riga sopra", () => {
    const { container } = render(<ProfiloSerramento cliente={FOSCA} onApplica={vi.fn()} />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toContain("flex-col");
    expect(box.className).toContain("sm:flex-row");
  });
});
