// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolStatus } from "./tool-status";

afterEach(cleanup);

describe("ToolStatus", () => {
  it("rende l'etichetta con role status", () => {
    render(<ToolStatus label="Sto cercando nel catalogo…" />);
    const status = screen.getByRole("status", { name: "Sto cercando nel catalogo…" });
    expect(status).toBeTruthy();
  });
});
