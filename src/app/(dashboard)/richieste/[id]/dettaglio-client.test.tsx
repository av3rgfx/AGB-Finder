// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const getQuery = vi.fn();
const ricalcolaMutate = vi.fn();
const generateMutate = vi.fn();
const generateMutateAsync = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ kit: { get: { invalidate: vi.fn() }, list: { invalidate: vi.fn() } } }),
    kit: {
      get: { useQuery: () => getQuery() },
      generate: {
        useMutation: () => ({
          mutate: generateMutate,
          mutateAsync: generateMutateAsync,
          isPending: false,
          isError: false,
          error: null,
        }),
      },
      ricalcola: {
        useMutation: () => ({
          mutateAsync: ricalcolaMutate,
          isPending: false,
          isError: false,
          error: null,
        }),
      },
    },
  },
}));

import { DettaglioClient } from "./dettaglio-client";
import { geometriaLabel } from "@/server/kit/artech-geometrie";

const request = {
  id: "k1",
  requestNumber: "KIT-2026-0001",
  status: "DRAFT",
  windowType: "ANTA_RIBALTA",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 550,
  heightMm: 1820,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  geometry: "A12_I13_B20",
  seatConfig: "STANDARD",
  airGapMm: null,
  axisOffsetMm: null,
  rebateMm: null,
  seatMm: null,
  sashWeightKg: null,
  tourSchema: null,
  supersededById: null,
  totalComponents: 0,
  totalPrice: null,
  components: [],
  generatedKit: { warnings: ["Codice A99999.00.00 non a listino: riga esclusa dalla distinta."] },
};

afterEach(() => {
  cleanup();
  getQuery.mockReset();
  ricalcolaMutate.mockReset();
  generateMutate.mockReset();
  generateMutateAsync.mockReset();
  push.mockReset();
});

describe("DettaglioClient — distinta senza componenti risolti", () => {
  it("mostra i warning anche senza componenti a listino (non spariscono senza traccia)", () => {
    getQuery.mockReturnValue({ isPending: false, isError: false, data: request });
    render(<DettaglioClient id="k1" />);
    // Il warning è visibile pur senza DistintaTable...
    expect(screen.getByText(/non a listino/i)).toBeTruthy();
    // ...e al suo posto compare il placeholder «Distinta non ancora generata».
    expect(screen.getByText(/distinta non ancora generata/i)).toBeTruthy();
  });
});

/**
 * Le quattro colonne legacy (`air_gap_mm`, `axis_offset_mm`, `rebate_mm`,
 * `seat_mm`) sono NULL su ogni riga creata dopo la migrazione geometria: la
 * scheda le mostrava e avrebbe perso la geometria proprio sulle righe nuove.
 */
describe("DettaglioClient — geometria", () => {
  it("mostra la geometria e la sede DERIVATA (righe nuove)", () => {
    getQuery.mockReturnValue({ isPending: false, isError: false, data: request });
    render(<DettaglioClient id="k1" />);
    expect(screen.getByText(geometriaLabel("A12_I13_B20"))).toBeTruthy();
    expect(screen.getByText(/18 mm — derivata/i)).toBeTruthy();
  });

  // Regola inviolabile «mobile-first»: la riga «Geometria» è il valore più lungo
  // del progetto e a due colonne fisse andava a capo tre volte a 375px.
  it("specifiche: una colonna sotto sm (mobile-first)", () => {
    getQuery.mockReturnValue({ isPending: false, isError: false, data: request });
    const { container } = render(<DettaglioClient id="k1" />);
    const dl = container.querySelector("dl");
    expect(dl?.className).toContain("grid-cols-1");
    expect(dl?.className).toContain("sm:grid-cols-3");
  });

  it("riga legacy (geometry NULL): mostra le quote storiche invece di sparire", () => {
    getQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        ...request,
        geometry: null,
        seatConfig: null,
        airGapMm: 12,
        axisOffsetMm: 13,
        rebateMm: 20,
        seatMm: 18,
      },
    });
    render(<DettaglioClient id="k1" />);
    expect(screen.getByText(/^aria$/i)).toBeTruthy();
    expect(screen.getByText(/sede telaio/i)).toBeTruthy();
  });
});

describe("DettaglioClient — ricalcolo versionato", () => {
  it("su DRAFT non offre «Ricalcola» (basta «Rigenera»)", () => {
    getQuery.mockReturnValue({ isPending: false, isError: false, data: request });
    render(<DettaglioClient id="k1" />);
    expect(screen.queryByRole("button", { name: /ricalcola/i })).toBeNull();
  });

  it("su una richiesta già emessa ricalcola e apre la NUOVA versione", async () => {
    getQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...request, status: "COMPLETED" },
    });
    ricalcolaMutate.mockResolvedValue({ id: "k2", requestNumber: "KIT-2026-0002" });
    generateMutateAsync.mockResolvedValue({ totalComponents: 16 });
    render(<DettaglioClient id="k1" />);
    fireEvent.click(screen.getByRole("button", { name: /ricalcola/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/richieste/k2"));
    expect(ricalcolaMutate).toHaveBeenCalledWith({ kitRequestId: "k1" });
    // «Ricalcola» deve RICALCOLARE: la nuova versione nasce DRAFT e senza questa
    // generazione l'agente atterrerebbe su «Distinta non ancora generata» con un
    // pulsante da premere — il nome del pulsante sarebbe una bugia.
    expect(generateMutateAsync).toHaveBeenCalledWith({ kitRequestId: "k2" });
  });

  it("se la generazione della nuova versione falla, apre comunque la nuova scheda", async () => {
    getQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...request, status: "COMPLETED" },
    });
    ricalcolaMutate.mockResolvedValue({ id: "k2", requestNumber: "KIT-2026-0002" });
    generateMutateAsync.mockRejectedValue(new Error("fuori campo di applicazione"));
    render(<DettaglioClient id="k1" />);
    fireEvent.click(screen.getByRole("button", { name: /ricalcola/i }));
    // La riga nuova esiste ed è DRAFT: nasconderla lascerebbe una versione
    // creata e mai vista. L'errore è visibile sulla sua scheda.
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/richieste/k2"));
  });

  /**
   * «Rigenera» riscrive `kit_components` IN LOCO e dei componenti non esiste
   * storico: su una riga già emessa cancellerebbe in silenzio la distinta che il
   * cliente ha in mano, su una riga superata corromperebbe lo storico che
   * `ricalcola` ha congelato. I due pulsanti devono essere mutuamente esclusivi
   * — ed erano adiacenti.
   */
  it("su DRAFT offre «Rigenera»", () => {
    getQuery.mockReturnValue({ isPending: false, isError: false, data: request });
    render(<DettaglioClient id="k1" />);
    expect(screen.getByRole("button", { name: /rigenera/i })).toBeTruthy();
  });

  it("su una richiesta COMPLETED NON offre «Rigenera» (solo «Ricalcola»)", () => {
    getQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...request, status: "COMPLETED" },
    });
    render(<DettaglioClient id="k1" />);
    expect(screen.queryByRole("button", { name: /rigenera/i })).toBeNull();
    expect(screen.getByRole("button", { name: /ricalcola/i })).toBeTruthy();
  });

  it("riga già superata: nessuno dei due pulsanti", () => {
    getQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...request, status: "COMPLETED", supersededById: "k2" },
    });
    render(<DettaglioClient id="k1" />);
    expect(screen.queryByRole("button", { name: /rigenera/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /ricalcola/i })).toBeNull();
  });

  it("riga già superata: nessun «Ricalcola», ma il link alla versione più recente", () => {
    getQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...request, status: "COMPLETED", supersededById: "k2" },
    });
    render(<DettaglioClient id="k1" />);
    expect(screen.queryByRole("button", { name: /ricalcola/i })).toBeNull();
    expect(screen.getByRole("link", { name: /versione più recente/i }).getAttribute("href")).toBe(
      "/richieste/k2",
    );
  });
});
