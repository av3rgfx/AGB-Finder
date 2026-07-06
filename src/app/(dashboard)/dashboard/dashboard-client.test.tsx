// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const overviewQuery = vi.fn();
const refetch = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: { dashboard: { overview: { useQuery: () => overviewQuery() } } },
}));

import { DashboardClient } from "./dashboard-client";

const data = {
  scope: "mine",
  isAdmin: false,
  stats: {
    richieste: { total: 12, today: 3 },
    kitGenerati: { total: 5, today: 0 },
    conversazioni: { total: 8, today: 1 },
    prodottiCercati: { total: 40, today: 2 },
  },
  recentKits: [
    {
      id: "k1", requestNumber: "KIT-2026-0001", status: "COMPLETED",
      createdAt: "2026-07-06T08:00:00Z", totalPrice: 90.2, customerName: "ACME Srl",
    },
  ],
};

afterEach(() => {
  cleanup();
  overviewQuery.mockReset();
  refetch.mockReset();
});

describe("DashboardClient", () => {
  it("mostra i KPI con totale e '+N oggi', omette '+0 oggi'", () => {
    overviewQuery.mockReturnValue({ data, isPending: false, isError: false, refetch });
    render(<DashboardClient firstName="Marco" isAdmin={false} />);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Richieste")).toBeTruthy();
    expect(screen.getByText("+3 oggi")).toBeTruthy();
    expect(screen.queryByText("+0 oggi")).toBeNull();
  });

  it("il toggle 'Ambito dati' è visibile solo per ADMIN", () => {
    overviewQuery.mockReturnValue({ data, isPending: false, isError: false, refetch });
    const r1 = render(<DashboardClient firstName="Marco" isAdmin={false} />);
    expect(screen.queryByRole("group", { name: "Ambito dati" })).toBeNull();
    r1.unmount();
    render(<DashboardClient firstName="Marco" isAdmin={true} />);
    expect(screen.getByRole("group", { name: "Ambito dati" })).toBeTruthy();
  });

  it("stato vuoto: nessuna richiesta recente", () => {
    overviewQuery.mockReturnValue({
      data: { ...data, recentKits: [] }, isPending: false, isError: false, refetch,
    });
    render(<DashboardClient firstName="Marco" isAdmin={false} />);
    expect(screen.getByText("Nessuna richiesta recente")).toBeTruthy();
  });

  it("stato errore mostra 'Riprova' e richiama refetch", () => {
    overviewQuery.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch });
    render(<DashboardClient firstName="Marco" isAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Nessuna richiesta recente")).toBeNull();
  });

  it("stato loading: label presenti ma nessun valore numerico", () => {
    overviewQuery.mockReturnValue({ data: undefined, isPending: true, isError: false, refetch });
    render(<DashboardClient firstName="Marco" isAdmin={false} />);
    expect(screen.getByText("Richieste")).toBeTruthy();
    expect(screen.queryByText("12")).toBeNull();
  });
});
