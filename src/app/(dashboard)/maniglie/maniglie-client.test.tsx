// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

let sp = new URLSearchParams("");
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ replace }),
  usePathname: () => "/maniglie",
}));

const searchQuery = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: { article: { search: { useQuery: (...args: unknown[]) => searchQuery(...args) } } },
}));

import { ManiglieClient } from "./maniglie-client";

const IMPORTATO = new Date("2026-07-28T09:00:00Z");

const articoli = [
  {
    id: "a1",
    brand: "COLOMBO",
    code: "0CD41R-CM",
    name: "MANIGLIA ROBOQUATTRO",
    total: 48.31,
    ean: "8032679001234",
    catalogPage: 12,
    imageUrl: "https://blob.example/colombo/0CD41RCM.jpg",
    inStock: true,
  },
  {
    id: "a2",
    brand: "COLOMBO",
    code: "0CD41R-VM",
    name: "BOCCEHTTA OVALE",
    total: 9.4,
    ean: null,
    catalogPage: null,
    imageUrl: null,
    inStock: false,
  },
  {
    id: "a3",
    brand: "COLOMBO",
    code: "0CD99X-CM",
    name: "ROSETTA TONDA",
    total: 3.5,
    ean: null,
    catalogPage: null,
    imageUrl: null,
    inStock: false,
  },
];

function risultati(over: Record<string, unknown> = {}) {
  return {
    data: {
      hits: articoli,
      total: articoli.length,
      stockUpdates: [{ brand: "COLOMBO", importedAt: IMPORTATO }],
    },
    isPending: false,
    isError: false,
    isFetching: false,
    ...over,
  };
}

beforeEach(() => {
  sp = new URLSearchParams("");
  replace.mockReset();
  searchQuery.mockReset().mockReturnValue(risultati());
  vi.useRealTimers();
});

afterEach(cleanup);

describe("ManiglieClient — ricerca", () => {
  it("prima di cercare invita a cercare, senza interrogare il server", () => {
    render(<ManiglieClient />);
    expect(screen.getByText("Cerca un articolo")).toBeTruthy();
    expect(screen.getByText("0CD41R-CM").className).toContain("font-mono");
    expect(searchQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: false });
  });

  it("il campo ha il placeholder e l'icona lente", () => {
    const { container } = render(<ManiglieClient />);
    const campo = screen.getByRole("searchbox") as HTMLInputElement;
    expect(campo.placeholder).toBe("Codice, nome o EAN");
    expect(container.querySelector("svg")).toBeTruthy();
    // Focus: bordo brand + alone (token dell'Input condiviso).
    expect(campo.className).toContain("focus-visible:ring-brand/25");
  });

  it("con una query nell'URL interroga il server e elenca i risultati", () => {
    sp = new URLSearchParams("q=cd41");
    render(<ManiglieClient />);
    expect(searchQuery.mock.calls[0]?.[0]).toMatchObject({ query: "cd41" });
    expect(searchQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: true });
    expect(screen.getByText("MANIGLIA ROBOQUATTRO")).toBeTruthy();
    expect(screen.getByText("0CD41R-CM").className).toContain("font-mono");
    expect(screen.getByText("48,31 €")).toBeTruthy();
  });

  it("ogni riga porta alla scheda (tutta la riga è cliccabile)", () => {
    sp = new URLSearchParams("q=cd41");
    render(<ManiglieClient />);
    const link = screen.getByLabelText("0CD41R-CM — MANIGLIA ROBOQUATTRO");
    expect(link).toHaveProperty("href", expect.stringContaining("/maniglie/a1"));
    expect(link.className).toContain("absolute");
    expect(link.className).toContain("inset-0");
  });

  it("mostra lo stato di ogni riga a parole", () => {
    sp = new URLSearchParams("q=cd41");
    render(<ManiglieClient />);
    expect(screen.getAllByText("In pronta consegna")).toHaveLength(1);
    expect(screen.getAllByText("Da ordinare")).toHaveLength(2);
  });

  // LA decisione di disegno: la data è una proprietà dell'import, identica su
  // ogni riga. Ripeterla venti volte è rumore.
  it("la data della pronta consegna compare UNA VOLTA SOLA", () => {
    sp = new URLSearchParams("q=cd41");
    const { container } = render(<ManiglieClient />);
    const occorrenze = container.textContent?.match(/28 luglio 2026/g) ?? [];
    expect(occorrenze).toHaveLength(1);
    expect(screen.getByText(/Pronta consegna aggiornata al/)).toBeTruthy();
  });

  // ...ma deve esserci SEMPRE quando si parla di disponibilità: anche a zero
  // risultati la domanda «di quando è questo dato?» ha la stessa risposta.
  it("la data c'è anche con zero risultati", () => {
    sp = new URLSearchParams("q=ZX99");
    searchQuery.mockReturnValue(
      risultati({
        data: { hits: [], total: 0, stockUpdates: [{ brand: "COLOMBO", importedAt: IMPORTATO }] },
      }),
    );
    render(<ManiglieClient />);
    expect(screen.getByText("28 luglio 2026")).toBeTruthy();
    expect(screen.getByText("Nessun articolo per «ZX99»")).toBeTruthy();
    expect(screen.getByText(/I separatori non contano/)).toBeTruthy();
  });

  // Senza import NON si scrive una data finta.
  it("senza pronta consegna caricata lo dice, invece di inventare una data", () => {
    sp = new URLSearchParams("q=cd41");
    searchQuery.mockReturnValue(
      risultati({ data: { hits: articoli, total: 3, stockUpdates: [] } }),
    );
    const { container } = render(<ManiglieClient />);
    expect(screen.getByText("Nessuna pronta consegna caricata")).toBeTruthy();
    expect(container.textContent).not.toMatch(/aggiornata al/);
  });

  it("conta i risultati al singolare e al plurale", () => {
    sp = new URLSearchParams("q=cd41");
    render(<ManiglieClient />);
    expect(screen.getByText(/^3 articoli/)).toBeTruthy();
    cleanup();

    searchQuery.mockReturnValue(
      risultati({
        data: {
          hits: [articoli[0]],
          total: 1,
          stockUpdates: [{ brand: "COLOMBO", importedAt: IMPORTATO }],
        },
      }),
    );
    render(<ManiglieClient />);
    expect(screen.getByText("1 articolo")).toBeTruthy();
  });

  // Il conteggio è la risposta alla ricerca: va annunciato.
  it("il conteggio è annunciato agli screen reader", () => {
    sp = new URLSearchParams("q=cd41");
    render(<ManiglieClient />);
    expect(screen.getByText(/^3 articoli/).getAttribute("aria-live")).toBe("polite");
  });

  // Con 3.456 codici un totale grande e venti righe a schermo si contraddicono:
  // lo si dice invece di lasciarlo intuire.
  it("dice quante righe sta mostrando quando il totale è più grande", () => {
    sp = new URLSearchParams("q=maniglia");
    searchQuery.mockReturnValue(
      risultati({
        data: {
          hits: articoli,
          total: 214,
          stockUpdates: [{ brand: "COLOMBO", importedAt: IMPORTATO }],
        },
      }),
    );
    render(<ManiglieClient />);
    expect(screen.getByText(/214 articoli · mostrati i primi 3/)).toBeTruthy();
  });

  it("in caricamento mostra uno skeleton, non uno spinner", () => {
    sp = new URLSearchParams("q=cd41");
    searchQuery.mockReturnValue(risultati({ data: undefined, isPending: true, isFetching: true }));
    const { container } = render(<ManiglieClient />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("in errore mostra il riquadro «Ricerca non riuscita»", () => {
    sp = new URLSearchParams("q=cd41");
    searchQuery.mockReturnValue(risultati({ data: undefined, isError: true }));
    render(<ManiglieClient />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Ricerca non riuscita/);
    expect(alert.textContent).toMatch(/Riprova fra qualche istante/);
    expect(alert.className).toContain("bg-[#FBEDED]");
  });

  // Il 15% dei codici è minuteria che nessun catalogo fotografa: la foto
  // mancante è la normalità, e non deve somigliare a un errore.
  it("senza foto disegna un segnaposto neutro, non un messaggio d'errore", () => {
    sp = new URLSearchParams("q=cd41");
    const { container } = render(<ManiglieClient />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.textContent).not.toMatch(/immagine|foto/i);
    expect(
      container.querySelectorAll(".bg-surface-sunken.rounded, .rounded.bg-surface-sunken").length,
    ).toBeGreaterThan(0);
  });

  it("se la foto non carica, la riga resta intera", () => {
    sp = new URLSearchParams("q=cd41");
    const { container } = render(<ManiglieClient />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByText("MANIGLIA ROBOQUATTRO")).toBeTruthy();
  });
});

describe("ManiglieClient — URL e debounce", () => {
  it("scrive la query nell'URL dopo il debounce, una volta sola e senza scrollare", () => {
    vi.useFakeTimers();
    render(<ManiglieClient />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "cd41" } });
    act(() => vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toBe("/maniglie?q=cd41");
    expect(replace.mock.calls[0]?.[1]).toMatchObject({ scroll: false });
  });

  it("non interroga a ogni tasto", () => {
    vi.useFakeTimers();
    render(<ManiglieClient />);
    const campo = screen.getByRole("searchbox");
    for (const v of ["c", "cd", "cd4", "cd41"]) {
      fireEvent.change(campo, { target: { value: v } });
      act(() => vi.advanceTimersByTime(100));
    }
    act(() => vi.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toBe("/maniglie?q=cd41");
  });

  it("svuotare il campo toglie il parametro invece di lasciare «?q=»", () => {
    vi.useFakeTimers();
    sp = new URLSearchParams("q=cd41");
    render(<ManiglieClient />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    act(() => vi.advanceTimersByTime(300));
    expect(replace.mock.calls[0]?.[0]).toBe("/maniglie");
  });

  // Tasto indietro: l'URL cambia da fuori, il campo deve seguirlo — altrimenti
  // a schermo si leggono risultati che non corrispondono a ciò che è scritto.
  it("il campo segue l'URL quando cambia da fuori (indietro/avanti)", () => {
    sp = new URLSearchParams("q=cd41");
    const { rerender } = render(<ManiglieClient />);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("cd41");

    sp = new URLSearchParams("q=rosetta");
    rerender(<ManiglieClient />);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("rosetta");
    expect(replace).not.toHaveBeenCalled();
  });
});
