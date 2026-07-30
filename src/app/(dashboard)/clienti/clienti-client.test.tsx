// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listQuery = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();
const invalidateList = vi.fn();

vi.mock("@/trpc/react", () => ({
  api: {
    customer: {
      list: { useQuery: (...args: unknown[]) => listQuery(...args) },
      update: {
        useMutation: () => ({
          mutateAsync: updateMutate,
          isPending: false,
          isError: false,
          error: null,
        }),
      },
      delete: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutateAsync: async (input: unknown) => {
            const out = await deleteMutate(input);
            opts?.onSuccess?.();
            return out;
          },
          isPending: false,
        }),
      },
    },
    useUtils: () => ({ customer: { list: { invalidate: invalidateList } } }),
  },
}));

import { ClientiClient } from "./clienti-client";
import { geometriaLabel } from "@/server/kit/artech-geometrie";

const clienti = [
  { id: "c1", companyName: "Fosca", discount: 42.5, kitGeometry: "A12_I13_B18", kitEntrata: "E15" },
  { id: "c2", companyName: "Peruzzi", discount: null, kitGeometry: null, kitEntrata: null },
];

beforeEach(() => {
  listQuery.mockReset().mockReturnValue({ data: clienti, isPending: false, isError: false });
  updateMutate.mockReset().mockResolvedValue(clienti[0]);
  deleteMutate.mockReset().mockResolvedValue({ id: "c1" });
  invalidateList.mockReset();
});

afterEach(cleanup);

/** Apre il menu ⋯ della riga `i` e clicca la voce indicata. */
async function azione(i: number, voce: RegExp) {
  await userEvent.click(screen.getAllByRole("button", { name: /azioni/i })[i]!);
  await userEvent.click(screen.getByRole("menuitem", { name: voce }));
}

describe("ClientiClient", () => {
  it("elenca i clienti col profilo e lo sconto", () => {
    render(<ClientiClient />);
    expect(screen.getByText("Fosca")).toBeTruthy();
    expect(screen.getByText(new RegExp(geometriaLabel("A12_I13_B18")))).toBeTruthy();
    expect(screen.getByText(/42,5/)).toBeTruthy();
  });

  // Una cella vuota si legge come «non lo so»; «nessun profilo» si legge come
  // «non e` stato dichiarato», che e` l'informazione vera.
  it("dice «nessun profilo» invece di lasciare la cella vuota", () => {
    render(<ClientiClient />);
    expect(screen.getByText(/nessun profilo/i)).toBeTruthy();
  });

  it("la modifica salva il profilo", async () => {
    render(<ClientiClient />);
    await azione(0, /modifica/i);
    await userEvent.selectOptions(screen.getByLabelText(/geometria/i), "A4_I9_B18");
    await userEvent.click(screen.getByRole("button", { name: /salva/i }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1", kitGeometry: "A4_I9_B18" }),
    );
  });

  // La UI e` in italiano: `String(42.5)` darebbe «42.5» col punto, in un form
  // che due righe sopra scrive «−42,5%». Trovato guardando uno screenshot, non
  // da un'asserzione.
  it("il campo sconto precompila con la virgola, non col punto", async () => {
    render(<ClientiClient />);
    await azione(0, /modifica/i);
    expect((screen.getByLabelText(/sconto/i) as HTMLInputElement).value).toBe("42,5");
  });

  it("la virgola arriva al server come numero", async () => {
    render(<ClientiClient />);
    await azione(0, /modifica/i);
    await userEvent.clear(screen.getByLabelText(/sconto/i));
    await userEvent.type(screen.getByLabelText(/sconto/i), "40,55");
    await userEvent.click(screen.getByRole("button", { name: /salva/i }));
    expect(updateMutate).toHaveBeenCalledWith(expect.objectContaining({ discount: 40.55 }));
  });

  // `null` e non `undefined`: azzerare un profilo non e` lasciarlo stare, ed e`
  // la distinzione che il router gia` rispetta.
  it("azzerare il profilo manda null, non undefined", async () => {
    render(<ClientiClient />);
    await azione(0, /modifica/i);
    await userEvent.selectOptions(screen.getByLabelText(/geometria/i), "");
    await userEvent.click(screen.getByRole("button", { name: /salva/i }));

    const inviato = updateMutate.mock.calls.at(-1)?.[0];
    expect(inviato).toHaveProperty("kitGeometry", null);
  });

  // L'anagrafica in produzione e` VUOTA: non e` un caso limite, e` il primo giorno.
  it("l'anagrafica vuota ha un empty-state, non una tabella vuota", () => {
    listQuery.mockReturnValue({ data: [], isPending: false, isError: false });
    render(<ClientiClient />);
    expect(screen.getByText(/nessun cliente in anagrafica/i)).toBeTruthy();
  });

  it("mostra il motivo se il cliente non e` eliminabile", async () => {
    deleteMutate.mockRejectedValue(
      new Error("Cliente con 3 richieste collegate: non si può eliminare."),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ClientiClient />);
    await azione(0, /elimina/i);
    expect((await screen.findByRole("alert")).textContent).toMatch(/3 richieste collegate/);
  });

  // Regola inviolabile «mobile-first»: la tabella scorre, e il menu azioni deve
  // vivere fuori dal contenitore che scorre (position: fixed) o viene ritagliato.
  // E` il difetto gia` corretto su /utenti dalla PR #18.
  it("la tabella scorre in orizzontale e il menu azioni e` fixed", async () => {
    const { container } = render(<ClientiClient />);
    expect(container.querySelector(".overflow-x-auto")).toBeTruthy();
    await userEvent.click(screen.getAllByRole("button", { name: /azioni/i })[0]!);
    expect(screen.getByRole("menu").className).toContain("fixed");
  });
});
