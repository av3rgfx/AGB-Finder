// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// react-pdf non è renderizzabile in jsdom (canvas/worker) → mock leggero che espone
// gli attributi che ci interessano: il `file` del Document e il `pageNumber` della Page.
vi.mock("react-pdf", () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
  Document: ({ file, children }: { file: string; children: React.ReactNode }) => (
    <div data-testid="doc" data-file={file}>
      {children}
    </div>
  ),
  Page: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid="page" data-page={String(pageNumber)} />
  ),
}));
vi.mock("react-pdf/dist/Page/TextLayer.css", () => ({}));

import { ListinoViewer } from "./listino-viewer";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => cleanup());

const doc = () => screen.getByTestId("doc");

describe("ListinoViewer (Opzione B — pagina singola)", () => {
  it("carica la paginetta target via ?page=N e renderizza sempre pageNumber=1", () => {
    render(<ListinoViewer code="A50111.15.13" page={418} totalPages={959} onClose={() => {}} />);
    expect(doc().getAttribute("data-file")).toBe("/api/listino?page=418");
    expect(screen.getByTestId("page").getAttribute("data-page")).toBe("1");
    expect(screen.getByText("pag. 418 / 959")).toBeTruthy();
  });

  it("next → carica ?page=N+1 e aggiorna l'indicatore", () => {
    render(<ListinoViewer code="A50111.15.13" page={418} totalPages={959} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /successiva/i }));
    expect(doc().getAttribute("data-file")).toBe("/api/listino?page=419");
    expect(screen.getByText("pag. 419 / 959")).toBeTruthy();
  });

  it("prev disabilitato a pagina 1", () => {
    render(<ListinoViewer code="X00000.00.00" page={1} totalPages={959} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /precedente/i })).toHaveProperty("disabled", true);
  });

  it("next disabilitato all'ultima pagina", () => {
    render(<ListinoViewer code="X00000.00.00" page={959} totalPages={959} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /successiva/i })).toHaveProperty("disabled", true);
  });

  it("next disabilitato se totalPages è sconosciuto (null)", () => {
    render(<ListinoViewer code="X00000.00.00" page={5} totalPages={null} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /successiva/i })).toHaveProperty("disabled", true);
  });
});
