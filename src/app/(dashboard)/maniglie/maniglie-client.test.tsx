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
const stockInfoQuery = vi.fn<(...args: unknown[]) => { data?: { importedAt: Date | null } }>(
  () => ({}),
);
const browseGroupsQuery = vi.fn<(...args: unknown[]) => Record<string, unknown>>(() => ({}));
const browseFamiliesQuery = vi.fn<(...args: unknown[]) => Record<string, unknown>>(() => ({}));
vi.mock("@/trpc/react", () => ({
  api: {
    article: {
      search: { useQuery: (...args: unknown[]) => searchQuery(...args) },
      stockInfo: { useQuery: (...args: unknown[]) => stockInfoQuery(...args) },
      browseGroups: { useQuery: (...args: unknown[]) => browseGroupsQuery(...args) },
      browseFamilies: { useQuery: (...args: unknown[]) => browseFamiliesQuery(...args) },
    },
  },
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

/** I gruppi veri del listino COLOMBO, coi loro conteggi veri. */
const GRUPPI = [
  { word: "MANIGLIONE", count: 338 },
  { word: "BOCCHETTA", count: 288 },
  { word: "KIT", count: 139 },
  { word: "LARA", count: 28 },
];

beforeEach(() => {
  sp = new URLSearchParams("");
  replace.mockReset();
  searchQuery.mockReset().mockReturnValue(risultati());
  stockInfoQuery.mockReset().mockReturnValue({});
  browseGroupsQuery
    .mockReset()
    .mockReturnValue({ data: { groups: GRUPPI }, isPending: false, isError: false, isFetching: false });
  browseFamiliesQuery
    .mockReset()
    .mockReturnValue({ data: undefined, isPending: false, isError: false, isFetching: false });
  vi.useRealTimers();
});

afterEach(cleanup);

/**
 * «Nessuna disponibilità si mostra senza la data dell'ultimo import» è una
 * regola inviolabile della spec, e vale in tutti e tre gli stati della pagina —
 * non solo quando ci sono risultati. La data è l'unica cosa che dice all'agente
 * se fidarsi, e saperlo PRIMA di cercare gli risparmia una ricerca inutile.
 */
describe("ManiglieClient — la data c'è sempre", () => {
  // Senza ricerca attiva la query è `enabled: false` e NON ha dati: il mock
  // deve dire la stessa cosa, altrimenti questi test passerebbero leggendo la
  // data dei risultati e non proverebbero nulla.
  const senzaRicerca = () =>
    searchQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      isFetching: false,
    });

  it("prima ancora di cercare, appena aperta la pagina", () => {
    senzaRicerca();
    stockInfoQuery.mockReturnValue({ data: { importedAt: IMPORTATO } });
    render(<ManiglieClient />);
    expect(screen.getByText("Sfoglia il catalogo")).toBeTruthy();
    expect(screen.getByText(/28 luglio 2026/)).toBeTruthy();
  });

  it("non inventa una data se la pronta consegna non è mai stata caricata", () => {
    senzaRicerca();
    stockInfoQuery.mockReturnValue({ data: { importedAt: null } });
    render(<ManiglieClient />);
    expect(screen.getByText(/Nessuna pronta consegna caricata/i)).toBeTruthy();
  });

  it("quando i risultati arrivano, la data viene da loro e non resta duplicata", () => {
    stockInfoQuery.mockReturnValue({ data: { importedAt: new Date("2020-01-01") } });
    sp = new URLSearchParams("q=cd41");
    render(<ManiglieClient />);
    // Una sola fascia a schermo, ed è quella dei risultati: se restassero
    // entrambe, l'agente leggerebbe due date diverse per lo stesso dato.
    expect(screen.getAllByText(/aggiornata al/i)).toHaveLength(1);
    expect(screen.getByText(/28 luglio 2026/)).toBeTruthy();
  });
});

describe("ManiglieClient — ricerca", () => {
  it("prima di cercare NON interroga la ricerca", () => {
    render(<ManiglieClient />);
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
  it("con più risultati della pagina, la paginazione dice dove si è", () => {
    // Prima non c'era: il client mandava `limit` e mai `offset`, quindi cercare
    // «maniglione» mostrava 20 righe su 338 senza alcun modo di vedere le altre.
    sp = new URLSearchParams("q=cd41");
    searchQuery.mockReturnValue(risultati({ data: { hits: articoli, total: 214, stockUpdates: [] } }));
    render(<ManiglieClient />);
    expect(screen.getByText("214 articoli")).toBeTruthy();
    expect(screen.getByLabelText("Paginazione")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Successiva" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Precedente" }).hasAttribute("disabled")).toBe(true);
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

/**
 * SFOGLIO. La denuncia da cui nasce: `article.search` imponeva `query.min(1)` e
 * il client non chiamava nulla finché non si digitava, quindi NON esisteva alcun
 * percorso che elencasse qualcosa senza scrivere. «Disponibilità» era una
 * casella bianca, e rispondeva solo a chi già conosceva il codice.
 */
describe("ManiglieClient — sfoglio", () => {
  it("appena aperta la pagina elenca i gruppi, senza che si sia digitato nulla", () => {
    render(<ManiglieClient />);
    expect(screen.getByText("Sfoglia il catalogo")).toBeTruthy();
    expect(screen.getByText("MANIGLIONE")).toBeTruthy();
    expect(screen.getByText("338 codici")).toBeTruthy();
    expect(searchQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: false });
  });

  it("dichiara da dove vengono le etichette", () => {
    // Sono parole di COLOMBO, refusi compresi. Senza l'origine a schermo
    // sembrerebbero una classificazione nostra.
    render(<ManiglieClient />);
    expect(screen.getByText(/prima parola della descrizione a listino/i)).toBeTruthy();
  });

  it("ogni gruppo porta al proprio livello 2 via URL, non via stato nascosto", () => {
    render(<ManiglieClient />);
    const link = screen.getByText("LARA").closest("a");
    expect(link?.getAttribute("href")).toBe("/maniglie?tipo=LARA");
  });

  it("dentro un gruppo mostra le famiglie, in mono perché sono pezzi di codice", () => {
    sp = new URLSearchParams("tipo=LARA");
    browseFamiliesQuery.mockReturnValue({
      data: { families: [{ family: "CB71R", count: 8 }], loose: [], total: 8 },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    expect(screen.getByText("CB71R").className).toContain("font-mono");
    expect(screen.getByText("8 codici")).toBeTruthy();
    // Il livello 3 non si chiede finché non si sceglie una famiglia.
    expect(searchQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: false });
  });

  it("i codici SENZA famiglia restano raggiungibili, sotto le famiglie", () => {
    // Su 114 gruppi veri, SETTANTA hanno copertura parziale: mostrare le sole
    // famiglie renderebbe irraggiungibili codici che hanno prezzo e giacenza.
    sp = new URLSearchParams("tipo=LARA");
    browseFamiliesQuery.mockReturnValue({
      data: { families: [{ family: "CB71R", count: 8 }], loose: [articoli[0]], total: 9 },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    expect(screen.getByText("Senza famiglia")).toBeTruthy();
    expect(screen.getByText(/il listino non lega a una famiglia/i)).toBeTruthy();
    expect(screen.getByText("MANIGLIA ROBOQUATTRO")).toBeTruthy();
  });

  it("un gruppo senza famiglie salta il livello 2 e mostra i codici", () => {
    // KIT: 139 codici e zero famiglie. Un livello che non divide nulla sarebbe
    // un tocco in più per vedere la stessa identica lista.
    sp = new URLSearchParams("tipo=KIT");
    browseFamiliesQuery.mockReturnValue({
      data: { families: [], loose: [], total: 139 },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    expect(searchQuery.mock.calls[0]?.[0]).toMatchObject({ tipo: "KIT" });
    expect(searchQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: true });
    expect(screen.getByText("MANIGLIA ROBOQUATTRO")).toBeTruthy();
  });

  it("scelta la famiglia chiede i codici di quella famiglia", () => {
    sp = new URLSearchParams("tipo=LARA&fam=CB71R");
    render(<ManiglieClient />);
    expect(searchQuery.mock.calls[0]?.[0]).toMatchObject({ tipo: "LARA", famiglia: "CB71R" });
    expect(searchQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: true });
  });

  it("i chip dicono dove si è, e la ✕ è un link (così il tasto indietro funziona)", () => {
    sp = new URLSearchParams("tipo=LARA&fam=CB71R");
    render(<ManiglieClient />);
    expect(screen.getByLabelText("Togli il gruppo LARA").getAttribute("href")).toBe("/maniglie");
    expect(screen.getByLabelText("Togli la famiglia CB71R").getAttribute("href")).toBe(
      "/maniglie?tipo=LARA",
    );
  });

  it("l'offset segue la pagina dell'URL: era il debito dichiarato", () => {
    sp = new URLSearchParams("tipo=LARA&fam=CB71R&p=3");
    render(<ManiglieClient />);
    expect(searchQuery.mock.calls[0]?.[0]).toMatchObject({ offset: 40, limit: 20 });
  });

  it("digitare abbandona lo sfoglio invece di cercare dentro un gruppo invisibile", async () => {
    sp = new URLSearchParams("tipo=LARA&fam=CB71R");
    render(<ManiglieClient />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "peruzzi" } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(replace).toHaveBeenCalledWith("/maniglie?q=peruzzi", { scroll: false });
  });

  it("la fascia della data è sticky: in una lista lunga il pallino verde non resta senza data", () => {
    stockInfoQuery.mockReturnValue({ data: { importedAt: IMPORTATO } });
    searchQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    const fascia = screen.getByText(/aggiornata al/i).closest("p");
    expect(fascia?.className).toContain("sticky");
    expect(fascia?.className).toContain("top-0");
  });
});
