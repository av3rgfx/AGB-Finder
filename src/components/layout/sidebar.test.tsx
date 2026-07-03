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
    render(<Sidebar />);
    for (const label of ["Dashboard", "Assistente", "Archivio", "Richieste Kit", "Impostazioni"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("marks the current route as the active page", () => {
    render(<Sidebar />);
    const link = screen.getByText("Dashboard").closest("a");
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark a non-current route as active", () => {
    render(<Sidebar />);
    const link = screen.getByText("Archivio").closest("a");
    expect(link?.getAttribute("aria-current")).toBeNull();
  });
});
