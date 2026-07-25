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
import { windowTypeLabel } from "@/lib/kit-labels";

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

  it("materiale: solo LEGNO selezionabile, PVC e ALLUMINIO disabilitati (gated)", () => {
    render(<NuovaRichiestaClient />);
    const materiale = screen.getByRole("group", { name: /materiale/i });
    const legno = within(materiale).getByRole("radio", { name: /legno/i }) as HTMLInputElement;
    const pvc = within(materiale).getByRole("radio", { name: /pvc/i }) as HTMLInputElement;
    const alluminio = within(materiale).getByRole("radio", { name: /alluminio/i }) as HTMLInputElement;

    expect(legno.checked).toBe(true);
    expect(legno.disabled).toBe(false);
    expect(pvc.disabled).toBe(true); // PVC gated: composizione non a listino 2026
    expect(alluminio.disabled).toBe(true); // ALLUMINIO gated: manca il listino
    expect(within(materiale).getByText(/non ancora disponibile/i)).toBeTruthy();
    expect(within(materiale).getByText(/non a listino 2026/i)).toBeTruthy();
  });

  it("il PVC è gated: cliccarlo non cambia il materiale", () => {
    render(<NuovaRichiestaClient />);
    const materiale = screen.getByRole("group", { name: /materiale/i });
    const pvc = within(materiale).getByRole("radio", { name: /pvc/i }) as HTMLInputElement;
    fireEvent.click(pvc);
    expect(pvc.checked).toBe(false);
    expect(
      (within(materiale).getByRole("radio", { name: /legno/i }) as HTMLInputElement).checked,
    ).toBe(true);
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

  // ANTA_BATTENTE DISATTIVATO 2026-07-25: la distinta sarebbe priva del gruppo
  // di sospensione superiore (schema p0416) → tipologia gated come le future.
  // Le vecchie prove «ANTA_BATTENTE: materiali / chiusure» sono cadute qui: non
  // essendo più selezionabile, verificavano l'anta-ribalta sotto un altro nome.
  // L'equivalente su una tipologia non-ribalta è coperto dalle prove VASISTAS in
  // fondo al file.
  it("tipologia: ANTA_RIBALTA e VASISTAS selezionabili, battente e altre disabilitate", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    const ribalta = within(tipo).getByRole("radio", { name: /anta.?ribalta/i }) as HTMLInputElement;
    const vasistas = within(tipo).getByRole("radio", {
      name: new RegExp(windowTypeLabel("VASISTAS"), "i"),
    }) as HTMLInputElement;
    const battente = within(tipo).getByRole("radio", { name: /anta battente/i }) as HTMLInputElement;
    const proiettante = within(tipo).getByRole("radio", {
      name: new RegExp(windowTypeLabel("ANTA_PROIETTANTE"), "i"),
    }) as HTMLInputElement;
    expect(ribalta.checked).toBe(true);
    expect(vasistas.disabled).toBe(false);
    expect(battente.disabled).toBe(true); // gated: distinta senza sospensione superiore
    expect(proiettante.disabled).toBe(true); // FUTURE_WINDOW_TYPES: non ancora coperta dal generatore
  });

  it("il battente è gated: cliccarlo non cambia la tipologia", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    const battente = within(tipo).getByRole("radio", { name: /anta battente/i }) as HTMLInputElement;
    fireEvent.click(battente);
    expect(battente.checked).toBe(false);
    expect(
      (within(tipo).getByRole("radio", { name: /anta.?ribalta/i }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("attiva chiusure supplementari su ANTA_RIBALTA poi passa a VASISTAS: resettate a false alla generazione", async () => {
    createMutate.mockResolvedValue({ id: "k10", requestNumber: "KIT-2026-0002" });
    generateMutate.mockResolvedValue({ totalComponents: 16 });
    render(<NuovaRichiestaClient />);

    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2 (ANTA_RIBALTA)
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    const toggle = screen.getByLabelText(/chiusure supplementari/i) as HTMLInputElement;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /indietro/i })); // torna a step 2
    fireEvent.click(screen.getByRole("button", { name: /indietro/i })); // torna a step 1

    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(
      within(tipo).getByRole("radio", { name: new RegExp(windowTypeLabel("VASISTAS"), "i") }),
    );

    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 4
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/richieste/k10"));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ supplementaryClosures: false }),
    );
  });

  it("VASISTAS è selezionabile e mostra solo LEGNO (PVC/ALLUMINIO gated)", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    const vasistas = within(tipo).getByRole("radio", {
      name: new RegExp(windowTypeLabel("VASISTAS"), "i"),
    }) as HTMLInputElement;
    expect(vasistas.disabled).toBe(false);
    fireEvent.click(vasistas);
    expect(vasistas.checked).toBe(true);

    const mat = screen.getByRole("group", { name: /materiale/i });
    expect((within(mat).getByRole("radio", { name: /legno/i }) as HTMLInputElement).disabled).toBe(false);
    expect((within(mat).getByRole("radio", { name: /pvc/i }) as HTMLInputElement).disabled).toBe(true);
    expect((within(mat).getByRole("radio", { name: /alluminio/i }) as HTMLInputElement).disabled).toBe(true);
  });

  it("VASISTAS: niente toggle chiusure supplementari (ribalta-only)", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(
      within(tipo).getByRole("radio", { name: new RegExp(windowTypeLabel("VASISTAS"), "i") }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    expect(screen.queryByLabelText(/chiusure supplementari/i)).toBeNull();
  });
});
