// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// Mock fedele al comportamento reale di next/link: intercetta il click
// (preventDefault → routing client-side, mai una navigazione full) e inoltra
// l'onClick del componente.
vi.mock("next/link", () => ({
  default: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) => (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

const listQuery = vi.fn();
vi.mock("@/trpc/react", () => ({ api: { kit: { list: { useQuery: () => listQuery() } } } }));

import { RichiesteClient } from "./richieste-client";

const item = {
  id: "k1",
  requestNumber: "KIT-2026-0001",
  windowType: "ANTA_RIBALTA",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 550,
  heightMm: 1820,
  status: "GENERATED",
  totalComponents: 16,
  totalPrice: 9020,
  createdAt: "2026-07-05T10:00:00Z",
};

afterEach(() => {
  cleanup();
  push.mockReset();
  listQuery.mockReset();
});

describe("RichiesteClient — riga richiesta", () => {
  it("click sul numero (Link) NON fa doppia navigazione: naviga solo il Link, non router.push", () => {
    listQuery.mockReturnValue({ data: { items: [item] }, isPending: false, isError: false });
    render(<RichiesteClient />);
    fireEvent.click(screen.getByRole("link", { name: item.requestNumber }));
    expect(push).not.toHaveBeenCalled();
  });

  it("click sulla riga (fuori dal Link) naviga via router.push una sola volta", () => {
    listQuery.mockReturnValue({ data: { items: [item] }, isPending: false, isError: false });
    render(<RichiesteClient />);
    fireEvent.click(screen.getByText(/550 × 1820 mm/));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/richieste/k1");
  });
});
