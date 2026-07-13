// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

const listData = [
  { id: "u1", email: "admin@x.it", firstName: "Adele", lastName: "Admin", role: "ADMIN", status: "ACTIVE", createdAt: new Date() },
  { id: "u2", email: "mario@x.it", firstName: "Mario", lastName: "Rossi", role: "AGENT", status: "ACTIVE", createdAt: new Date() },
];
const createMut = vi.fn(); const setActiveMut = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: {
    user: {
      list: { useQuery: () => ({ data: listData, isPending: false, isError: false, refetch: vi.fn() }) },
      create: { useMutation: () => ({ mutate: createMut, isPending: false, error: null }) },
      setActive: { useMutation: () => ({ mutate: setActiveMut, isPending: false }) },
      setRole: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      resetPassword: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
    },
  },
}));
import { UtentiClient } from "./utenti-client";
afterEach(cleanup);

describe("UtentiClient", () => {
  it("elenca gli utenti con ruolo e stato", () => {
    render(<UtentiClient currentUserId="u1" />);
    expect(screen.getByText("mario@x.it")).toBeTruthy();
    expect(screen.getByText(/Rossi/)).toBeTruthy();
  });
  it("apre il form Nuovo utente e crea", () => {
    render(<UtentiClient currentUserId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /nuovo utente/i }));
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "new@x.it" } });
    fireEvent.change(screen.getByLabelText(/^nome/i), { target: { value: "Nuo" } });
    fireEvent.change(screen.getByLabelText(/cognome/i), { target: { value: "Vo" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /crea/i }));
    expect(createMut).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@x.it", firstName: "Nuo", lastName: "Vo", password: "password1", role: "AGENT" }),
    );
  });
  it("non mostra azioni distruttive sul proprio account", () => {
    render(<UtentiClient currentUserId="u1" />);
    const rows = screen.getAllByRole("row");
    const selfRow = rows.find((r) => within(r).queryByText("admin@x.it"));
    expect(within(selfRow!).queryByRole("button", { name: /elimina/i })).toBeNull();
  });
});
