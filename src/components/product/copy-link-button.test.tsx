// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { CopyLinkButton } from "./copy-link-button";

afterEach(cleanup);

describe("CopyLinkButton", () => {
  it("copia location.href e mostra feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyLinkButton />);
    fireEvent.click(screen.getByRole("button", { name: "Copia link della ricerca" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    expect(screen.getByText("Copiato")).toBeDefined();
  });
});
