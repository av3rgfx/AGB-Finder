// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Accedi</Button>);
    expect(screen.getByRole("button", { name: "Accedi" })).toBeTruthy();
  });

  it("is disabled and busy while loading", () => {
    render(<Button loading>Accedi</Button>);
    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
  });
});
