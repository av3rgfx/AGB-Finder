// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const { open } = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("./listino-viewer-provider", () => ({ useListinoViewer: () => ({ open }) }));

import { ListinoButton } from "./listino-button";

afterEach(() => {
  cleanup();
  open.mockReset();
});

describe("ListinoButton", () => {
  it("senza pagina → non renderizza nulla", () => {
    const { container } = render(<ListinoButton code="A50111.15.13" page={null} />);
    expect(container.firstChild).toBeNull();
  });
  it("con pagina → apre il viewer con {code, page}", () => {
    render(<ListinoButton code="A50111.15.13" page={418} />);
    fireEvent.click(screen.getByRole("button", { name: /listino/i }));
    expect(open).toHaveBeenCalledWith({ code: "A50111.15.13", page: 418 });
  });
});
