// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { Sidebar } from "./sidebar";

afterEach(cleanup);

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
