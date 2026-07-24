// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RecentlyViewed } from "./recently-viewed";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("RecentlyViewed", () => {
  it("mostra i prodotti visti con link e codice mono", async () => {
    window.localStorage.setItem(
      "archivio:recently-viewed",
      JSON.stringify([{ id: "p1", agbCode: "B00590", name: "Cerniera" }]),
    );
    render(<RecentlyViewed />);
    expect(await screen.findByText("Visti di recente")).toBeDefined();
    const code = await screen.findByText("B00590");
    expect(code.className).toContain("font-mono");
    expect(screen.getByRole("link")).toHaveProperty("href", expect.stringContaining("/archivio/p1"));
  });

  it("vuoto → non renderizza nulla", () => {
    const { container } = render(<RecentlyViewed />);
    expect(container.firstChild).toBeNull();
  });
});
