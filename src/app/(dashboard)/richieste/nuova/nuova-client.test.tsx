// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const createMutate = vi.fn();
const generateMutate = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: {
    kit: {
      create: { useMutation: () => ({ mutateAsync: createMutate, isPending: false }) },
      generate: { useMutation: () => ({ mutateAsync: generateMutate, isPending: false, error: null }) },
    },
  },
}));

import { NuovaRichiestaClient } from "./nuova-client";

afterEach(() => {
  cleanup();
  push.mockReset();
  createMutate.mockReset();
  generateMutate.mockReset();
});

describe("NuovaRichiestaClient", () => {
  it("parte dallo step 1 con ARTECH/anta-ribalta preselezionati", () => {
    render(<NuovaRichiestaClient />);
    expect(screen.getByText(/anta.?ribalta/i)).toBeTruthy();
    expect(screen.getByText(/artech/i)).toBeTruthy();
  });

  it("materiale: LEGNO e PVC selezionabili, ALLUMINIO disabilitato (gated)", () => {
    render(<NuovaRichiestaClient />);
    const materiale = screen.getByRole("group", { name: /materiale/i });
    const legno = within(materiale).getByRole("radio", { name: /legno/i }) as HTMLInputElement;
    const pvc = within(materiale).getByRole("radio", { name: /pvc/i }) as HTMLInputElement;
    const alluminio = within(materiale).getByRole("radio", { name: /alluminio/i }) as HTMLInputElement;

    expect(legno.checked).toBe(true);
    expect(legno.disabled).toBe(false);
    expect(pvc.disabled).toBe(false); // PVC ora attivo (provvisorio, in validazione)
    expect(alluminio.disabled).toBe(true); // ALLUMINIO gated: manca il listino
    expect(within(materiale).getByText(/non ancora disponibile/i)).toBeTruthy();
  });

  it("seleziona PVC aggiornando il materiale", () => {
    render(<NuovaRichiestaClient />);
    const materiale = screen.getByRole("group", { name: /materiale/i });
    const pvc = within(materiale).getByRole("radio", { name: /pvc/i }) as HTMLInputElement;
    fireEvent.click(pvc);
    expect(pvc.checked).toBe(true);
  });

  it("radio disabilitata (ALLUMINIO): l'hint è descrizione (aria-describedby), non parte del nome accessibile", () => {
    render(<NuovaRichiestaClient />);
    const materiale = screen.getByRole("group", { name: /materiale/i });
    const alu = within(materiale).getByRole("radio", { name: /alluminio/i });
    const describedby = alu.getAttribute("aria-describedby");
    expect(describedby).toBeTruthy();
    expect(document.getElementById(describedby!)?.textContent).toMatch(/non ancora disponibile/i);
  });

  it("blocca lo step dimensioni se fuori range", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.change(screen.getByLabelText(/larghezza/i), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.getByRole("alert").textContent?.length).toBeGreaterThan(0);
  });

  it("finitura: propone ARGENTO come unica opzione (tabella coperture ARTECH legno)", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3 (default validi)
    const select = screen.getByLabelText(/finitura/i) as HTMLSelectElement;
    expect(select.value).toBe("ARGENTO");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["ARGENTO"]);
  });

  it("toggle chiusure supplementari: default off, attivabile", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    const toggle = screen.getByLabelText(/chiusure supplementari/i) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
  });

  it("al riepilogo genera: create → generate → redirect al dettaglio", async () => {
    createMutate.mockResolvedValue({ id: "k9", requestNumber: "KIT-2026-0001" });
    generateMutate.mockResolvedValue({ totalComponents: 20 });
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // default validi
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/richieste/k9"));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ material: "LEGNO", supplementaryClosures: false }),
    );
    expect(generateMutate).toHaveBeenCalledWith({ kitRequestId: "k9" });
  });
});
