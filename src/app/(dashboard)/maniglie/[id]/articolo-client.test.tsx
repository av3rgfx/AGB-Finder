// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const getById = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: { article: { getById: { useQuery: (...args: unknown[]) => getById(...args) } } },
}));

import { ArticoloClient } from "./articolo-client";

const articolo = {
  id: "a1",
  brand: "COLOMBO",
  code: "0CD41R-CM",
  name: "MANIGLIA ROBOQUATTRO CROMO",
  total: 48.31,
  ean: "8032679001234",
  catalogPage: 12,
  imageUrl: "/api/article-image?k=maniglie%2Fcolombo%2F01-robot4%2Froboquattro-1ol&size=320",
  imageUrlLarge: "/api/article-image?k=maniglie%2Fcolombo%2F01-robot4%2Froboquattro-1ol&size=900",
  inStock: true,
  priceList: 46.68,
  surcharge: 1.63,
  lastListingAt: new Date("2026-06-01T00:00:00Z"),
  stockUpdatedAt: new Date("2026-07-28T09:00:00Z"),
};

function query(over: Record<string, unknown> = {}) {
  return { data: articolo, isPending: false, isError: false, ...over };
}

beforeEach(() => {
  getById.mockReset().mockReturnValue(query());
});

afterEach(cleanup);

describe("ArticoloClient", () => {
  it("chiede l'articolo per id", () => {
    render(<ArticoloClient id="a1" />);
    expect(getById.mock.calls[0]?.[0]).toEqual({ id: "a1" });
  });

  it("torna al catalogo", () => {
    render(<ArticoloClient id="a1" />);
    const link = screen.getByRole("link", { name: /catalogo/i });
    expect(link).toHaveProperty("href", expect.stringContaining("/maniglie"));
  });

  it("mostra il codice in mono con il pulsante copia", () => {
    render(<ArticoloClient id="a1" />);
    const copia = screen.getByRole("button", { name: /copia codice 0CD41R-CM/i });
    expect(copia.className).toContain("font-mono");
    expect(copia.textContent).toContain("0CD41R-CM");
  });

  it("mostra nome e prezzo grande con «IVA esclusa»", () => {
    render(<ArticoloClient id="a1" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "MANIGLIA ROBOQUATTRO CROMO",
    );
    const prezzo = screen.getByText("48,31 €");
    expect(prezzo.className).toContain("text-[27px]");
    expect(prezzo.className).toContain("tabular-nums");
    expect(screen.getByText("IVA esclusa")).toBeTruthy();
  });

  // Un solo articolo: qui la data sta accanto al badge, non c'è ripetizione da
  // evitare — ma non può mancare.
  it("mostra lo stato con la data accanto", () => {
    render(<ArticoloClient id="a1" />);
    expect(screen.getByText("In pronta consegna")).toBeTruthy();
    expect(screen.getByText("al 28 luglio 2026")).toBeTruthy();
  });

  it("senza pronta consegna caricata non inventa una data", () => {
    getById.mockReturnValue(query({ data: { ...articolo, inStock: false, stockUpdatedAt: null } }));
    const { container } = render(<ArticoloClient id="a1" />);
    expect(screen.getByText("nessuna pronta consegna caricata")).toBeTruthy();
    expect(container.textContent).not.toMatch(/al \d/);
  });

  it("elenca marca, EAN (mono) e pagina di catalogo", () => {
    render(<ArticoloClient id="a1" />);
    expect(screen.getByText("Marca")).toBeTruthy();
    expect(screen.getByText("COLOMBO")).toBeTruthy();
    expect(screen.getByText("8032679001234").className).toContain("font-mono");
    expect(screen.getByText("Pagina 12")).toBeTruthy();
  });

  // Una riga con un trattino è un dato mancante travestito da dato.
  it("i campi assenti non vengono disegnati affatto", () => {
    getById.mockReturnValue(query({ data: { ...articolo, ean: null, catalogPage: null } }));
    const { container } = render(<ArticoloClient id="a1" />);
    expect(screen.queryByText("EAN")).toBeNull();
    expect(screen.queryByText(/Pagina/)).toBeNull();
    expect(container.textContent).not.toMatch(/—\s*$/);
    expect(screen.getByText("Marca")).toBeTruthy();
  });

  it("in caricamento mostra uno skeleton, non uno spinner", () => {
    getById.mockReturnValue(query({ data: undefined, isPending: true }));
    const { container } = render(<ArticoloClient id="a1" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("in errore lo dice e lascia la via d'uscita", () => {
    getById.mockReturnValue(query({ data: undefined, isError: true }));
    render(<ArticoloClient id="a1" />);
    expect(screen.getByRole("alert").textContent).toMatch(/Articolo non trovato/);
    expect(screen.getByRole("link", { name: /catalogo/i })).toBeTruthy();
  });

  it("usa il formato grande, non la miniatura delle righe", () => {
    // Il riquadro è 192 CSS px: la miniatura da 320 sarebbe sgranata su ogni
    // schermo retina, e la scheda è il posto in cui si guarda il prodotto.
    const { container } = render(<ArticoloClient id="a1" />);
    expect(container.querySelector("img")!.getAttribute("src")).toContain("size=900");
  });

  it("con la foto rotta resta un segnaposto neutro, non un messaggio", () => {
    const { container } = render(<ArticoloClient id="a1" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toMatch(/immagine|foto/i);
    expect(screen.getByText("MANIGLIA ROBOQUATTRO CROMO")).toBeTruthy();
  });

  // Il 42% dei codici è minuteria e accessoristica che nessun catalogo
  // fotografa una per una: la foto mancante è la normalità.
  it("senza foto disegna il segnaposto, senza tentare alcun caricamento", () => {
    getById.mockReturnValue(query({ data: { ...articolo, imageUrl: null, imageUrlLarge: null } }));
    const { container } = render(<ArticoloClient id="a1" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.textContent).not.toMatch(/immagine|foto/i);
  });

  // ── La composizione del prezzo ──────────────────────────────────────────
  // Dal listino 05/26 il catalogo ha due convenzioni insieme: sotto la sola
  // «IVA esclusa» i due totali si leggono come confrontabili e non lo sono.

  it("dichiara la maggiorazione quando il prezzo la comprende", () => {
    // fixture: priceList 46,68 + surcharge 1,63 = 3,5 %
    render(<ArticoloClient id="a1" />);
    expect(screen.getByText(/Include la maggiorazione temporanea del 3,5 %/)).toBeTruthy();
  });

  it("dichiara l'ASSENZA quando il listino non la porta — non tace", () => {
    // Una riga che comparisse solo sull'eccezione insegnerebbe che il silenzio
    // significa «tutto regolare», e il giorno di una terza convenzione
    // mentirebbe di nuovo.
    getById.mockReturnValue(
      query({ data: { ...articolo, priceList: 105.3, surcharge: null, total: 105.3 } }),
    );
    render(<ArticoloClient id="a1" />);
    expect(screen.getByText(/Il listino non dichiara maggiorazioni/)).toBeTruthy();
    expect(screen.queryByText(/Include la maggiorazione/)).toBeNull();
  });

  it("la percentuale si DERIVA dal dato, non è la costante 3,5", () => {
    getById.mockReturnValue(
      query({ data: { ...articolo, priceList: 100, surcharge: 5, total: 105 } }),
    );
    render(<ArticoloClient id="a1" />);
    expect(screen.getByText(/del 5 %/)).toBeTruthy();
  });

  it("la percentuale si scrive con la VIRGOLA, non col punto", () => {
    // Il «42.5%» col punto in una UI italiana è già costato uno screenshot.
    const { container } = render(<ArticoloClient id="a1" />);
    expect(container.textContent).not.toMatch(/\d\.\d ?%/);
  });
});
