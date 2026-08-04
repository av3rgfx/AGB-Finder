// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const pathname = vi.fn(() => "/dashboard");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { Sidebar } from "./sidebar";

afterEach(() => {
  cleanup();
  pathname.mockReturnValue("/dashboard");
});

describe("Sidebar", () => {
  it("renders the primary navigation labels", () => {
    render(<Sidebar role="ADMIN" />);
    for (const label of ["Dashboard", "Assistente", "Archivio", "Richieste Kit", "Impostazioni"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("marks the current route as the active page", () => {
    render(<Sidebar role="ADMIN" />);
    const link = screen.getByText("Dashboard").closest("a");
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark a non-current route as active", () => {
    render(<Sidebar role="ADMIN" />);
    const link = screen.getByText("Archivio").closest("a");
    expect(link?.getAttribute("aria-current")).toBeNull();
  });

  it("shows the admin section (Utenti + Impostazioni) for the ADMIN role", () => {
    render(<Sidebar role="ADMIN" />);
    expect(screen.getByText("Utenti")).toBeTruthy();
    expect(screen.getByText("Impostazioni")).toBeTruthy();
  });

  it("hides the admin section (Utenti + Impostazioni) for non-admin roles", () => {
    render(<Sidebar role="AGENT" />);
    expect(screen.queryByText("Utenti")).toBeNull();
    expect(screen.queryByText("Impostazioni")).toBeNull();
  });
});

/**
 * La sidebar mostra SOLO il reparto in cui ci si trova, dedotto dall'indirizzo.
 * È il modo in cui «rendere visibile il distacco» diventa vero anche dopo la
 * schermata di scelta: chi entra per il magazzino non attraversa il mondo dei
 * serramenti, e viceversa.
 */
describe("Sidebar — reparto corrente", () => {
  it("nel reparto maniglie NON mostra le voci dei serramenti", () => {
    pathname.mockReturnValue("/maniglie");
    render(<Sidebar role="ADMIN" />);
    expect(screen.getByText("Catalogo")).toBeTruthy();
    for (const label of ["Archivio", "Assistente", "Richieste Kit", "Clienti"]) {
      expect(screen.queryByText(label), `${label} non deve comparire`).toBeNull();
    }
  });

  it("nei serramenti NON mostra le voci delle maniglie", () => {
    render(<Sidebar role="ADMIN" />);
    expect(screen.queryByText("Catalogo")).toBeNull();
    expect(screen.getByText("Archivio")).toBeTruthy();
  });

  it("mostra il nome del reparto e il modo di cambiarlo", () => {
    // Prima qui c'era solo il wordmark statico, e non esisteva alcun ritorno:
    // si cambiava reparto solo col logout.
    pathname.mockReturnValue("/maniglie");
    render(<Sidebar role="AGENT" />);
    expect(screen.getByText("MANIGLIE")).toBeTruthy();
    const link = screen.getByText("Cambia reparto").closest("a");
    expect(link?.getAttribute("href")).toBe("/");
  });

  it("le voci ADMIN del magazzino compaiono solo all'ADMIN e solo lì", () => {
    pathname.mockReturnValue("/maniglie");
    render(<Sidebar role="AGENT" />);
    expect(screen.queryByText("Import")).toBeNull();
    cleanup();
    render(<Sidebar role="ADMIN" />);
    expect(screen.getByText("Import")).toBeTruthy();
  });

  it("Utenti e Impostazioni restano raggiungibili DA ENTRAMBI i reparti", () => {
    // Non appartengono a nessuno dei due mondi: sono dell'app. Costringere
    // Andrea a passare dai serramenti per cambiare una password sarebbe il
    // distacco preso alla lettera contro l'utente.
    pathname.mockReturnValue("/maniglie");
    render(<Sidebar role="ADMIN" />);
    expect(screen.getByText("Utenti")).toBeTruthy();
    expect(screen.getByText("Impostazioni")).toBeTruthy();
  });
});
