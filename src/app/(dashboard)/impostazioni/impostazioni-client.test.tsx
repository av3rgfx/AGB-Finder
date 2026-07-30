// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setMutate = vi.fn();
const sogliaQuery = vi.fn();

vi.mock("@/trpc/react", () => ({
  api: {
    settings: {
      aiKeys: {
        status: { useQuery: () => ({ data: [], isPending: false, isError: false }) },
        testConnection: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        set: {
          useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
        },
      },
      discountThreshold: {
        get: { useQuery: (...a: unknown[]) => sogliaQuery(...a) },
        set: {
          useMutation: () => ({ mutate: setMutate, isPending: false, isError: false, error: null }),
        },
      },
    },
    useUtils: () => ({ settings: { discountThreshold: { get: { invalidate: vi.fn() } } } }),
  },
}));

import { SogliaScontoCard } from "./impostazioni-client";

beforeEach(() => {
  setMutate.mockReset();
  sogliaQuery.mockReset().mockReturnValue({ data: 40, isPending: false });
});

afterEach(cleanup);

describe("SogliaScontoCard", () => {
  it("mostra la soglia corrente", () => {
    render(<SogliaScontoCard />);
    expect((screen.getByLabelText(/soglia/i) as HTMLInputElement).value).toBe("40");
  });

  it("salva la nuova soglia", async () => {
    render(<SogliaScontoCard />);
    const campo = screen.getByLabelText(/soglia/i);
    await userEvent.clear(campo);
    await userEvent.type(campo, "55");
    await userEvent.click(screen.getByRole("button", { name: /salva/i }));
    expect(setMutate).toHaveBeenCalledWith({ soglia: 55 });
  });

  it("accetta la virgola decimale", async () => {
    render(<SogliaScontoCard />);
    const campo = screen.getByLabelText(/soglia/i);
    await userEvent.clear(campo);
    await userEvent.type(campo, "42,5");
    await userEvent.click(screen.getByRole("button", { name: /salva/i }));
    expect(setMutate).toHaveBeenCalledWith({ soglia: 42.5 });
  });

  it("non salva un valore fuori da 0-100", async () => {
    render(<SogliaScontoCard />);
    const campo = screen.getByLabelText(/soglia/i);
    await userEvent.clear(campo);
    await userEvent.type(campo, "120");
    expect((screen.getByRole("button", { name: /salva/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("non salva un campo vuoto: la soglia esiste sempre", async () => {
    render(<SogliaScontoCard />);
    await userEvent.clear(screen.getByLabelText(/soglia/i));
    expect((screen.getByRole("button", { name: /salva/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("dice che avvisa e non blocca", () => {
    render(<SogliaScontoCard />);
    expect(screen.getByText(/non impedisce mai di salvare/i)).toBeDefined();
  });
});
