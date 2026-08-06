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
const browseSerieQuery = vi.fn<(...args: unknown[]) => Record<string, unknown>>(() => ({}));
const finitureQuery = vi.fn<(...args: unknown[]) => Record<string, unknown>>(() => ({}));
vi.mock("@/trpc/react", () => ({
  api: {
    article: {
      search: { useQuery: (...args: unknown[]) => searchQuery(...args) },
      stockInfo: { useQuery: (...args: unknown[]) => stockInfoQuery(...args) },
      browseGroups: { useQuery: (...args: unknown[]) => browseGroupsQuery(...args) },
      browseSerie: { useQuery: (...args: unknown[]) => browseSerieQuery(...args) },
      finiture: { useQuery: (...args: unknown[]) => finitureQuery(...args) },
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

/** Gruppi veri del listino COLOMBO, coi conteggi veri, in ordine alfabetico. */
/**
 * `isModello` non è un nostro giudizio: è la struttura dell'archivio
 * fotografico di COLOMBO. LARA ha il suo archivio, BOCCHETTA e KIT no.
 */
let serieFinta: (
  righe?: unknown[],
  senzaSerie?: unknown[],
  isModello?: boolean,
) => Record<string, unknown>;

/**
 * `isAccessorio` è invece una lista di ANDREA, e non è deducibile da
 * `isModello`: KIT e ROSETTA non hanno archivio e sono accessori, MANIGLIONE
 * non ha archivio e maniglia è. BOCCHETTA è passata fra gli accessori il
 * 2026-08-06, quindi non serve più come controesempio: MANIGLIONE lo è ancora.
 */
const GRUPPI = [
  { word: "BOCCHETTA", count: 318, isModello: false, isAccessorio: true, preview: null },
  { word: "KIT", count: 140, isModello: false, isAccessorio: true, preview: null },
  {
    word: "LARA",
    count: 28,
    isModello: true,
    isAccessorio: false,
    preview: "/api/article-image?k=lara&size=320",
  },
  { word: "MANIGLIONE", count: 353, isModello: false, isAccessorio: false, preview: null },
  { word: "ROSETTA", count: 105, isModello: false, isAccessorio: true, preview: null },
];

beforeEach(() => {
  sp = new URLSearchParams("");
  replace.mockReset();
  finitureQuery.mockReset().mockReturnValue({ data: { finiture: [] } });
  searchQuery.mockReset().mockReturnValue(risultati());
  stockInfoQuery.mockReset().mockReturnValue({ data: { importedAt: IMPORTATO } });
  browseGroupsQuery
    .mockReset()
    .mockReturnValue({ data: { groups: GRUPPI }, isPending: false, isError: false, isFetching: false });
  browseSerieQuery
    .mockReset()
    .mockReturnValue({ data: undefined, isPending: false, isError: false, isFetching: false });
  serieFinta = (righe = [], senzaSerie = [], isModello = false) => ({
    data: {
      isModello,
      serie: righe.length
        ? [
            {
              serie: "CB71R",
              count: righe.length,
              preview: "/api/article-image?k=cb71r&size=320",
              rows: righe,
            },
          ]
        : [],
      senzaSerie,
      total: righe.length + senzaSerie.length,
    },
    isPending: false,
    isError: false,
    isFetching: false,
  });
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
    expect(screen.getByLabelText("MANIGLIONE, 353 codici")).toBeTruthy();
    expect(searchQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: false });
  });

  it("mostra TUTTI i gruppi: nessuna soglia decisa da noi", () => {
    // «I primi 20 + mostra tutti» richiederebbe una soglia che nessun dato
    // sostiene, ed è la classe di difetto chiusa otto volte. Sui dati veri i
    // primi 19 gruppi sono già il 55% del catalogo: un taglio nasconderebbe il
    // 45%, non una coda.
    render(<ManiglieClient />);
    for (const g of GRUPPI) expect(screen.getByText(g.word)).toBeTruthy();
    expect(screen.queryByText(/mostra tutti/i)).toBeNull();
  });

  it("dichiara cosa conta il numero, e NON promette più che le etichette siano di COLOMBO", () => {
    // La frase «come li nomina COLOMBO» era già FALSA prima delle fusioni:
    // `ROBOCINQUE S` è una stringa che componiamo noi, e ROSETTA raccoglie le
    // righe scritte `ROS.`. Il test vecchio verificava che la frase CI FOSSE,
    // quindi sarebbe passato identico per sempre.
    // Resta vero e utile dire cosa conta il numero: «338» sono CODICI, non
    // modelli — le descrizioni distinte di MANIGLIONE sono 160.
    render(<ManiglieClient />);
    expect(screen.queryByText(/come li nomina COLOMBO/i)).toBeNull();
    expect(screen.getByText(/ordine alfabetico/i)).toBeTruthy();
    expect(screen.getByText(/il numero è quanti codici/i)).toBeTruthy();
    expect(screen.getByText(/non quanti modelli/i)).toBeTruthy();
  });

  it("il gruppo-modello mostra la sua foto, la tipologia non ha un'area immagine vuota", () => {
    // In una griglia un riquadro vuoto si legge come «immagine rotta»; una
    // tessera di solo testo si legge come una tessera di solo testo. E su una
    // TIPOLOGIA (BOCCHETTA raccoglie 22 serie) una foto sola sarebbe un modello
    // a caso spacciato per la categoria.
    render(<ManiglieClient />);
    // `alt=""` toglie l'immagine dall'albero di accessibilità (è decorativa: a
    // portare il significato è il nome del gruppo), quindi si cerca nel DOM.
    const foto = document.querySelectorAll("img");
    expect(foto).toHaveLength(1);
    expect(foto[0]?.getAttribute("src")).toBe("/api/article-image?k=lara&size=320");
  });

  it("dichiara le categorie che NON si sfogliano", () => {
    // Senza, chi cerca una vite nel catalogo e non la trova conclude che non la
    // trattiamo — mentre è a magazzino e la ricerca la restituisce.
    render(<ManiglieClient />);
    expect(screen.getByText(/viti, dadi, chiavi e rondelle non si sfogliano/i)).toBeTruthy();
  });

  it("il campo filtra le etichette senza interrogare il server", () => {
    render(<ManiglieClient />);
    fireEvent.change(screen.getByPlaceholderText("Filtra i gruppi…"), { target: { value: "ros" } });
    expect(screen.getByText("ROSETTA")).toBeTruthy();
    expect(screen.queryByText("MANIGLIONE")).toBeNull();
    // Nessuna query nuova: filtra le etichette già in memoria.
    expect(searchQuery.mock.calls.every((c) => (c[1] as { enabled: boolean }).enabled === false)).toBe(true);
  });

  it("se il filtro non trova nulla lo dice, e rimanda alla ricerca vera", () => {
    render(<ManiglieClient />);
    fireEvent.change(screen.getByPlaceholderText("Filtra i gruppi…"), { target: { value: "zzz" } });
    expect(screen.getByText(/Nessun gruppo contiene «zzz»/)).toBeTruthy();
  });

  it("ogni gruppo porta al proprio livello 2 via URL, non via stato nascosto", () => {
    render(<ManiglieClient />);
    const link = screen.getByText("LARA").closest("a");
    expect(link?.getAttribute("href")).toBe("/maniglie?tipo=LARA");
  });

  /**
   * L'ordinamento è del server, che lo fissa in TypeScript per non dipendere
   * dalla collation del database: il client non riordina.
   *
   * Dal 2026-08-05 il client PARTIZIONA in due bande — ed è un riordino
   * dichiarato, con un'intestazione che lo annuncia. L'invariante che resta, e
   * che questo test protegge, è che DENTRO ogni banda l'ordine sia quello che
   * il server ha mandato.
   */
  it("dentro ogni banda i gruppi restano nell'ordine del server", () => {
    const { container } = render(<ManiglieClient />);
    const per = [...container.querySelectorAll("ul")].map((ul) =>
      [...ul.querySelectorAll("li")].map((li) => li.querySelector("span")?.textContent),
    );
    const bande = per.filter((b) => b.length > 0 && GRUPPI.some((g) => b.includes(g.word)));
    expect(bande[0]).toEqual(["LARA", "MANIGLIONE"]);
    expect(bande[1]).toEqual(["BOCCHETTA", "KIT", "ROSETTA"]);
  });

  it("dentro un gruppo mostra le SERIE a tendina, in mono perché sono pezzi di codice", () => {
    sp = new URLSearchParams("tipo=LARA");
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]]));
    render(<ManiglieClient />);
    expect(screen.getByText("CB71R").className).toContain("font-mono");
    expect(screen.getByText("1 codice")).toBeTruthy();
    // La ricerca testuale non si interroga sfogliando: lo sfoglio ha un lettore
    // solo, o le stesse righe avrebbero due definizioni libere di divergere.
    expect(searchQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: false });
  });

  it("le righe di una serie sono già in pagina anche a tendina CHIUSA", () => {
    // È ciò che rende l'apertura istantanea: nessuna richiesta, nessuno
    // scheletro. E il browser non scarica le foto di ciò che è `display:none`.
    sp = new URLSearchParams("tipo=LARA");
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]]));
    render(<ManiglieClient />);
    expect(screen.getByText("MANIGLIA ROBOQUATTRO")).toBeTruthy();
    expect(document.querySelector("details")?.open).toBe(false);
  });

  it("una serie elencata in ?fam= nasce APERTA", () => {
    sp = new URLSearchParams("tipo=LARA&fam=CB71R");
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]]));
    render(<ManiglieClient />);
    expect(document.querySelector("details")?.open).toBe(true);
  });

  it("aprire una serie la scrive nell'URL, senza scrollare", () => {
    sp = new URLSearchParams("tipo=LARA");
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]]));
    render(<ManiglieClient />);
    const dettaglio = document.querySelector("details")!;
    dettaglio.open = true;
    fireEvent(dettaglio, new Event("toggle", { bubbles: false }));
    // `history.replaceState` e non `router.replace`: quest'ultimo fa un giro
    // sul server, e aprendo due tendine di fila la seconda scrittura si perdeva
    // nella corsa. Niente, sul server, dipende da `?fam=`.
    expect(window.location.search).toContain("fam=CB71R");
    expect(replace).not.toHaveBeenCalled();
  });

  it("aprendo DUE serie di fila l'URL le elenca entrambe", () => {
    // Il difetto trovato in browser e non dai test: il secondo `toggle` scatta
    // prima che React abbia recepito la scrittura del primo, quindi leggendo
    // `searchParams` avrebbe sovrascritto con la sola serie appena aperta —
    // due tendine aperte a schermo, una sola nell'URL, e la seconda persa al
    // primo ricaricamento.
    sp = new URLSearchParams("tipo=LARA");
    browseSerieQuery.mockReturnValue({
      data: {
        serie: [
          { serie: "CB71R", count: 1, preview: null, rows: [articoli[0]] },
          { serie: "CB72DK", count: 1, preview: null, rows: [articoli[0]] },
        ],
        senzaSerie: [],
        total: 2,
      },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    const dettagli = document.querySelectorAll("details");
    for (const d of dettagli) {
      d.open = true;
      fireEvent(d, new Event("toggle", { bubbles: false }));
    }
    // L'URL si scrive con `history.replaceState` e non con `router.replace`:
    // quest'ultimo fa un giro sul server e la seconda scrittura si perdeva
    // nella corsa (misurato in browser). Niente, sul server, dipende da `?fam=`.
    expect(window.location.search).toContain("fam=CB71R%2CCB72DK");
  });

  it("i codici SENZA serie restano raggiungibili, sotto le serie", () => {
    // Su 3.393 codici sfogliabili sessanta non hanno una serie: mostrare le
    // sole serie li renderebbe irraggiungibili pur avendo prezzo e giacenza.
    sp = new URLSearchParams("tipo=LARA");
    browseSerieQuery.mockReturnValue(serieFinta([], [articoli[0]]));
    render(<ManiglieClient />);
    expect(screen.getByText("Codici senza serie")).toBeTruthy();
    expect(screen.getByText(/il listino non lega a una serie/i)).toBeTruthy();
    expect(screen.getByText("MANIGLIA ROBOQUATTRO")).toBeTruthy();
  });

  it("un gruppo vuoto lo dice, invece di sembrare rotto", () => {
    sp = new URLSearchParams("tipo=LARA");
    browseSerieQuery.mockReturnValue(serieFinta([], []));
    render(<ManiglieClient />);
    expect(screen.getByText("Nessun codice in questo gruppo")).toBeTruthy();
  });

  it("il chip dice dove si è, e la ✕ è un link (così il tasto indietro funziona)", () => {
    sp = new URLSearchParams("tipo=LARA&fam=CB71R");
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]]));
    render(<ManiglieClient />);
    expect(screen.getByLabelText("Togli il gruppo LARA").getAttribute("href")).toBe("/maniglie");
  });

  it("digitare abbandona lo sfoglio invece di cercare dentro un gruppo invisibile", async () => {
    sp = new URLSearchParams("tipo=LARA&fam=CB71R");
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]]));
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

/**
 * IL FILTRO «SOLO PRONTA CONSEGNA». La ragione per cui esiste è un numero: sul
 * listino vero sono 178 codici su 3.456, il 5,2%. Sfogliando senza filtro, 19
 * codici su 20 non sono ordinabili oggi — ed è la domanda letterale di Andrea.
 */
describe("ManiglieClient — solo pronta consegna", () => {
  it("il filtro c'è, ed è spento finché non lo si accende", () => {
    render(<ManiglieClient />);
    const casella = screen.getByLabelText("Solo pronta consegna") as HTMLInputElement;
    expect(casella.checked).toBe(false);
    expect(browseGroupsQuery.mock.calls[0]?.[0]).toMatchObject({ soloPronta: false });
  });

  it("NON compare se nessuna pronta consegna è mai stata caricata", () => {
    // Un interruttore che non può rispondere è peggio della sua assenza: senza
    // import non esiste una risposta a «cosa è pronto», e non si finge. La fonte
    // è la stessa della data mostrata sopra, non una seconda affermazione.
    stockInfoQuery.mockReturnValue({ data: { importedAt: null } });
    render(<ManiglieClient />);
    expect(screen.queryByLabelText("Solo pronta consegna")).toBeNull();
  });

  it("non compare mentre si CERCA: il filtro appartiene allo sfoglio", () => {
    sp = new URLSearchParams("q=cd41");
    render(<ManiglieClient />);
    expect(screen.queryByLabelText("Solo pronta consegna")).toBeNull();
  });

  it("è raggiungibile anche da DENTRO un gruppo, non solo dal primo livello", () => {
    sp = new URLSearchParams("tipo=LARA");
    browseSerieQuery.mockReturnValue({
      data: { families: [{ family: "CB71R", count: 2 }], loose: [], total: 2 },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    expect(screen.getByLabelText("Solo pronta consegna")).toBeTruthy();
  });

  it("accendendolo lo scrive nell'URL, non in uno stato nascosto", () => {
    render(<ManiglieClient />);
    fireEvent.click(screen.getByLabelText("Solo pronta consegna"));
    expect(replace).toHaveBeenCalledWith("/maniglie?pronta=1", { scroll: false });
  });

  it("acceso, lo dice al server", () => {
    sp = new URLSearchParams("pronta=1");
    render(<ManiglieClient />);
    expect(browseGroupsQuery.mock.calls[0]?.[0]).toMatchObject({ soloPronta: true });
  });

  it("acceso, DICHIARA che il numero conta un altro insieme", () => {
    // Un numero che cambia significato in silenzio è la classe di difetto
    // chiusa otto volte, e qui cambierebbe di venti volte.
    sp = new URLSearchParams("pronta=1");
    render(<ManiglieClient />);
    expect(screen.getByText(/il numero è quanti codici in pronta consegna/i)).toBeTruthy();
  });

  it("resta acceso scendendo di livello, e RESTA VISIBILE", () => {
    // Uno stato nascosto che toglie 19 righe su 20 farebbe concludere
    // all'agente che il catalogo non ha quell'articolo.
    sp = new URLSearchParams("tipo=LARA&pronta=1");
    browseSerieQuery.mockReturnValue({
      data: { families: [{ family: "CB71R", count: 2 }], loose: [], total: 2 },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    expect(browseSerieQuery.mock.calls[0]?.[0]).toMatchObject({ tipo: "LARA", soloPronta: true });
    const casella = screen.getByLabelText("Solo pronta consegna") as HTMLInputElement;
    expect(casella.checked).toBe(true);
  });

  it("spegnerlo da dentro un gruppo non fa perdere il gruppo", () => {
    sp = new URLSearchParams("tipo=LARA&pronta=1");
    browseSerieQuery.mockReturnValue({
      data: { families: [{ family: "CB71R", count: 2 }], loose: [], total: 2 },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    fireEvent.click(screen.getByLabelText("Solo pronta consegna"));
    expect(replace).toHaveBeenCalledWith("/maniglie?tipo=LARA", { scroll: false });
  });

  it("i link dei gruppi se lo portano dietro", () => {
    sp = new URLSearchParams("pronta=1");
    render(<ManiglieClient />);
    expect(screen.getByText("LARA").closest("a")?.getAttribute("href")).toBe(
      "/maniglie?tipo=LARA&pronta=1",
    );
  });

  it("arriva anche alle righe, che ora vivono dentro le serie", () => {
    // Prima era una terza domanda (`search({tipo, famiglia})`); ora le righe
    // arrivano con le serie, quindi il filtro va dove va la classificazione.
    sp = new URLSearchParams("tipo=LARA&fam=CB71R&pronta=1");
    render(<ManiglieClient />);
    expect(browseSerieQuery.mock.calls[0]?.[0]).toMatchObject({
      tipo: "LARA",
      soloPronta: true,
    });
  });

  it("accenderlo riparte da pagina 1", () => {
    // Restare alla pagina 7 di un elenco sceso da 338 a 12 codici significa
    // vedere una schermata vuota e credere che non ci sia niente.
    sp = new URLSearchParams("tipo=LARA&p=7");
    browseSerieQuery.mockReturnValue({
      data: { families: [], loose: [], total: 12 },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    fireEvent.click(screen.getByLabelText("Solo pronta consegna"));
    expect(replace).toHaveBeenCalledWith("/maniglie?tipo=LARA&pronta=1", { scroll: false });
  });

  it("se non c'è nulla in pronta consegna lo dice, invece di sembrare rotto", () => {
    sp = new URLSearchParams("pronta=1");
    browseGroupsQuery.mockReturnValue({
      data: { groups: [], prontaDisponibile: true },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    render(<ManiglieClient />);
    expect(screen.getByText("Nessun articolo in pronta consegna.")).toBeTruthy();
  });
});

describe("ManiglieClient — filtro finitura", () => {
  const FINITURE = [
    { codice: "CR", nome: "Cromo", colore: "#EAE7E6", count: 493 },
    { codice: "CM", nome: "Cromat", colore: "#D6D4D4", count: 592 },
  ];

  beforeEach(() => {
    finitureQuery.mockReturnValue({ data: { finiture: FINITURE } });
  });

  it("offre le finiture presenti, col nome e quante ne contengono", () => {
    render(<ManiglieClient />);
    expect(screen.getByRole("button", { name: /Cromat/ }).textContent).toMatch(/Cromat.*592/);
  });

  it("sceglierne una la scrive nell'URL e riparte da pagina 1", () => {
    sp = new URLSearchParams("tipo=FEDRA&p=3");
    render(<ManiglieClient />);
    fireEvent.click(screen.getByRole("button", { name: /Cromo/ }));
    expect(replace).toHaveBeenCalledWith("/maniglie?tipo=FEDRA&finitura=CR", { scroll: false });
  });

  it("rivotare la stessa finitura la toglie", () => {
    sp = new URLSearchParams("tipo=FEDRA&finitura=CR");
    render(<ManiglieClient />);
    fireEvent.click(screen.getByRole("button", { name: /Cromo/ }));
    expect(replace).toHaveBeenCalledWith("/maniglie?tipo=FEDRA", { scroll: false });
  });

  it("la finitura scelta passa a entrambe le domande dello sfoglio", () => {
    // Sono due e non più tre: le righe arrivano con le serie.
    sp = new URLSearchParams("tipo=FEDRA&finitura=CR");
    render(<ManiglieClient />);
    expect(browseSerieQuery.mock.calls[0]?.[0]).toMatchObject({ finitura: "CR" });
    expect(browseGroupsQuery.mock.calls[0]?.[0]).toMatchObject({ finitura: "CR" });
  });

  it("l'elenco delle finiture NON si restringe con quella già scelta", () => {
    // Un filtro che cancella le proprie alternative è un vicolo cieco.
    sp = new URLSearchParams("tipo=FEDRA&finitura=CR");
    render(<ManiglieClient />);
    expect(finitureQuery.mock.calls[0]?.[0]).toEqual({ soloPronta: false, tipo: "FEDRA" });
  });

  it("cercando per testo il filtro non compare e non si chiede", () => {
    // Restringere in silenzio ciò che l'agente ha chiesto scrivendo è la stessa
    // ragione per cui «solo pronta consegna» non vale nella ricerca.
    sp = new URLSearchParams("q=fedra");
    render(<ManiglieClient />);
    expect(screen.queryByText("Finitura")).toBeNull();
    expect(finitureQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: false });
  });

  it("senza finiture da offrire il controllo non c'è", () => {
    finitureQuery.mockReturnValue({ data: { finiture: [] } });
    render(<ManiglieClient />);
    expect(screen.queryByText("Finitura")).toBeNull();
  });
});

describe("ManiglieClient — il numero dichiara di cosa parla", () => {
  beforeEach(() => {
    finitureQuery.mockReturnValue({
      data: { finiture: [{ codice: "OL", nome: "Oroplus", colore: "#F8EAB4", count: 377 }] },
    });
    browseGroupsQuery.mockReturnValue({ data: { groups: [{ word: "FEDRA", count: 7 }] } });
  });

  it("col filtro acceso lo dice, col nome della finitura e non col codice", () => {
    sp = new URLSearchParams("finitura=OL");
    render(<ManiglieClient />);
    expect(screen.getByText(/Il numero è quanti codici/).textContent).toMatch(
      /nella finitura Oroplus/,
    );
  });

  it("coi due filtri accesi li dice entrambi", () => {
    sp = new URLSearchParams("finitura=OL&pronta=1");
    render(<ManiglieClient />);
    expect(screen.getByText(/Il numero è quanti codici/).textContent).toMatch(
      /in pronta consegna e nella finitura Oroplus/,
    );
  });

  it("scendendo in un gruppo il filtro non si spegne da solo", () => {
    sp = new URLSearchParams("finitura=OL");
    render(<ManiglieClient />);
    const link = screen.getByRole("link", { name: /FEDRA/ });
    expect(link.getAttribute("href")).toBe("/maniglie?tipo=FEDRA&finitura=OL");
  });

  it("senza filtri la frase resta pulita", () => {
    sp = new URLSearchParams("");
    render(<ManiglieClient />);
    expect(screen.getByText(/Il numero è quanti codici/).textContent).toMatch(
      /codici, non quanti modelli/,
    );
  });
});

/**
 * LA SEZIONE «ACCESSORI» (verdetto del council, 2026-08-05: non un livello e
 * non un filtro — una sezione, zero stato, zero parametri URL).
 *
 * La banda di SOPRA non ha intestazione, e non è una svista: qualunque nome
 * sarebbe falso («Maniglie» starebbe sopra MANIGLIONE 353 e POMOLINO 41)
 * oppure sarebbe una SECONDA parola nostra. Non affermare nulla è ciò che la
 * rende onesta, e fa sì che un gruppo nuovo mai classificato non dica il falso.
 */
describe("ManiglieClient — la sezione Accessori", () => {
  it("dimostra prima di guardare nel posto giusto: le tessere ci sono tutte", () => {
    render(<ManiglieClient />);
    for (const g of GRUPPI) expect(screen.getByText(g.word)).toBeTruthy();
  });

  it("una sola intestazione, ed è quella degli accessori", () => {
    const { container } = render(<ManiglieClient />);
    const titoli = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(titoli).toEqual(["Accessori"]);
  });

  it("dichiara che «Accessori» è parola nostra e non di COLOMBO", () => {
    render(<ManiglieClient />);
    const riga = screen.getByText(/raggruppamento nostro/i);
    expect(riga.textContent).toContain("COLOMBO");
  });

  it("gli accessori stanno DOPO gli altri nell'ordine del documento", () => {
    const { container } = render(<ManiglieClient />);
    const href = [...container.querySelectorAll("a[href*='tipo=']")].map((a) =>
      a.getAttribute("href"),
    );
    expect(href.indexOf("/maniglie?tipo=KIT")).toBeGreaterThan(
      href.indexOf("/maniglie?tipo=MANIGLIONE"),
    );
  });

  it("il collegamento in cima porta alla banda e ne dice il numero", () => {
    render(<ManiglieClient />);
    const salto = screen.getByRole("link", { name: /Accessori \(3\)/ });
    expect(salto.getAttribute("href")).toBe("#accessori");
  });

  // «accessori» non è il nome di NESSUN gruppo: senza questo, digitarla non
  // troverebbe nulla mentre la parola si legge sopra la griglia.
  it("digitando «accessori» compaiono i 19, che non la contengono nel nome", () => {
    render(<ManiglieClient />);
    fireEvent.change(screen.getByPlaceholderText("Filtra i gruppi…"), {
      target: { value: "accessori" },
    });
    expect(screen.getByText("KIT")).toBeTruthy();
    expect(screen.getByText("ROSETTA")).toBeTruthy();
    expect(screen.queryByText("LARA")).toBeNull();
  });

  it("quando il filtro svuota la banda, spariscono sezione e collegamento", () => {
    const { container } = render(<ManiglieClient />);
    fireEvent.change(screen.getByPlaceholderText("Filtra i gruppi…"), {
      target: { value: "LARA" },
    });
    expect(container.querySelectorAll("h3")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: /Accessori \(/ })).toBeNull();
  });
});

/**
 * LA MINIATURA DELLE RIGHE, 2026-08-06.
 *
 * In MANIGLIONE il segnaposto grigio compariva su 336 righe su 353, e — visto
 * in browser — sotto un'intestazione di serie che la foto CE L'HA: non diceva
 * «non l'abbiamo», diceva «ce l'abbiamo e non te la mostriamo».
 *
 * Non è una decisione nuova: è già scritta in `AnteprimaSerie` («otto riquadri
 * grigi in colonna si leggono come *il programma è rotto*») e non era stata
 * applicata alle righe.
 */
describe("ManiglieClient — la miniatura delle righe", () => {
  beforeEach(() => {
    sp = new URLSearchParams("q=cd41");
  });

  it("una riga CON foto la mostra", () => {
    const { container } = render(<ManiglieClient />);
    const riga = container.querySelector("a[href='/maniglie/a1']")!.closest("li")!;
    expect(riga.querySelector("img")).toBeTruthy();
  });

  it("una riga SENZA foto lascia lo spazio, non un segnaposto", () => {
    const { container } = render(<ManiglieClient />);
    const riga = container.querySelector("a[href='/maniglie/a2']")!.closest("li")!;
    expect(riga.querySelector("img")).toBeNull();
    expect(riga.querySelector("svg")).toBeNull();
    // La colonna resta, o l'allineamento si muoverebbe riga per riga.
    expect(riga.className).toContain("44px");
  });
});

/**
 * LA FORMA DELLA TESSERA, 2026-08-06.
 *
 * Segue `preview`, non `isModello`. Con `isModello` i quattro gruppi di pomoli
 * — modelli rimasti senza foto dopo la PR #60 — mostravano un riquadro grigio
 * VUOTO: esattamente la cosa che la regola della PR #58 esisteva per impedire
 * («in una griglia un buco si legge come immagine rotta»), in produzione per un
 * mese. Ora un riquadro vuoto è impossibile per costruzione.
 */
describe("ManiglieClient — la forma della tessera", () => {
  const soloGruppo = (g: Record<string, unknown>) =>
    browseGroupsQuery.mockReturnValue({
      data: { groups: [g] },
      isPending: false,
      isError: false,
      isFetching: false,
    });

  it("una tessera senza foto non ha area immagine né segnaposto", () => {
    const { container } = render(<ManiglieClient />);
    const kit = container.querySelector("a[href*='tipo=KIT']")!;
    expect(kit.querySelector("img")).toBeNull();
    expect(kit.querySelector("svg")).toBeNull();
  });

  it("un MODELLO senza preview è una tessera-parola, non un riquadro vuoto", () => {
    soloGruppo({ word: "CUT", count: 11, isModello: true, isAccessorio: false, preview: null });
    const { container } = render(<ManiglieClient />);
    const cut = container.querySelector("a[href*='tipo=CUT']")!;
    expect(cut.querySelector("img")).toBeNull();
    expect(cut.querySelector("svg")).toBeNull();
    expect(cut.textContent).toContain("CUT");
  });

  it("un gruppo con preview mostra la foto", () => {
    soloGruppo({
      word: "CUT",
      count: 11,
      isModello: true,
      isAccessorio: false,
      preview: "/api/article-image?k=cut&size=320",
    });
    const { container } = render(<ManiglieClient />);
    expect(container.querySelector("a[href*='tipo=CUT'] img")).toBeTruthy();
  });

  /**
   * La griglia allunga le tessere. Senza, quella senza foto resta appesa in
   * cima a una riga di tessere alte e lascia il buco sotto di sé — ed è per
   * QUESTO che si legge come «immagine mancante», non perché la foto manchi.
   */
  it("la griglia dei gruppi allunga le tessere alla stessa altezza", () => {
    const { container } = render(<ManiglieClient />);
    const griglia = container.querySelector("ul.grid")!;
    expect(griglia.className).toContain("items-stretch");
    expect(griglia.className).not.toContain("items-start");
  });

  it("dichiara che la foto è del modello e non della finitura", () => {
    render(<ManiglieClient />);
    expect(screen.getByText(/del modello, non della finitura/i)).toBeTruthy();
  });
});

/**
 * L'ANTEPRIMA DELLA TENDINA, rifatta il 2026-08-05.
 *
 * Andrea: «la foto della tendina che si rimpicciolisce quando si apre confonde
 * e non serve a nulla quando è piccola perché non si vede». La scelta era
 * dell'utente fra tre opzioni: non è una regressione, è una prova sul campo che
 * ha battuto una preferenza.
 *
 * La regola è quella già scritta al livello 1: **la foto compare dove
 * distingue, non dove ripete.** Dentro FEDRA le serie sono la stessa maniglia
 * in varianti — la foto non era piccola, era RIPETUTA. Dentro BOCCHETTA (22
 * modelli) e MANIGLIONE (52) distingue davvero.
 */
describe("ManiglieClient — l'anteprima della tendina", () => {
  beforeEach(() => {
    sp = new URLSearchParams("tipo=BOCCHETTA");
  });

  it("dimostra di guardare nel posto giusto: la tendina c'è", () => {
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]], [], false));
    const { container } = render(<ManiglieClient />);
    expect(container.querySelectorAll("details summary").length).toBeGreaterThan(0);
  });

  it("dentro una TIPOLOGIA l'anteprima c'è", () => {
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]], [], false));
    const { container } = render(<ManiglieClient />);
    expect(container.querySelectorAll("summary img")).toHaveLength(1);
  });

  it("dentro un GRUPPO-MODELLO non c'è area immagine affatto", () => {
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]], [], true));
    const { container } = render(<ManiglieClient />);
    expect(container.querySelectorAll("summary img")).toHaveLength(0);
  });

  it("l'anteprima non cambia misura all'apertura", () => {
    sp = new URLSearchParams("tipo=BOCCHETTA&fam=CB71R");
    browseSerieQuery.mockReturnValue(serieFinta([articoli[0]], [], false));
    const { container } = render(<ManiglieClient />);
    const img = container.querySelector("summary img");
    expect(img?.className).toContain("size-14");
    expect(img?.className).not.toContain("size-8");
  });

  // Con la copertura scesa al 46,5% le anteprime mancanti sono frequenti: otto
  // riquadri grigi in colonna si leggono come «il programma è rotto».
  it("una preview mancante non disegna un segnaposto", () => {
    browseSerieQuery.mockReturnValue({
      data: {
        isModello: false,
        serie: [{ serie: "CB71R", count: 1, preview: null, rows: [articoli[0]] }],
        senzaSerie: [],
        total: 1,
      },
      isPending: false,
      isError: false,
      isFetching: false,
    });
    const { container } = render(<ManiglieClient />);
    const summary = container.querySelector("summary");
    expect(summary?.querySelector("svg")?.classList.contains("lucide-package")).not.toBe(true);
  });
});
