// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ConversationsPanel, type ConversationListItem } from "./conversations-panel";

afterEach(cleanup);

const now = new Date();
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
const day = 86_400_000;

const items: ConversationListItem[] = [
  { id: "a", title: "Cerniere per anta ribalta", updatedAt: startOfToday },
  { id: "b", title: "Serrature porta blindata", updatedAt: new Date(startOfToday.getTime() - day) },
  { id: "c", title: "Maniglie in acciaio", updatedAt: new Date(startOfToday.getTime() - 20 * day) },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof ConversationsPanel>> = {}) {
  const props = {
    items,
    activeId: "a",
    search: "",
    onSearch: vi.fn(),
    onSelect: vi.fn(),
    onNew: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onArchive: vi.fn(),
    ...overrides,
  };
  render(<ConversationsPanel {...props} />);
  return props;
}

describe("ConversationsPanel", () => {
  it("raggruppa le conversazioni con le etichette italiane corrette", () => {
    renderPanel();
    expect(screen.getByText("Oggi")).toBeTruthy();
    expect(screen.getByText("Ieri")).toBeTruthy();
    expect(screen.getByText("Più vecchie")).toBeTruthy();
  });

  it("la riga attiva è marcata", () => {
    renderPanel({ activeId: "b" });
    const row = screen.getByText("Serrature porta blindata");
    expect(row.getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("Cerniere per anta ribalta").getAttribute("aria-current")).toBeNull();
  });

  it("il click su una riga chiama onSelect con l'id", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByText("Maniglie in acciaio"));
    expect(props.onSelect).toHaveBeenCalledWith("c");
  });

  it("«Nuova conversazione» chiama onNew", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Nuova conversazione" }));
    expect(props.onNew).toHaveBeenCalledTimes(1);
  });

  it("la ricerca filtra le righe e propaga il valore via onSearch", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText("Cerca conversazioni"), { target: { value: "serrature" } });
    expect(props.onSearch).toHaveBeenCalledWith("serrature");
  });

  it("con `search` impostato mostra solo le righe corrispondenti", () => {
    renderPanel({ search: "maniglie" });
    expect(screen.getByText("Maniglie in acciaio")).toBeTruthy();
    expect(screen.queryByText("Cerniere per anta ribalta")).toBeNull();
    expect(screen.queryByText("Serrature porta blindata")).toBeNull();
  });

  it("nessun risultato mostra un messaggio dedicato", () => {
    renderPanel({ search: "inesistente" });
    expect(screen.getByText("Nessuna conversazione trovata.")).toBeTruthy();
  });

  it("lista vuota mostra un messaggio dedicato", () => {
    renderPanel({ items: [] });
    expect(screen.getByText("Nessuna conversazione.")).toBeTruthy();
  });

  it("rinomina: il menu ⋯ apre l'editing inline, il submit chiama onRename e chiude", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByLabelText("Azioni per Cerniere per anta ribalta"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rinomina" }));

    const input = screen.getByLabelText("Rinomina conversazione") as HTMLInputElement;
    expect(input.value).toBe("Cerniere per anta ribalta");
    fireEvent.change(input, { target: { value: "Nuovo titolo" } });
    fireEvent.submit(input.closest("form")!);

    expect(props.onRename).toHaveBeenCalledWith("a", "Nuovo titolo");
    expect(screen.queryByLabelText("Rinomina conversazione")).toBeNull();
  });

  it("rinomina: Esc annulla senza chiamare onRename", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByLabelText("Azioni per Cerniere per anta ribalta"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rinomina" }));

    const input = screen.getByLabelText("Rinomina conversazione");
    fireEvent.change(input, { target: { value: "Titolo scartato" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Rinomina conversazione")).toBeNull();
    expect(screen.getByText("Cerniere per anta ribalta")).toBeTruthy();
  });

  it("archivia: il menu ⋯ chiama onArchive con l'id", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByLabelText("Azioni per Maniglie in acciaio"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archivia" }));
    expect(props.onArchive).toHaveBeenCalledWith("c");
  });

  it("elimina: chiede conferma inline prima di chiamare onDelete", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByLabelText("Azioni per Maniglie in acciaio"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Elimina" }));

    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/Eliminare «Maniglie in acciaio»\?/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));
    expect(props.onDelete).toHaveBeenCalledWith("c");
  });

  it("elimina: Annulla chiude la conferma senza chiamare onDelete", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByLabelText("Azioni per Maniglie in acciaio"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Elimina" }));
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));

    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Maniglie in acciaio")).toBeTruthy();
  });

  it("il menu si chiude su Escape", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText("Azioni per Cerniere per anta ribalta"));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
