// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const getQuery = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ kit: { get: { invalidate: vi.fn() }, list: { invalidate: vi.fn() } } }),
    kit: {
      get: { useQuery: () => getQuery() },
      generate: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
      },
    },
  },
}));

import { DettaglioClient } from "./dettaglio-client";

const request = {
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
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  totalComponents: 0,
  totalPrice: null,
  components: [],
  generatedKit: { warnings: ["Codice A99999.00.00 non a listino: riga esclusa dalla distinta."] },
};

afterEach(() => {
  cleanup();
  getQuery.mockReset();
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
