// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusBadge } from "./status-badge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("etichette italiane per gli stati principali", () => {
    render(<StatusBadge status="DRAFT" />);
    expect(screen.getByText("Bozza")).toBeTruthy();
    cleanup();
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText("Completato")).toBeTruthy();
  });
});
