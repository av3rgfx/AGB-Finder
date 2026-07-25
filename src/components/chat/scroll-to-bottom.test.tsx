// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ScrollToBottom } from "./scroll-to-bottom";

afterEach(cleanup);

describe("ScrollToBottom", () => {
  it("non rende nulla quando visible è false", () => {
    render(<ScrollToBottom onClick={vi.fn()} visible={false} />);
    expect(screen.queryByRole("button", { name: "Scorri in fondo" })).toBeNull();
  });

  it("rende il bottone e chiama onClick quando visible", () => {
    const onClick = vi.fn();
    render(<ScrollToBottom onClick={onClick} visible />);
    const btn = screen.getByRole("button", { name: "Scorri in fondo" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });
});
