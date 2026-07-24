// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RecentSearches } from "./recent-searches";

afterEach(cleanup);

describe("RecentSearches", () => {
  it("mostra recenti + suggerimenti; il click chiama onPick", () => {
    const onPick = vi.fn();
    // valori recenti distinti dai suggerimenti statici (evita nomi duplicati)
    render(<RecentSearches recent={["cerniera", "vite ottone"]} onPick={onPick} />);
    expect(screen.getByText("Ricerche recenti")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "cerniera" }));
    expect(onPick).toHaveBeenCalledWith("cerniera");
    fireEvent.click(screen.getByRole("button", { name: "vite ottone" }));
    expect(onPick).toHaveBeenCalledWith("vite ottone");
    // un suggerimento statico è comunque presente
    expect(screen.getByText("Prova a cercare")).toBeDefined();
    expect(screen.getByRole("button", { name: "cerniera anta ribalta" })).toBeDefined();
  });

  it("senza recenti mostra solo i suggerimenti", () => {
    render(<RecentSearches recent={[]} onPick={() => undefined} />);
    expect(screen.queryByText("Ricerche recenti")).toBeNull();
    expect(screen.getByText("Prova a cercare")).toBeDefined();
  });
});
