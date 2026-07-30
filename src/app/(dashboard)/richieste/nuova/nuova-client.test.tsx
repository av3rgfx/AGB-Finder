// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const createMutate = vi.fn();
const generateMutate = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: {
    kit: {
      create: { useMutation: () => ({ mutateAsync: createMutate, isPending: false }) },
      generate: {
        useMutation: () => ({ mutateAsync: generateMutate, isPending: false, error: null }),
      },
    },
  },
}));

import { NuovaRichiestaClient, materialForWindowType } from "./nuova-client";
import { windowTypeLabel } from "@/lib/kit-labels";
import { GEOMETRIE, geometriaLabel, type ArtechGeometryId } from "@/server/kit/artech-geometrie";

afterEach(() => {
  cleanup();
  push.mockReset();
  createMutate.mockReset();
  generateMutate.mockReset();
});

describe("NuovaRichiestaClient", () => {
  it("parte dallo step 1 con ARTECH/anta-ribalta preselezionati", () => {
    render(<NuovaRichiestaClient />);
    expect(screen.getByText(/anta.?ribalta/i)).toBeTruthy();
    expect(screen.getByText(/artech/i)).toBeTruthy();
  });

  it("materiale: solo LEGNO selezionabile, PVC e ALLUMINIO disabilitati (gated)", () => {
    render(<NuovaRichiestaClient />);
    const materiale = screen.getByRole("group", { name: /materiale/i });
    const legno = within(materiale).getByRole("radio", { name: /legno/i }) as HTMLInputElement;
    const pvc = within(materiale).getByRole("radio", { name: /pvc/i }) as HTMLInputElement;
    const alluminio = within(materiale).getByRole("radio", {
      name: /alluminio/i,
    }) as HTMLInputElement;

    expect(legno.checked).toBe(true);
    expect(legno.disabled).toBe(false);
    expect(pvc.disabled).toBe(true); // PVC gated: composizione non a listino 2026
    expect(alluminio.disabled).toBe(true); // ALLUMINIO gated: manca il listino
    expect(within(materiale).getByText(/non ancora disponibile/i)).toBeTruthy();
    expect(within(materiale).getByText(/non a listino 2026/i)).toBeTruthy();
  });

  // Regola inviolabile «mobile-first»: gli hint dei materiali sono lunghi («Non
  // a listino 2026 — serve il listino PVC e alluminio») e a tre colonne fisse
  // finivano su 5-6 righe fuori dal bordo in ~90px di cella a 375px. Come per il
  // font-mono dei codici, la regola sta in un test perché non sia possibile
  // riportarla indietro senza accorgersene.
  it("materiale: griglia a una colonna sotto sm (mobile-first)", () => {
    render(<NuovaRichiestaClient />);
    const grid = screen.getByRole("group", { name: /materiale/i }).querySelector("div.grid");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-3");
  });

  // RIMOSSE 2026-07-25 le due prove «cliccare la radio gated non cambia nulla»
  // (una sul PVC, una sul battente): erano tautologiche. Il click su una radio
  // `disabled` è inerte e l'asserzione finale — LEGNO/anta-ribalta ancora
  // selezionati — è già vera al primo render, quindi passavano anche con il
  // componente rotto. Che PVC/ALLUMINIO/battente siano gated è già asserito
  // sopra (`disabled === true`), e il ramo di reset del materiale che la prova
  // sul PVC voleva coprire è ora provato davvero su `materialForWindowType`, in
  // fondo al file: via UI non è più raggiungibile, perché ogni tipologia
  // selezionabile ammette il solo LEGNO.

  it("radio disabilitata (ALLUMINIO): l'hint è descrizione (aria-describedby), non parte del nome accessibile", () => {
    render(<NuovaRichiestaClient />);
    const materiale = screen.getByRole("group", { name: /materiale/i });
    const alu = within(materiale).getByRole("radio", { name: /alluminio/i });
    const describedby = alu.getAttribute("aria-describedby");
    expect(describedby).toBeTruthy();
    expect(document.getElementById(describedby!)?.textContent).toMatch(/non ancora disponibile/i);
  });

  it("blocca lo step dimensioni se fuori range", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.change(screen.getByLabelText(/larghezza/i), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.getByRole("alert").textContent?.length).toBeGreaterThan(0);
  });

  it("finitura: propone ARGENTO come unica opzione (tabella coperture ARTECH legno)", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3 (default validi)
    const select = screen.getByLabelText(/finitura/i) as HTMLSelectElement;
    expect(select.value).toBe("ARGENTO");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["ARGENTO"]);
  });

  // GEOMETRIA (2026-07-30). Il wizard chiedeva quattro numeri liberi — aria,
  // interasse, battuta, sede telaio — e un agente esperto, intervistato, non ha
  // saputo dire cosa fosse la «sede telaio». Le combinazioni pubblicate dal
  // listino 2026 sono 7 in tutto: si scelgono, non si digitano.
  it("il passo geometria offre le 7 combinazioni con aria/interasse/battuta in chiaro", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
    const geometria = screen.getByRole("group", { name: /geometria/i });
    // Data-driven sulla TABELLA, non su una lista ricopiata: se una geometria
    // uscisse dalla UI (o entrasse in tabella senza radio) questo test cade.
    const ids = Object.keys(GEOMETRIE) as ArtechGeometryId[];
    expect(within(geometria).getAllByRole("radio")).toHaveLength(ids.length);
    for (const id of ids) {
      expect(within(geometria).getByLabelText(geometriaLabel(id))).toBeTruthy();
    }
    // Le due citate dal capitolato, in chiaro e all'italiana (virgola decimale).
    expect(within(geometria).getByLabelText(/aria 4 · interasse 8,5 · battuta 15/i)).toBeTruthy();
    expect(within(geometria).getByLabelText(/aria 12 · interasse 13 · battuta 18/i)).toBeTruthy();
  });

  // Regola inviolabile «mobile-first», stessa ragione dei materiali: «Aria 12 ·
  // interasse 13 · battuta 18» a due colonne fisse andrebbe a capo tre volte in
  // ~170px di cella a 375px.
  it("geometria: griglia a una colonna sotto sm (mobile-first)", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    const grid = screen.getByRole("group", { name: /geometria/i }).querySelector("div.grid");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
  });

  it("non chiede più la sede telaio: al passo quote restano le due misure", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    expect(screen.getByLabelText(/larghezza/i)).toBeTruthy();
    expect(screen.getByLabelText(/altezza/i)).toBeTruthy();
    expect(screen.queryByLabelText(/sede telaio/i)).toBeNull();
    expect(screen.queryByLabelText(/aria/i)).toBeNull();
    expect(screen.queryByLabelText(/asse/i)).toBeNull();
    expect(screen.queryByLabelText(/battuta/i)).toBeNull();
    // …e nemmeno al passo geometria, dove la sede è DERIVATA.
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
    expect(screen.queryByLabelText(/sede telaio/i)).toBeNull();
  });

  // `SEDE_30` è persistibile (enum a DB + zod) ma il motore la RIFIUTA sempre:
  // p0473 (471) non pubblica un incontro DSS 13x30. Va mostrata e gated, come
  // PVC/ALLUMINIO: nasconderla farebbe ordinare STANDARD a chi ha una sede 30 —
  // distinta completa, plausibile e sbagliata.
  it("sede 30: visibile ma non selezionabile, con la ragione a schermo", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    const sede = screen.getByRole("group", { name: /sede degli incontri/i });
    const standard = within(sede).getByRole("radio", { name: /standard/i }) as HTMLInputElement;
    const sede30 = within(sede).getByRole("radio", { name: /30 mm/i }) as HTMLInputElement;
    expect(standard.checked).toBe(true);
    expect(sede30.disabled).toBe(true);
    expect(within(sede).getByText(/13x30/i)).toBeTruthy();
  });

  // Stessa ragione della sede 30, un gradino più grave: la sede 20 non è nemmeno
  // *esprimibile* (nessuna delle 7 geometrie deriva 20, l'enum `seatConfig` non la
  // ha) quindi il motore non la rifiuta mai, e senza questa voce a schermo nulla
  // direbbe all'agente che il suo serramento 9x20 non è coperto: sceglierebbe
  // «Standard» e riceverebbe l'incontro 9x18 (`A51400.05.02`) al posto del 9x20
  // (`A51400.12.02`). Distinta completa, plausibile, sbagliata.
  it("sede 20: visibile ma non selezionabile, con la ragione a schermo", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    const sede = screen.getByRole("group", { name: /sede degli incontri/i });
    const sede20 = within(sede).getByRole("radio", { name: /20 mm/i }) as HTMLInputElement;
    expect(sede20.disabled).toBe(true);
    expect(sede20.checked).toBe(false);
    expect(within(sede).getByText(/9x20/i)).toBeTruthy();
    // Mobile-first: il terzo radio non deve introdurre colonne fisse (a 375px le
    // ragioni sono lunghe e una cella da ~170px le manderebbe a capo cinque volte).
    const grid = sede.querySelector("div.grid");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
  });

  it("il riepilogo mostra la geometria e la sede derivata, non quattro numeri", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // → riepilogo
    expect(screen.getByText(geometriaLabel("A12_I13_B20"))).toBeTruthy();
    expect(screen.getByText(/18 mm — derivata/i)).toBeTruthy();
  });

  // Regola inviolabile «mobile-first», stessa ragione della griglia geometria:
  // il riepilogo ospita il valore più lungo del progetto («Aria 12 · interasse
  // 13 · battuta 20») e a due colonne fisse andava a capo tre volte a 375px.
  it("riepilogo: una colonna sotto sm (mobile-first)", () => {
    const { container } = render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // → riepilogo
    const dl = container.querySelector("dl");
    expect(dl?.className).toContain("grid-cols-1");
    expect(dl?.className).toContain("sm:grid-cols-3");
  });

  it("aria 4: la sede non esiste, il riepilogo dice «fresatura»", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    const geometria = screen.getByRole("group", { name: /geometria/i });
    fireEvent.click(within(geometria).getByLabelText(geometriaLabel("A4_I9_B18")));
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // → riepilogo
    // Stringa esatta prodotta da sedeIncontriLabel(null): esiste SOLO nel
    // riepilogo (Step4Riepilogo), a differenza della regex /fresatura/i usata
    // prima, che matchava anche l'hint del passo 3 — il test passava per
    // coincidenza di testo anche quando il passo non avanzava davvero.
    expect(screen.getByText("Fresatura (aria 4)")).toBeTruthy();
  });

  it("la geometria scelta finisce nell'input di create", async () => {
    createMutate.mockResolvedValue({ id: "k11", requestNumber: "KIT-2026-0003" });
    generateMutate.mockResolvedValue({ totalComponents: 16 });
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    const geometria = screen.getByRole("group", { name: /geometria/i });
    fireEvent.click(within(geometria).getByLabelText(geometriaLabel("A12_I13_B18")));
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/richieste/k11"));
    // `create` riceve ora { specs, customerId? }: il cliente e` un dato
    // commerciale e viaggia ACCANTO alle specifiche, non dentro l'input del
    // motore. Si asserisce su `.specs`, che e` cio` che il motore vede.
    expect(createMutate.mock.calls[0]![0].specs).toEqual(
      // entrata: il test clicca «7,5 mm» sopra — verifica che il valore scelto
      // arrivi davvero nell'input di create, non solo che il passo avanzi.
      expect.objectContaining({ geometry: "A12_I13_B18", seatConfig: "STANDARD", entrata: "E75" }),
    );
  });

  it("toggle chiusure supplementari: default off, attivabile", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    const toggle = screen.getByLabelText(/chiusure supplementari/i) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
  });

  it("al riepilogo genera: create → generate → redirect al dettaglio", async () => {
    createMutate.mockResolvedValue({ id: "k9", requestNumber: "KIT-2026-0001" });
    generateMutate.mockResolvedValue({ totalComponents: 20 });
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // default validi
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/richieste/k9"));
    // `create` riceve ora { specs, customerId? }: il cliente e` un dato
    // commerciale e viaggia ACCANTO alle specifiche, non dentro l'input
    // del motore. Si asserisce su `.specs`, che e` cio` che il motore vede.
    expect(createMutate.mock.calls[0]![0].specs).toEqual(
      expect.objectContaining({
        material: "LEGNO",
        supplementaryClosures: false,
        geometry: "A12_I13_B20",
        seatConfig: "STANDARD",
        // entrata: il test clicca «7,5 mm» sopra — verifica che il valore scelto
        // arrivi davvero nell'input di create, non solo che il passo avanzi.
        entrata: "E75",
      }),
    );
    expect(generateMutate).toHaveBeenCalledWith({ kitRequestId: "k9" });
  });

  // ANTA_BATTENTE DISATTIVATO 2026-07-25: la distinta sarebbe priva del gruppo
  // di sospensione superiore (schema p0416 (414)) → tipologia gated come le future.
  // Le vecchie prove «ANTA_BATTENTE: materiali / chiusure» sono cadute qui: non
  // essendo più selezionabile, verificavano l'anta-ribalta sotto un altro nome.
  // L'equivalente su una tipologia non-ribalta è coperto dalle prove VASISTAS in
  // fondo al file.
  it("tipologia: ANTA_RIBALTA e VASISTAS selezionabili, battente e altre disabilitate", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    const ribalta = within(tipo).getByRole("radio", { name: /anta.?ribalta/i }) as HTMLInputElement;
    const vasistas = within(tipo).getByRole("radio", {
      name: new RegExp(windowTypeLabel("VASISTAS"), "i"),
    }) as HTMLInputElement;
    const battente = within(tipo).getByRole("radio", {
      name: /anta battente/i,
    }) as HTMLInputElement;
    const proiettante = within(tipo).getByRole("radio", {
      name: new RegExp(windowTypeLabel("ANTA_PROIETTANTE"), "i"),
    }) as HTMLInputElement;
    expect(ribalta.checked).toBe(true);
    expect(vasistas.disabled).toBe(false);
    expect(battente.disabled).toBe(true); // gated: distinta senza sospensione superiore
    expect(proiettante.disabled).toBe(true); // FUTURE_WINDOW_TYPES: non ancora coperta dal generatore
  });

  it("attiva chiusure supplementari su ANTA_RIBALTA poi passa a VASISTAS: resettate a false alla generazione", async () => {
    createMutate.mockResolvedValue({ id: "k10", requestNumber: "KIT-2026-0002" });
    generateMutate.mockResolvedValue({ totalComponents: 16 });
    render(<NuovaRichiestaClient />);

    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2 (ANTA_RIBALTA)
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    const toggle = screen.getByLabelText(/chiusure supplementari/i) as HTMLInputElement;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /indietro/i })); // torna a step 2
    fireEvent.click(screen.getByRole("button", { name: /indietro/i })); // torna a step 1

    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(
      within(tipo).getByRole("radio", { name: new RegExp(windowTypeLabel("VASISTAS"), "i") }),
    );

    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    // 15 mm, non 7,5: I2 (revisione finale) disabilita l'entrata 7,5 sulla
    // VASISTAS (il motore la rifiuta), quindi non è più cliccabile qui.
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /15 mm/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 4
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/richieste/k10"));
    // `create` riceve ora { specs, customerId? }: il cliente e` un dato
    // commerciale e viaggia ACCANTO alle specifiche, non dentro l'input
    // del motore. Si asserisce su `.specs`, che e` cio` che il motore vede.
    expect(createMutate.mock.calls[0]![0].specs).toEqual(
      expect.objectContaining({ supplementaryClosures: false }),
    );
  });

  it("VASISTAS è selezionabile e mostra solo LEGNO (PVC/ALLUMINIO gated)", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    const vasistas = within(tipo).getByRole("radio", {
      name: new RegExp(windowTypeLabel("VASISTAS"), "i"),
    }) as HTMLInputElement;
    expect(vasistas.disabled).toBe(false);
    fireEvent.click(vasistas);
    expect(vasistas.checked).toBe(true);

    const mat = screen.getByRole("group", { name: /materiale/i });
    expect((within(mat).getByRole("radio", { name: /legno/i }) as HTMLInputElement).disabled).toBe(
      false,
    );
    expect((within(mat).getByRole("radio", { name: /pvc/i }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (within(mat).getByRole("radio", { name: /alluminio/i }) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  // Le 7 geometrie sono TUTTE ordinabili solo per l'anta-ribalta. Il modulo
  // vasistas ha le voci geometria-dipendenti cablate sul pilota e rifiuta le
  // altre sei: renderle cliccabili sarebbe la stessa trappola della sede 30.
  it("VASISTAS: solo la geometria del pilota è selezionabile, le altre sei gated", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(
      within(tipo).getByRole("radio", { name: new RegExp(windowTypeLabel("VASISTAS"), "i") }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3

    const geometria = screen.getByRole("group", { name: /geometria/i });
    const abilitate = within(geometria)
      .getAllByRole("radio")
      .filter((radio) => !(radio as HTMLInputElement).disabled);
    expect(abilitate).toHaveLength(1);
    expect(abilitate[0]).toBe(within(geometria).getByLabelText(geometriaLabel("A12_I13_B20")));
    expect((abilitate[0] as HTMLInputElement).checked).toBe(true);
    expect(within(geometria).getAllByText(/solo per l'anta-ribalta/i).length).toBeGreaterThan(0);
  });

  it("ANTA_RIBALTA: tutte e sette le geometrie sono selezionabili", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    const geometria = screen.getByRole("group", { name: /geometria/i });
    const disabilitate = within(geometria)
      .getAllByRole("radio")
      .filter((radio) => (radio as HTMLInputElement).disabled);
    expect(disabilitate).toHaveLength(0);
  });

  // I2 (revisione finale 2026-07-30): il motore rifiuta E75 sulla vasistas
  // (rules-artech-vasistas-legno.ts:205), ma l'opzione era selezionabile — un
  // agente la sceglieva, il passo avanzava, `kit.create` consumava un numero di
  // richiesta e solo `kit.generate` falliva. Specchia `geometriaAmmessa`.
  it("VASISTAS: l'entrata 7,5 è disabilitata (gated), con l'hint del perché", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(
      within(tipo).getByRole("radio", { name: new RegExp(windowTypeLabel("VASISTAS"), "i") }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    const entrata = screen.getByRole("group", { name: /entrata maniglia/i });
    const settantacinque = within(entrata).getByRole("radio", {
      name: /7,5 mm/i,
    }) as HTMLInputElement;
    expect(settantacinque.disabled).toBe(true);
    expect(within(entrata).getByText(/non coperta per la vasistas/i)).toBeTruthy();
  });

  it("ANTA_RIBALTA: l'entrata 7,5 resta selezionabile (non gated)", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    const entrata = screen.getByRole("group", { name: /entrata maniglia/i });
    const settantacinque = within(entrata).getByRole("radio", {
      name: /7,5 mm/i,
    }) as HTMLInputElement;
    expect(settantacinque.disabled).toBe(false);
  });

  it("VASISTAS: niente toggle chiusure supplementari (ribalta-only)", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(
      within(tipo).getByRole("radio", { name: new RegExp(windowTypeLabel("VASISTAS"), "i") }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    expect(screen.queryByLabelText(/chiusure supplementari/i)).toBeNull();
  });
});

describe("NuovaRichiestaClient — entrata maniglia", () => {
  const vai = () => {
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
  };

  it("non preseleziona nessuna entrata", () => {
    render(<NuovaRichiestaClient />);
    vai();
    const gruppo = screen.getByRole("group", { name: /entrata maniglia/i });
    const opzioni = within(gruppo).getAllByRole("radio") as HTMLInputElement[];
    expect(opzioni).toHaveLength(2);
    for (const o of opzioni) expect(o.checked).toBe(false);
  });

  it("blocca il passo finché non se ne sceglie una, con un messaggio italiano", () => {
    render(<NuovaRichiestaClient />);
    vai();
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.getByText("Scegli l'entrata maniglia (7,5 o 15 mm).")).toBeTruthy();
  });

  it("scelta l'entrata, il passo avanza", () => {
    render(<NuovaRichiestaClient />);
    vai();
    const gruppo = screen.getByRole("group", { name: /entrata maniglia/i });
    fireEvent.click(within(gruppo).getByRole("radio", { name: /7,5 mm/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.queryByText("Scegli l'entrata maniglia (7,5 o 15 mm).")).toBeNull();
    expect(screen.getByRole("button", { name: /genera kit/i })).toBeTruthy();
  });

  // Regola inviolabile «mobile-first», come già per materiale e geometria.
  it("entrata: griglia a una colonna sotto sm", () => {
    render(<NuovaRichiestaClient />);
    vai();
    const grid = screen.getByRole("group", { name: /entrata maniglia/i }).querySelector("div.grid");
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
  });
});

/**
 * Reset del materiale al cambio di tipologia. Provato sulla funzione e non sui
 * click perché via UI il ramo non è più raggiungibile: tutte le tipologie
 * selezionabili (ANTA_RIBALTA, VASISTAS) ammettono il solo LEGNO, quindi non
 * esiste una sequenza di click che porti a un materiale «non ammesso». La regola
 * resta però l'unica cosa che impedisce a un materiale di sopravvivere a un
 * cambio di tipologia che non lo prevede, e si riaccende appena un materiale
 * torna abilitato su una sola tipologia.
 */
describe("materialForWindowType", () => {
  it("conserva il materiale quando la tipologia lo ammette", () => {
    expect(materialForWindowType("ANTA_RIBALTA", "LEGNO")).toBe("LEGNO");
    expect(materialForWindowType("VASISTAS", "LEGNO")).toBe("LEGNO");
  });

  it("resetta a LEGNO un materiale che la tipologia non ammette", () => {
    expect(materialForWindowType("VASISTAS", "PVC")).toBe("LEGNO");
    expect(materialForWindowType("ANTA_RIBALTA", "ALLUMINIO")).toBe("LEGNO");
  });

  it("resetta a LEGNO anche per una tipologia senza materiali attivi (battente gated)", () => {
    expect(materialForWindowType("ANTA_BATTENTE", "PVC")).toBe("LEGNO");
  });
});
