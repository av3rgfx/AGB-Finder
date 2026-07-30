// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerPicker } from "./customer-picker";

const listQuery = vi.fn();
const createMutate = vi.fn();
const invalidateList = vi.fn();

vi.mock("@/trpc/react", () => ({
  api: {
    customer: {
      list: { useQuery: (...args: unknown[]) => listQuery(...args) },
      create: {
        useMutation: () => ({
          mutateAsync: createMutate,
          isPending: false,
          isError: false,
          error: null,
        }),
      },
    },
    useUtils: () => ({ customer: { list: { invalidate: invalidateList } } }),
  },
}));

const clienti = [
  { id: "c1", companyName: "Fosca", discount: 42.5, kitGeometry: "A12_I13_B18", kitEntrata: "E15" },
  { id: "c2", companyName: "Peruzzi", discount: null, kitGeometry: null, kitEntrata: null },
];

beforeEach(() => {
  listQuery.mockReset().mockReturnValue({ data: clienti, isPending: false });
  createMutate.mockReset();
  invalidateList.mockReset();
});

afterEach(cleanup);

describe("CustomerPicker", () => {
  it("elenca i clienti e ne restituisce uno con il suo sconto", async () => {
    const onChange = vi.fn();
    render(<CustomerPicker value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /fosca/i }));
    // Sulla FIXTURE, non su un oggetto ricopiato: il selettore restituisce la
    // riga cosi` com'e`, e aggiungerle un campo non deve costringere a
    // riscrivere questa asserzione.
    expect(onChange).toHaveBeenCalledWith(clienti[0]);
  });

  it("mostra lo sconto di ciascun cliente, e dice quando non ne ha", () => {
    render(<CustomerPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /fosca.*42,5%/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /peruzzi.*nessuno sconto/i })).toBeDefined();
  });

  it("si puo` non scegliere nessun cliente", async () => {
    const onChange = vi.fn();
    render(<CustomerPicker value="c1" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /nessun cliente/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("con l'anagrafica vuota spiega cosa fare invece di mostrare una lista vuota", () => {
    listQuery.mockReturnValue({ data: [], isPending: false });
    render(<CustomerPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByText(/nessun cliente in anagrafica/i)).toBeDefined();
  });

  it("una ricerca senza esiti dice che non ha trovato, non che l'anagrafica e` vuota", async () => {
    listQuery.mockReturnValue({ data: [], isPending: false });
    render(<CustomerPicker value={null} onChange={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/cerca/i), "zzz");
    expect(screen.getByText(/nessun cliente trovato/i)).toBeDefined();
  });

  it("crea un cliente nuovo e lo seleziona subito", async () => {
    listQuery.mockReturnValue({ data: [], isPending: false });
    createMutate.mockResolvedValue({ id: "c9", companyName: "Nuovo", discount: 30 });
    const onChange = vi.fn();
    render(<CustomerPicker value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /nuovo cliente/i }));
    await userEvent.type(screen.getByLabelText(/ragione sociale/i), "Nuovo");
    await userEvent.type(screen.getByLabelText(/sconto/i), "30");
    await userEvent.click(screen.getByRole("button", { name: /^crea$/i }));
    expect(createMutate).toHaveBeenCalledWith({ companyName: "Nuovo", discount: 30 });
    expect(onChange).toHaveBeenCalledWith({ id: "c9", companyName: "Nuovo", discount: 30 });
  });

  it("il cliente nuovo puo` nascere senza sconto", async () => {
    listQuery.mockReturnValue({ data: [], isPending: false });
    createMutate.mockResolvedValue({ id: "c9", companyName: "Nuovo", discount: null });
    render(<CustomerPicker value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /nuovo cliente/i }));
    await userEvent.type(screen.getByLabelText(/ragione sociale/i), "Nuovo");
    await userEvent.click(screen.getByRole("button", { name: /^crea$/i }));
    expect(createMutate).toHaveBeenCalledWith({ companyName: "Nuovo" });
  });

  it("non crea un cliente con ragione sociale vuota", async () => {
    render(<CustomerPicker value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /nuovo cliente/i }));
    expect((screen.getByRole("button", { name: /^crea$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("passa la ricerca alla query", async () => {
    render(<CustomerPicker value={null} onChange={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/cerca/i), "per");
    expect(listQuery).toHaveBeenLastCalledWith({ search: "per" });
  });

  // PROFILO SERRAMENTO. Le due quote che non cambiano fra un ordine e l'altro
  // dello stesso cliente. Qui si possono dichiarare gia` alla creazione, cosi`
  // chi crea un cliente al volo dentro il wizard non deve cambiare schermata.
  it("crea un cliente col suo profilo serramento", async () => {
    createMutate.mockResolvedValue({
      id: "c3",
      companyName: "MC",
      discount: null,
      kitGeometry: "A4_I85_B15",
      kitEntrata: "E15",
    });
    render(<CustomerPicker value={null} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /nuovo cliente/i }));
    await userEvent.type(screen.getByLabelText(/ragione sociale/i), "MC");
    await userEvent.selectOptions(screen.getByLabelText(/geometria/i), "A4_I85_B15");
    await userEvent.selectOptions(screen.getByLabelText(/entrata/i), "E15");
    await userEvent.click(screen.getByRole("button", { name: /^crea$/i }));

    expect(createMutate).toHaveBeenCalledWith({
      companyName: "MC",
      kitGeometry: "A4_I85_B15",
      kitEntrata: "E15",
    });
  });

  // Il profilo deve arrivare a chi consuma il selettore: e` il wizard a doverlo
  // mostrare al passo della geometria.
  it("il cliente scelto porta il profilo a chi lo consuma", async () => {
    const onChange = vi.fn();
    render(<CustomerPicker value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Fosca/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ kitGeometry: "A12_I13_B18", kitEntrata: "E15" }),
    );
  });
});
