// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportClient } from "./import-client";

/**
 * L'import della pronta consegna è l'unico punto in cui una persona sola
 * pubblica un dato a dieci agenti. Quasi tutte le asserzioni qui sotto
 * guardano il RIEPILOGO: è ciò che sta fra il file della marca sbagliata e
 * dieci agenti che promettono merce che non c'è.
 */

const storicoQuery = vi.fn();
const orfaniQuery = vi.fn();
const confermaMutate = vi.fn();
const annullaMutate = vi.fn();
const invalidaStorico = vi.fn();

type Opzioni<T> = { onSuccess?: (dati: T) => void } | undefined;

interface RisultatoConferma {
  id: string;
  importedAt: string;
  matchedCount: number;
  orphanCount: number;
}

let risultatoConferma: RisultatoConferma = {
  id: "imp-9",
  importedAt: "2026-07-31T09:00:00.000Z",
  matchedCount: 178,
  orphanCount: 23,
};
let erroreConferma: { message: string } | null = null;

vi.mock("@/trpc/react", () => ({
  api: {
    article: {
      confirmStockImport: {
        useMutation: (opzioni: Opzioni<RisultatoConferma>) => ({
          mutate: (input: unknown) => {
            confermaMutate(input);
            opzioni?.onSuccess?.(risultatoConferma);
          },
          reset: vi.fn(),
          isPending: false,
          error: erroreConferma,
        }),
      },
      cancelLastStockImport: {
        useMutation: (opzioni: Opzioni<unknown>) => ({
          mutate: (input: unknown) => {
            annullaMutate(input);
            opzioni?.onSuccess?.({ cancelledId: "imp-2", nowInForceAt: null });
          },
          reset: vi.fn(),
          isPending: false,
          error: null,
        }),
      },
      stockImports: { useQuery: (...args: unknown[]) => storicoQuery(...args) },
      stockImportOrphans: { useQuery: (...args: unknown[]) => orfaniQuery(...args) },
    },
    useUtils: () => ({ article: { stockImports: { invalidate: invalidaStorico } } }),
  },
}));

const ANTEPRIMA = {
  fileName: "pronta-consegna.xls",
  brand: "COLOMBO",
  rawCodes: ["0CD41R-CM", "0CD42R-CM"],
  rowCount: 201,
  matchedCount: 178,
  orphans: ["0ZZ99R-CM", "0YY10R-CM"],
  duplicates: ["0CD41R-CM"],
  invalid: ["   -   "],
  entered: 12,
  left: 5,
  previousImportedAt: "2026-07-04T08:00:00.000Z",
};

const STORICO = [
  {
    id: "imp-3",
    fileName: "28-luglio.xls",
    importedAt: "2026-07-28T08:00:00.000Z",
    rowCount: 201,
    matchedCount: 178,
    orphanCount: 23,
    cancelledAt: null,
    importedBy: "Andrea Rossi",
    inForce: true,
  },
  {
    id: "imp-2",
    fileName: "04-luglio.xls",
    importedAt: "2026-07-04T08:00:00.000Z",
    rowCount: 190,
    matchedCount: 171,
    orphanCount: 19,
    cancelledAt: null,
    importedBy: "Andrea Rossi",
    inForce: false,
  },
  {
    id: "imp-1",
    fileName: "sbagliato.xls",
    importedAt: "2026-06-30T08:00:00.000Z",
    rowCount: 4,
    matchedCount: 0,
    orphanCount: 4,
    cancelledAt: "2026-06-30T09:00:00.000Z",
    importedBy: "Andrea Rossi",
    inForce: false,
  },
];

function rispostaOk(corpo: unknown) {
  return { ok: true, status: 200, json: async () => corpo } as Response;
}
function rispostaErrore(status: number, corpo: unknown) {
  return { ok: false, status, json: async () => corpo } as Response;
}

function fileXls(nome = "pronta-consegna.xls") {
  return new File(["codici"], nome, { type: "application/vnd.ms-excel" });
}

/** Porta il componente in fase 2 (riepilogo) caricando un file. */
async function caricaFile(anteprima: unknown = ANTEPRIMA) {
  vi.mocked(fetch).mockResolvedValueOnce(rispostaOk(anteprima));
  render(<ImportClient />);
  await userEvent.upload(screen.getByLabelText(/scegli dal computer/i), fileXls());
  await screen.findByText(/riepilogo prima della conferma/i);
}

beforeEach(() => {
  storicoQuery.mockReset().mockReturnValue({ data: [], isPending: false, isError: false });
  orfaniQuery.mockReset().mockReturnValue({ data: [], isPending: false, isError: false });
  confermaMutate.mockReset();
  annullaMutate.mockReset();
  invalidaStorico.mockReset();
  erroreConferma = null;
  risultatoConferma = {
    id: "imp-9",
    importedAt: "2026-07-31T09:00:00.000Z",
    matchedCount: 178,
    orphanCount: 23,
  };
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ImportClient — fase 1, carica", () => {
  it("l'input file è raggiungibile dalla sua etichetta e accetta .xls", () => {
    render(<ImportClient />);
    const input = screen.getByLabelText(/scegli dal computer/i) as HTMLInputElement;
    expect(input.type).toBe("file");
    expect(input.accept).toBe(".xls,.xlsx");
    expect(screen.getByText(/trascina qui il file/i)).toBeDefined();
    expect(screen.getByText(/viene letta solo la prima colonna/i)).toBeDefined();
  });

  it("manda il file e la marca alla route di anteprima", async () => {
    await caricaFile();
    expect(fetch).toHaveBeenCalledWith(
      "/api/maniglie/stock-import",
      expect.objectContaining({ method: "POST" }),
    );
    const corpo = vi.mocked(fetch).mock.calls[0]?.[1]?.body as FormData;
    expect(corpo.get("brand")).toBe("COLOMBO");
    expect((corpo.get("file") as File).name).toBe("pronta-consegna.xls");
  });

  it("accetta anche un file trascinato", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(rispostaOk(ANTEPRIMA));
    render(<ImportClient />);
    const zona = screen.getByText(/trascina qui il file/i).closest("div");
    expect(zona).not.toBeNull();
    // `userEvent` non ha drag&drop, e jsdom non implementa `DataTransfer`:
    // si passa dall'oggetto che il browser mette sull'evento.
    fireEvent.drop(zona!, { dataTransfer: { files: [fileXls()] } });
    await screen.findByText(/riepilogo prima della conferma/i);
  });

  it("mostra TESTUALMENTE l'errore della route, invece di inghiottirlo", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      rispostaErrore(400, { error: "File non leggibile: atteso un foglio di calcolo .xls" }),
    );
    render(<ImportClient />);
    await userEvent.upload(screen.getByLabelText(/scegli dal computer/i), fileXls());
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "File non leggibile: atteso un foglio di calcolo .xls",
    );
    // Senza riepilogo non si conferma niente.
    expect(screen.queryByRole("button", { name: /conferma importazione/i })).toBeNull();
  });

  it("una risposta senza messaggio non lascia Andrea senza spiegazione", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(rispostaErrore(413, null));
    render(<ImportClient />);
    await userEvent.upload(screen.getByLabelText(/scegli dal computer/i), fileXls());
    expect((await screen.findByRole("alert")).textContent).toMatch(/413/);
  });
});

describe("ImportClient — fase 2, il riepilogo", () => {
  it("mostra i tre numeri: righe lette, riconosciuti, non a listino", async () => {
    await caricaFile();
    expect(screen.getByText("201")).toBeDefined();
    expect(screen.getByText(/righe lette/i)).toBeDefined();
    expect(screen.getByText("178")).toBeDefined();
    expect(screen.getByText(/articoli riconosciuti/i)).toBeDefined();
    expect(screen.getByText(/codici non a listino/i)).toBeDefined();
  });

  it("dichiara la CONSEGUENZA, non l'azione", async () => {
    await caricaFile();
    expect(screen.getByText(/risulteranno in pronta consegna per tutti gli agenti/i)).toBeDefined();
  });

  it("elenca gli orfani UNO PER UNO e non li chiama errori", async () => {
    await caricaFile();
    expect(screen.getByText("0ZZ99R-CM")).toBeDefined();
    expect(screen.getByText("0YY10R-CM")).toBeDefined();
    expect(screen.getByText(/verranno ignorati/i)).toBeDefined();
    expect(screen.getByText(/si agganceranno da soli/i)).toBeDefined();
    // 18 su 23 sono prodotti veri: chiamarli errori manderebbe Andrea a cercare
    // un guasto che non c'è.
    const riepilogo = screen.getByText(/riepilogo prima della conferma/i).closest("section");
    expect(riepilogo?.textContent ?? "").not.toMatch(/errore|errori/i);
  });

  it("mostra la differenza rispetto all'import precedente", async () => {
    await caricaFile();
    expect(screen.getByText(/\+12/)).toBeDefined();
    expect(screen.getByText(/entrati rispetto al 4 luglio 2026/i)).toBeDefined();
    expect(screen.getByText(/−5/)).toBeDefined();
    expect(screen.getByText(/usciti/i)).toBeDefined();
  });

  it("senza un import precedente non inventa una differenza", async () => {
    await caricaFile({ ...ANTEPRIMA, previousImportedAt: null, entered: 178, left: 0 });
    expect(screen.queryByText(/entrati rispetto/i)).toBeNull();
  });

  it("spiega duplicati e celle non utilizzabili", async () => {
    await caricaFile();
    expect(screen.getByText(/ripetuto nel file: contato una volta sola/i)).toBeDefined();
    expect(screen.getByText(/senza un codice utilizzabile: ignorata/i)).toBeDefined();
  });

  it("senza duplicati né celle vuote non mostra righe inutili", async () => {
    await caricaFile({ ...ANTEPRIMA, duplicates: [], invalid: [] });
    expect(screen.queryByText(/ripetut/i)).toBeNull();
    expect(screen.queryByText(/codice utilizzabile/i)).toBeNull();
  });

  it("conferma: manda marca, nome file e codici, poi invalida lo storico", async () => {
    await caricaFile();
    await userEvent.click(screen.getByRole("button", { name: /conferma importazione/i }));
    expect(confermaMutate).toHaveBeenCalledWith({
      brand: "COLOMBO",
      fileName: "pronta-consegna.xls",
      rawCodes: ["0CD41R-CM", "0CD42R-CM"],
    });
    expect(invalidaStorico).toHaveBeenCalled();
  });

  it("annulla: torna alla fase 1 senza scrivere niente", async () => {
    await caricaFile();
    await userEvent.click(screen.getByRole("button", { name: /^annulla$/i }));
    expect(confermaMutate).not.toHaveBeenCalled();
    expect(screen.queryByText(/riepilogo prima della conferma/i)).toBeNull();
    expect(screen.getByLabelText(/scegli dal computer/i)).toBeDefined();
  });

  it("un errore della scrittura resta sotto gli occhi, nel riepilogo", async () => {
    erroreConferma = { message: "Nessun codice utilizzabile: import non creato." };
    await caricaFile();
    expect(screen.getByRole("alert").textContent).toMatch(/import non creato/i);
  });
});

describe("ImportClient — fase 3, fatto", () => {
  it("mostra l'esito con i numeri veri e riapre la fase 1", async () => {
    await caricaFile();
    await userEvent.click(screen.getByRole("button", { name: /conferma importazione/i }));
    const esito = await screen.findByRole("status");
    expect(esito.textContent).toMatch(/importazione completata/i);
    expect(esito.textContent).toMatch(/178/);
    expect(esito.textContent).toMatch(/23/);
    expect(screen.getByLabelText(/scegli dal computer/i)).toBeDefined();
    expect(screen.queryByText(/riepilogo prima della conferma/i)).toBeNull();
  });
});

describe("ImportClient — storico", () => {
  function rendiConStorico() {
    storicoQuery.mockReturnValue({ data: STORICO, isPending: false, isError: false });
    render(<ImportClient />);
    return within(screen.getByRole("table"));
  }

  it("chiede lo storico della marca", () => {
    rendiConStorico();
    expect(storicoQuery).toHaveBeenCalledWith({ brand: "COLOMBO" });
  });

  it("distingue in vigore, superato e annullato", () => {
    const tabella = rendiConStorico();
    expect(tabella.getByText("IN VIGORE")).toBeDefined();
    expect(tabella.getByText("superato")).toBeDefined();
    expect(tabella.getByText("annullato")).toBeDefined();
  });

  it("il pulsante «Annulla» esiste SOLO sulla riga in vigore", () => {
    const tabella = rendiConStorico();
    const annullamenti = tabella.getAllByRole("button", { name: /^annulla l'import/i });
    expect(annullamenti).toHaveLength(1);
    // Non disabilitato altrove: proprio assente. Un pulsante grigio invita a
    // chiedersi perché non funziona.
    expect(annullamenti[0]?.getAttribute("aria-label")).toMatch(/28\/07\/26/);
  });

  it("l'annullamento chiede conferma inline spiegando la conseguenza", async () => {
    const tabella = rendiConStorico();
    await userEvent.click(tabella.getByRole("button", { name: /^annulla l'import/i }));
    expect(screen.getByText(/smetterà di valere/i).textContent).toMatch(
      /28 luglio 2026.*4 luglio 2026/,
    );
    // Finché non si conferma, non si è scritto niente.
    expect(annullaMutate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /sì, annulla l'import/i }));
    expect(annullaMutate).toHaveBeenCalledWith({ brand: "COLOMBO" });
    await waitFor(() => expect(invalidaStorico).toHaveBeenCalled());
  });

  it("si può desistere dall'annullamento", async () => {
    const tabella = rendiConStorico();
    await userEvent.click(tabella.getByRole("button", { name: /^annulla l'import/i }));
    await userEvent.click(screen.getByRole("button", { name: /no, lascia com/i }));
    expect(screen.queryByText(/smetterà di valere/i)).toBeNull();
    expect(annullaMutate).not.toHaveBeenCalled();
  });

  it("espande una riga e mostra i suoi codici non a listino", async () => {
    orfaniQuery.mockReturnValue({
      data: ["0ZZ99R-CM", "0YY10R-CM"],
      isPending: false,
      isError: false,
    });
    const tabella = rendiConStorico();
    const freccia = tabella.getByRole("button", {
      name: /codici non a listino del file 28-luglio/i,
    });
    expect(freccia.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(freccia);
    expect(freccia.getAttribute("aria-expanded")).toBe("true");
    expect(orfaniQuery).toHaveBeenCalledWith({ importId: "imp-3" });
    expect(tabella.getByText("0ZZ99R-CM")).toBeDefined();
  });

  it("senza caricamenti spiega cosa vedono gli agenti, invece di una tabella vuota", () => {
    render(<ImportClient />);
    expect(screen.getByText(/nessun file ancora caricato/i)).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
