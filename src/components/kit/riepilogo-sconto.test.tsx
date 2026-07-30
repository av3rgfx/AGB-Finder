// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RiepilogoSconto } from "./riepilogo-sconto";

const setDiscountMutate = vi.fn();
const invalidateGet = vi.fn();

vi.mock("@/trpc/react", () => ({
  api: {
    kit: {
      setDiscount: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutateAsync: async (v: unknown) => {
            const r = await setDiscountMutate(v);
            opts?.onSuccess?.();
            return r;
          },
          isPending: false,
          isError: false,
          error: null,
        }),
      },
    },
    useUtils: () => ({
      kit: { get: { invalidate: invalidateGet }, list: { invalidate: vi.fn() } },
    }),
  },
}));

const base = { requestId: "k1", soglia: 40 };

beforeEach(() => {
  setDiscountMutate.mockReset().mockResolvedValue({ id: "k1", discountPercent: 45 });
  invalidateGet.mockReset();
});

afterEach(cleanup);

describe("RiepilogoSconto", () => {
  it("senza sconto non ripete nessun totale: lo dice gia` la tabella", () => {
    render(<RiepilogoSconto {...base} discountPercent={null} netto={90.2} scontoImporto={null} />);
    expect(screen.queryByText(/totale cliente/i)).toBeNull();
    expect(screen.queryByText(/90,20/)).toBeNull();
  });

  it("senza sconto invita ad applicarne uno", () => {
    render(<RiepilogoSconto {...base} discountPercent={null} netto={90.2} scontoImporto={null} />);
    expect(screen.getByRole("button", { name: /applica uno sconto/i })).toBeDefined();
  });

  it("con lo sconto mostra la percentuale, l'importo scontato e il netto", () => {
    render(<RiepilogoSconto {...base} discountPercent={40} netto={54.12} scontoImporto={36.08} />);
    expect(screen.getByText(/40%/)).toBeDefined();
    expect(screen.getByText(/36,08/)).toBeDefined();
    expect(screen.getByText(/54,12/)).toBeDefined();
    expect(screen.getByText(/totale cliente/i)).toBeDefined();
  });

  it("con lo sconto il pulsante parla di modifica, non di applicazione", () => {
    render(<RiepilogoSconto {...base} discountPercent={40} netto={54.12} scontoImporto={36.08} />);
    expect(screen.getByRole("button", { name: /modifica sconto/i })).toBeDefined();
  });

  it("oltre soglia avvisa ma non blocca", () => {
    render(<RiepilogoSconto {...base} discountPercent={55} netto={40.59} scontoImporto={49.61} />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(/soglia/i)).toBeDefined();
    // Non blocca: il pulsante di modifica resta disponibile.
    expect(screen.getByRole("button", { name: /modifica sconto/i })).toBeDefined();
  });

  it("pari alla soglia non avvisa (il confronto e` stretto)", () => {
    render(<RiepilogoSconto {...base} discountPercent={40} netto={54.12} scontoImporto={36.08} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("salva la percentuale modificata", async () => {
    render(<RiepilogoSconto {...base} discountPercent={40} netto={54.12} scontoImporto={36.08} />);
    await userEvent.click(screen.getByRole("button", { name: /modifica sconto/i }));
    const campo = screen.getByLabelText(/sconto/i);
    await userEvent.clear(campo);
    await userEvent.type(campo, "45");
    await userEvent.click(screen.getByRole("button", { name: /^salva$/i }));
    expect(setDiscountMutate).toHaveBeenCalledWith({ id: "k1", discountPercent: 45 });
  });

  it("accetta la virgola come separatore decimale", async () => {
    render(<RiepilogoSconto {...base} discountPercent={null} netto={90.2} scontoImporto={null} />);
    await userEvent.click(screen.getByRole("button", { name: /applica uno sconto/i }));
    await userEvent.type(screen.getByLabelText(/sconto/i), "42,5");
    await userEvent.click(screen.getByRole("button", { name: /^salva$/i }));
    expect(setDiscountMutate).toHaveBeenCalledWith({ id: "k1", discountPercent: 42.5 });
  });

  it("campo vuoto significa azzerare lo sconto", async () => {
    render(<RiepilogoSconto {...base} discountPercent={40} netto={54.12} scontoImporto={36.08} />);
    await userEvent.click(screen.getByRole("button", { name: /modifica sconto/i }));
    await userEvent.clear(screen.getByLabelText(/sconto/i));
    await userEvent.click(screen.getByRole("button", { name: /^salva$/i }));
    expect(setDiscountMutate).toHaveBeenCalledWith({ id: "k1", discountPercent: null });
  });

  it("non salva un testo che non e` un numero", async () => {
    render(<RiepilogoSconto {...base} discountPercent={null} netto={90.2} scontoImporto={null} />);
    await userEvent.click(screen.getByRole("button", { name: /applica uno sconto/i }));
    await userEvent.type(screen.getByLabelText(/sconto/i), "abc");
    expect((screen.getByRole("button", { name: /^salva$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("non salva una percentuale fuori da 0-100 (la guardia e` anche qui, non solo sul server)", async () => {
    render(<RiepilogoSconto {...base} discountPercent={null} netto={90.2} scontoImporto={null} />);
    await userEvent.click(screen.getByRole("button", { name: /applica uno sconto/i }));
    await userEvent.type(screen.getByLabelText(/sconto/i), "120");
    expect((screen.getByRole("button", { name: /^salva$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("in sola lettura non offre la modifica", () => {
    render(
      <RiepilogoSconto
        {...base}
        readOnly
        discountPercent={40}
        netto={54.12}
        scontoImporto={36.08}
      />,
    );
    expect(screen.queryByRole("button", { name: /modifica sconto/i })).toBeNull();
    // ...ma il netto resta leggibile: la distinta superata va comunque letta.
    expect(screen.getByText(/54,12/)).toBeDefined();
  });
});
