// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, act } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const createMutate = vi.fn();
const generateMutate = vi.fn();
const customerCreateMutate = vi.fn();
const ricalcolaMutate = vi.fn();

/**
 * Prezzi REALI del listino AGB 2026, letti dal catalogo importato (7.488
 * prodotti) e non inventati: è ciò che rende asseribile il Δ di 4,06 € della
 * squadra angolare, cioè il numero che la spec cita come ragione della feature.
 */
const PREZZI_CATALOGO: Record<string, { name: string; price: number }> = {
  // Squadre angolari — interasse 13 SX (geometria del golden)
  "A50902.36.02": { name: "Squadra angolare - Interasse 13 SX", price: 5.77 },
  "A50903.36.02": { name: "Squadra angolare per traverso in alluminio", price: 7.54 },
  "A50901.36.02": { name: "Squadra angolare con compensatore", price: 8.05 },
  "A50904.36.02": { name: "INTERASSE 13 SX", price: 9.83 },
  // Squadre angolari — interasse 8,5 SX (cliente MC): il listino ne pubblica DUE
  "A50902.22.02": { name: "Squadra angolare - Interasse 8,5 SX", price: 5.77 },
  "A50903.22.02": { name: "Squadra angolare per traverso in alluminio", price: 7.54 },
  // Squadre angolari — interasse 9 SX (aria 4 asse 9)
  "A50902.24.02": { name: "Squadra angolare - Interasse 9 SX", price: 5.77 },
  "A50903.24.02": { name: "Squadra angolare per traverso in alluminio", price: 7.54 },
  "A50901.24.02": { name: "Squadra angolare con compensatore", price: 8.05 },
  "A50904.24.02": { name: "INTERASSE 9 SX", price: 9.83 },
  // Movimento angolare
  "A50302.01.02": { name: "Per ante rettangolari", price: 6.66 },
  "A50302.02.02": { name: "Per ante rettangolari", price: 9.73 },
  // Incontri nottolino e ribalta — formato 9x18 (aria 12)
  "A51400.05.02": { name: "Aria 12", price: 0.81 },
  "A514SX.05.67": { name: "Antieffrazione - Aria 12 SX", price: 3.03 },
  "A514SX.05.68": { name: "Antieffrazione per acciaio SX", price: 3.03 },
  "A51400.05.70": { name: "Aria 12 SX", price: 2.54 },
  "A514SX.05.64": { name: "Aria 12 SX", price: 3.03 },
  "A514SX.05.65": { name: "Aria 12 SX", price: 3.03 },
  // Incontri — aria 4 asse 9 (MC, Peruzzi): le viti dritte non esistono
  "A514SX.01.02": { name: "Aria 4 SX", price: 0.81 },
  "A514SX.01.67": { name: "1) ACCIAIO SX", price: 3.03 },
  "A514SX.01.64": { name: "1) ACCIAIO SX", price: 3.03 },
  // Piastrino antieffrazione, per entrata
  "A20050.00.02": { name: "Piastrino antieffrazione 15", price: 2.69 },
  "A50194.00.01": { name: "Piastrino antieffrazione 7,5", price: 3.17 },
};

/**
 * La query dei prezzi, MUTABILE per test: «prezzo non a catalogo» è
 * un'affermazione sul listino AGB, e caricamento, errore e assenza sono tre
 * fatti diversi. Un mock fisso a `{ data }` non poteva provare che la UI non ne
 * spacci uno per un altro.
 */
type CatalogoQuery = {
  data?: Record<string, { name: string; price: number }>;
  isPending: boolean;
  isError: boolean;
};
const CATALOGO_PRONTO: CatalogoQuery = { data: PREZZI_CATALOGO, isPending: false, isError: false };
let catalogoQuery: CatalogoQuery = CATALOGO_PRONTO;

/**
 * La riga da cui il wizard si idrata in modalità modifica. È la forma che
 * restituisce `kit.get`: le COLONNE della richiesta, che è ciò che il motore
 * rilegge — non un input già pronto.
 */
const RIGA_EMESSA = {
  id: "k1",
  requestNumber: "KIT-2026-0007",
  status: "COMPLETED",
  supersededById: null,
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "LEGNO",
  finish: "ARGENTO",
  series: "ARTECH",
  sashWeightKg: null,
  geometry: "A12_I13_B20",
  entrata: "E15",
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  supplementaryClosures: true,
  tourSchema: null,
  notes: null,
  variants: null,
};

type KitGetQuery = { data?: Record<string, unknown>; isPending: boolean; isError: boolean };
let kitGetQuery: KitGetQuery = { data: undefined, isPending: false, isError: false };

vi.mock("@/trpc/react", () => ({
  api: {
    kit: {
      create: { useMutation: () => ({ mutateAsync: createMutate, isPending: false }) },
      generate: {
        useMutation: () => ({ mutateAsync: generateMutate, isPending: false, error: null }),
      },
      // Modalità modifica (2026-08-01): il wizard riaperto su ?da=<id> rilegge
      // la richiesta e, al conferma, chiama `ricalcola` invece di `create`.
      get: { useQuery: () => kitGetQuery },
      ricalcola: {
        useMutation: () => ({ mutateAsync: ricalcolaMutate, isPending: false, error: null }),
      },
    },
    // Il passo 1 monta ora il selettore cliente: senza queste voci il mock
    // fa esplodere ogni test del wizard, non solo quelli sul cliente.
    customer: {
      list: {
        useQuery: () => ({
          // Due clienti, e di proposito diversi: Fosca HA un profilo serramento,
          // Peruzzi no. Serve a provare che il blocco «Usa il profilo» e la riga
          // di divergenza compaiano solo quando c'è qualcosa da confrontare.
          data: [
            {
              id: "c1",
              companyName: "Fosca",
              discount: 42.5,
              kitGeometry: "A12_I13_B18",
              kitEntrata: "E15",
            },
            {
              id: "c2",
              companyName: "Peruzzi",
              discount: null,
              kitGeometry: null,
              kitEntrata: null,
            },
          ],
          isPending: false,
        }),
      },
      create: {
        useMutation: () => ({
          mutateAsync: customerCreateMutate,
          isPending: false,
          isError: false,
          error: null,
        }),
      },
    },
    // Passo «Componenti»: i prezzi delle opzioni NON sono cablati nella UI, li
    // legge il catalogo. Il mock restituisce la mappa intera — la procedura vera
    // filtra sui codici richiesti, e per i test conta solo il lookup per codice.
    // I valori sono quelli VERI del catalogo importato (7.488 prodotti), non
    // inventati: è ciò che rende asseribile il Δ di 4,06 € della squadra.
    product: { byCodes: { useQuery: () => catalogoQuery } },
    useUtils: () => ({ customer: { list: { invalidate: vi.fn() } } }),
  },
}));

import {
  NuovaRichiestaClient,
  materialForWindowType,
  variantiPerGeometria,
} from "./nuova-client";
import { statoAntieffrazione } from "@/components/kit/componenti-ribalta";
import { windowTypeLabel } from "@/lib/kit-labels";
import { GEOMETRIE, geometriaLabel, type ArtechGeometryId } from "@/server/kit/artech-geometrie";

afterEach(() => {
  cleanup();
  push.mockReset();
  createMutate.mockReset();
  generateMutate.mockReset();
  catalogoQuery = CATALOGO_PRONTO;
  ricalcolaMutate.mockReset();
  kitGetQuery = { data: undefined, isPending: false, isError: false };
});

/**
 * Sceglie una geometria al passo 3.
 *
 * Dal 2026-07-30 **nessuna è preselezionata**: prima lo era `A12_I13_B20`, la
 * geometria del cliente storico del golden, che ogni ordine si portava addosso.
 * Ogni percorso che arriva al riepilogo deve quindi passare di qui — ed è il
 * motivo per cui questo helper esiste invece di dieci blocchi ricopiati.
 */
function scegliGeometria(id: ArtechGeometryId = "A12_I13_B20") {
  fireEvent.click(
    within(screen.getByRole("group", { name: /geometria/i })).getByLabelText(geometriaLabel(id)),
  );
}

/**
 * Dal passo 3 al riepilogo. **Due** clic, non uno: dal 2026-07-31 la serie
 * ARTECH ha in mezzo il passo «Componenti» (il ramo TOUR resta a quattro passi
 * e non usa questo helper). Sta qui perché altrimenti l'inserimento del passo
 * avrebbe voluto lo stesso clic in più ricopiato in una dozzina di prove.
 */
function avantiAlRiepilogo() {
  fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 3 → 4 Componenti
  fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 4 → 5 Riepilogo
}

/** Il gruppo di radio «Squadra angolare» sta nella sezione «Altre varianti», chiusa. */
function apriAltreVarianti() {
  fireEvent.click(screen.getByRole("button", { name: /altre varianti/i }));
}

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

  // Fino al 2026-07-30 `ARTECH_DEFAULT` cablava `geometry: "A12_I13_B20"`, cioè
  // la geometria del cliente storico del golden: ogni nuovo ordine partiva con
  // la geometria di un ALTRO cliente. Sceglierla male non produce un errore —
  // i codici dell'altra combinazione esistono a listino, hanno un prezzo e non
  // danno warning — quindi il default non era una comodità, era un errore
  // silenzioso preconfezionato. Stesso trattamento già dato all'entrata.
  it("nessuna geometria è preselezionata, e senza sceglierla il passo non avanza", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3

    const geometria = screen.getByRole("group", { name: /geometria/i });
    const radio = within(geometria).getAllByRole("radio") as HTMLInputElement[];
    expect(radio).toHaveLength(Object.keys(GEOMETRIE).length);
    expect(radio.some((r) => r.checked)).toBe(false);

    // Si sceglie SOLO l'entrata: manca la geometria, il passo non deve avanzare.
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /15 mm/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.getByRole("group", { name: /geometria/i })).toBeTruthy();
    // «derivata» compare solo nel riepilogo (sede derivata): se c'è, siamo avanzati.
    expect(screen.queryByText(/derivata/i)).toBeNull();
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
    scegliGeometria();
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    avantiAlRiepilogo();
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
    scegliGeometria();
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    avantiAlRiepilogo();
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
    avantiAlRiepilogo();
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
    avantiAlRiepilogo();
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
    scegliGeometria();
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    avantiAlRiepilogo();
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
    scegliGeometria();
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
    // Cambiando tipologia si cambia RAMO dell'unione: la geometria scelta prima
    // non sopravvive, e va riscelta. È l'unica ammessa dal vasistas
    // (`GEOMETRIA_COPERTA`), la stessa del default di `scegliGeometria`.
    scegliGeometria();
    // 15 mm, non 7,5: I2 (revisione finale) disabilita l'entrata 7,5 sulla
    // VASISTAS (il motore la rifiuta), quindi non è più cliccabile qui.
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /15 mm/i,
      }),
    );
    avantiAlRiepilogo();
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
    // NON preselezionata: il default cablato è caduto il 2026-07-30. L'unica
    // geometria ammessa dal vasistas è **selezionabile**, non già selezionata —
    // asserire `checked === true` qui era codificare il difetto.
    expect((abilitate[0] as HTMLInputElement).checked).toBe(false);
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
    // La geometria si sceglie anche qui: dal 2026-07-30 non è preselezionata, e
    // senza di essa il passo 3 si ferma sul messaggio della GEOMETRIA — questo
    // blocco vuole invece esercitare quello dell'ENTRATA.
    scegliGeometria();
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
    // Il passo dopo è «Componenti» (dal 2026-07-31), non più il riepilogo.
    expect(screen.getByRole("group", { name: /sicurezza/i })).toBeTruthy();
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

// Il cliente e` l'unico campo del wizard che NON passa da `kitInputSchema`:
// viaggia accanto alle specifiche. Questi due test coprono il giro completo,
// perche` i test del CustomerPicker da soli non provano che il wizard lo
// inoltri davvero.
describe("NuovaRichiestaClient — il cliente", () => {
  it("sceglierlo lo fa arrivare a kit.create accanto alle specifiche", async () => {
    createMutate.mockResolvedValue({ id: "k1", requestNumber: "KIT-2026-0001" });
    generateMutate.mockResolvedValue({ totalComponents: 16 });
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /fosca/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
    scegliGeometria();
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    avantiAlRiepilogo();
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0]![0].customerId).toBe("c1");
  });

  it("senza cliente `customerId` non viene proprio inviato", async () => {
    createMutate.mockResolvedValue({ id: "k1", requestNumber: "KIT-2026-0001" });
    generateMutate.mockResolvedValue({ totalComponents: 16 });
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    scegliGeometria();
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    avantiAlRiepilogo();
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0]![0]).not.toHaveProperty("customerId");
  });

  it("il riepilogo mostra il cliente e il suo sconto all'italiana", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /fosca/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    scegliGeometria();
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /7,5 mm/i,
      }),
    );
    avantiAlRiepilogo();
    expect(screen.getByText(/Fosca · sconto 42,5%/)).toBeTruthy();
  });

  // PROFILO SERRAMENTO. Nulla è preselezionato: il profilo del cliente si
  // applica con un clic esplicito. È la sintesi del council — stessa ergonomia
  // della precompilazione, ma il riempimento resta un atto dell'agente.
  it("«Usa il profilo» riempie geometria ed entrata in un colpo", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /fosca/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3

    const geometria = screen.getByRole("group", { name: /geometria/i });
    const entrataGruppo = screen.getByRole("group", { name: /entrata maniglia/i });
    // Prima del clic: nulla scelto.
    expect(
      (within(geometria).getAllByRole("radio") as HTMLInputElement[]).some((r) => r.checked),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /usa il profilo/i }));

    expect(
      (within(geometria).getByLabelText(geometriaLabel("A12_I13_B18")) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (within(entrataGruppo).getByRole("radio", { name: /15 mm/i }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("senza profilo il blocco non compare affatto", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /peruzzi/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.queryByRole("button", { name: /usa il profilo/i })).toBeNull();
  });

  it("senza cliente il blocco non compare affatto", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.queryByRole("button", { name: /usa il profilo/i })).toBeNull();
  });

  /** Porta al riepilogo scegliendo cliente, geometria ed entrata. */
  function alRiepilogo(opts: { cliente?: RegExp; geometry: ArtechGeometryId; entrata: RegExp }) {
    render(<NuovaRichiestaClient />);
    if (opts.cliente !== undefined)
      fireEvent.click(screen.getByRole("button", { name: opts.cliente }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
    scegliGeometria(opts.geometry);
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: opts.entrata,
      }),
    );
    avantiAlRiepilogo();
  }

  // LA DIVERGENZA. Constata, non blocca: non sa quale delle due dichiarazioni
  // sia giusta — il profilo l'ha scritto lo stesso agente, a memoria. Ma e' il
  // primo rilevatore d'errore che il sistema possieda.
  it("il riepilogo segnala la divergenza dal profilo del cliente", () => {
    // Fosca ha profilo A12_I13_B18 / E15; l'agente sceglie A12_I13_B20 / 7,5.
    alRiepilogo({ cliente: /fosca/i, geometry: "A12_I13_B20", entrata: /7,5 mm/i });
    expect(screen.getByText(/diverso dal profilo di Fosca/i)).toBeTruthy();
    // Mostra i valori DEL PROFILO: sono cio' con cui confrontarsi.
    expect(screen.getByText(new RegExp(geometriaLabel("A12_I13_B18")))).toBeTruthy();
  });

  it("non segnala nulla se la scelta coincide col profilo", () => {
    alRiepilogo({ cliente: /fosca/i, geometry: "A12_I13_B18", entrata: /15 mm/i });
    expect(screen.queryByText(/diverso dal profilo/i)).toBeNull();
  });

  it("non segnala nulla se il cliente non ha profilo", () => {
    alRiepilogo({ cliente: /peruzzi/i, geometry: "A12_I13_B20", entrata: /7,5 mm/i });
    expect(screen.queryByText(/diverso dal profilo/i)).toBeNull();
  });

  it("non segnala nulla senza cliente", () => {
    alRiepilogo({ geometry: "A12_I13_B20", entrata: /7,5 mm/i });
    expect(screen.queryByText(/diverso dal profilo/i)).toBeNull();
  });
});

/**
 * IL PASSO «COMPONENTI» (2026-07-31).
 *
 * Chiude la classe di difetto che questo progetto ha già pagato sette volte: una
 * decisione che il motore prende da sé e non dichiara. Qui l'agente vede i codici
 * alternativi, il loro prezzo e la differenza, e sceglie.
 */
describe("NuovaRichiestaClient — passo «Componenti»", () => {
  /** Porta al passo 4 (Componenti) su ARTECH anta-ribalta. */
  function alPassoComponenti(
    geometry: ArtechGeometryId = "A12_I13_B20",
    entrata: RegExp = /15 mm/i,
  ) {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
    scegliGeometria(geometry);
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: entrata,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 3 → 4
  }

  /** Interruttore «Antieffrazione»: imposta tutte e tre le sotto-scelte insieme. */
  function accendiAntieffrazione() {
    fireEvent.click(
      within(screen.getByRole("group", { name: /sicurezza/i })).getByRole("radio", {
        name: /antieffrazione/i,
      }),
    );
  }

  it("il wizard ha cinque passi e il quarto è «Componenti»", () => {
    alPassoComponenti();
    // La striscia dei passi lo nomina…
    expect(screen.getByText("Componenti")).toBeTruthy();
    // …e ci siamo davvero sopra: la sicurezza è la prima cosa della schermata,
    // e il pulsante è ancora «Avanti», non «Genera kit».
    expect(screen.getByRole("group", { name: /sicurezza/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /genera kit/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 4 → 5
    expect(screen.getByRole("button", { name: /genera kit/i })).toBeTruthy();
  });

  // Il bilico non ha varianti: il suo modulo dichiara `varianti: []` e il motore
  // rifiuterebbe qualunque scelta. Il ramo TOUR resta a quattro passi.
  it("il bilico TOUR resta a quattro passi, senza «Componenti»", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(
      within(screen.getByRole("group", { name: /tipologia/i })).getByRole("radio", {
        name: new RegExp(windowTypeLabel("BILICO"), "i"),
      }),
    );
    expect(screen.queryByText("Componenti")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 3 → 4 riepilogo
    expect(screen.getByRole("button", { name: /genera kit/i })).toBeTruthy();
  });

  // Anche la vasistas è ARTECH — quindi il passo esiste — ma il suo modulo
  // dichiara `varianti: []`. Offrirle produrrebbe bozze che non genereranno mai,
  // lo stesso difetto della sede 30. Si dice perché, non si nasconde.
  it("VASISTAS: il passo non offre scelte, e ne dà la ragione", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(
      within(screen.getByRole("group", { name: /tipologia/i })).getByRole("radio", {
        name: new RegExp(windowTypeLabel("VASISTAS"), "i"),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
    scegliGeometria();
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /15 mm/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 3 → 4
    expect(screen.queryByRole("group", { name: /sicurezza/i })).toBeNull();
    expect(screen.getByText(/nessuna variante/i)).toBeTruthy();
  });

  // «Inesistente ≠ vietato» (spec §8): per l'interasse 8,5 il listino non
  // pubblica `A50901.22`/`A50904.22`. Non disabilitate: ASSENTI.
  it("per l'interasse 8,5 la squadra angolare mostra DUE opzioni, non quattro", () => {
    alPassoComponenti("A4_I85_B15");
    apriAltreVarianti();
    const squadra = screen.getByRole("group", { name: /squadra angolare/i });
    expect(within(squadra).getAllByRole("radio")).toHaveLength(2);
    expect(within(squadra).queryByText(/compensatore/i)).toBeNull();
    // …mentre la geometria del golden ne ha quattro.
    cleanup();
    alPassoComponenti("A12_I13_B20");
    apriAltreVarianti();
    expect(
      within(screen.getByRole("group", { name: /squadra angolare/i })).getAllByRole("radio"),
    ).toHaveLength(4);
  });

  // In aria 4 il listino pubblica solo le viti inclinate: la scelta
  // «inclinate o dritte» non si risponde una volta per tutte, si mostra dove
  // esiste. Per MC e Peruzzi le dritte non compaiono.
  it("in aria 4 le viti dritte non compaiono affatto", () => {
    alPassoComponenti("A4_I9_B18", /7,5 mm/i);
    fireEvent.click(screen.getByRole("button", { name: /le tre scelte/i }));
    const nottolino = screen.getByRole("group", { name: /incontri nottolino/i });
    expect(within(nottolino).getAllByRole("radio")).toHaveLength(2);
    expect(within(nottolino).queryByText(/dritte/i)).toBeNull();
  });

  /**
   * La nota sullo standard stava dentro OGNI `GruppoVarianti` e dentro la
   * fieldset Sicurezza: con i due pannelli aperti erano **sei copie** della
   * stessa frase di 86 caratteri, e a 375px un muro davanti proprio ai codici e
   * ai prezzi per cui la schermata esiste. Si dice una volta, in testa al passo;
   * nei gruppi resta il solo distintivo «standard».
   */
  it("la nota sullo standard è detta UNA volta sola, anche coi due pannelli aperti", () => {
    alPassoComponenti();
    const nota = /ciò che il programma ordina oggi/i;
    expect(screen.getAllByText(nota)).toHaveLength(1);
    apriAltreVarianti();
    fireEvent.click(screen.getByRole("button", { name: /le tre scelte/i }));
    // Cinque gruppi visibili + la fieldset Sicurezza: la frase resta una.
    expect(screen.getAllByText(nota)).toHaveLength(1);
    // …e il distintivo «standard» invece c'è in ognuno dei gruppi.
    expect(screen.getAllByText(/^standard$/i).length).toBeGreaterThan(1);
  });

  it("ogni opzione mostra il codice in mono, il prezzo e il Δ, all'italiana", () => {
    alPassoComponenti();
    apriAltreVarianti();
    const squadra = screen.getByRole("group", { name: /squadra angolare/i });
    // Lo standard di questa geometria: A50904.36.02, 9,83 €, distintivo «standard».
    const codice = within(squadra).getByText("A50904.36.02");
    expect(codice.className).toContain("font-mono");
    // Il nome A CATALOGO, non l'etichetta che diamo noi all'opzione: è ciò che
    // permette di verificare il codice senza uscire dalla schermata. TESTO, non
    // più un `title`: a touch — cioè proprio a 375px, dove vale la regola
    // mobile-first — e da tastiera un tooltip non esiste.
    expect(within(squadra).getByText("INTERASSE 13 SX")).toBeTruthy();
    expect(codice.getAttribute("title")).toBeNull();
    expect(within(squadra).getByText(/9,83/)).toBeTruthy();
    expect(within(squadra).getAllByText(/^standard$/i).length).toBeGreaterThan(0);
    // La base costa 4,06 € in meno: è il numero per cui esiste questa schermata.
    expect(within(squadra).getByText("A50902.36.02")).toBeTruthy();
    expect(within(squadra).getByText("−4,06 €")).toBeTruthy();
    // Mai il punto decimale in una UI italiana.
    expect(within(squadra).queryByText(/4\.06/)).toBeNull();
  });

  it("l'antieffrazione accende le tre scelte, e «Modifica» le rende indipendenti", () => {
    alPassoComponenti();
    accendiAntieffrazione();

    // «Cosa cambia»: tre voci, vecchio → nuovo, e il Δ di ciascuna. Agganciato
    // per `data-testid`: il blocco non è interattivo, e il `role="group"` che
    // c'era prima era semantica falsa messa lì per i test.
    const cambia = screen.getByTestId("cosa-cambia");
    expect(within(cambia).getByText("A50302.01.02")).toBeTruthy();
    expect(within(cambia).getByText("A50302.02.02")).toBeTruthy();
    expect(within(cambia).getByText("A51400.05.02")).toBeTruthy();
    expect(within(cambia).getByText("A514SX.05.67")).toBeTruthy();
    expect(within(cambia).getByText("A20050.00.02")).toBeTruthy();
    // 3,07 (movimento) + 2,22 (incontro) + 2,69 (piastrino) = 7,98 a pezzo.
    expect(within(cambia).getByText("+7,98 €")).toBeTruthy();

    // «Modifica» rivela le tre scelte separate: «ogni tanto capita di ordinare
    // solo un componente».
    expect(screen.queryByRole("group", { name: /movimento angolare/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /le tre scelte/i }));
    const movimento = screen.getByRole("group", { name: /movimento angolare/i });
    expect(
      (within(movimento).getByRole("radio", { name: /due nottolini/i }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(screen.getByRole("group", { name: /incontri nottolino/i })).toBeTruthy();
    expect(screen.getByRole("group", { name: /piastrino/i })).toBeTruthy();
  });

  // Lo stato dell'interruttore NON è salvato: si DERIVA dalle tre scelte
  // (spec §7). Una parola per uno stato che i dati non hanno non deve esistere.
  it("tolta una delle tre, l'interruttore dice «parziale», non «acceso»", () => {
    alPassoComponenti();
    accendiAntieffrazione();
    fireEvent.click(screen.getByRole("button", { name: /le tre scelte/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /movimento angolare/i })).getByRole("radio", {
        name: /un nottolino/i,
      }),
    );
    const sicurezza = screen.getByRole("group", { name: /sicurezza/i });
    expect(
      (within(sicurezza).getByRole("radio", { name: /antieffrazione/i }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (within(sicurezza).getByRole("radio", { name: /normale/i }) as HTMLInputElement).checked,
    ).toBe(false);
    expect(screen.getByText(/parziale — 2 di 3/i)).toBeTruthy();
  });

  it("«Normale» riporta tutte e tre allo standard, e la richiesta non porta varianti", async () => {
    createMutate.mockResolvedValue({ id: "kv2", requestNumber: "KIT-2026-0009" });
    generateMutate.mockResolvedValue({ totalComponents: 16 });
    alPassoComponenti();
    accendiAntieffrazione();
    fireEvent.click(
      within(screen.getByRole("group", { name: /sicurezza/i })).getByRole("radio", {
        name: /normale/i,
      }),
    );
    expect(statoAntieffrazione(undefined)).toBe("SPENTO");
    expect(screen.queryByTestId("cosa-cambia")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // → riepilogo
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(createMutate).toHaveBeenCalled());
    // NIENTE `{}`: il default vive nel registro, non nel dato persistito.
    expect(createMutate.mock.calls[0]![0].specs.variants).toBeUndefined();
  });

  // «Avviso, mai blocco» — il precedente dello sconto oltre soglia. La NB
  // stampata a p0435 (433) è nostra lettura: impedire un ordine i cui codici
  // esistono tutti sarebbe peggio del difetto che stiamo togliendo.
  it("avvisa PRIMA di generare sulla combinazione che il listino vieta, senza bloccare", () => {
    alPassoComponenti();
    fireEvent.click(screen.getByRole("button", { name: /le tre scelte/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /incontri nottolino/i })).getByRole("radio", {
        name: /antieffrazione, viti inclinate/i,
      }),
    );
    // La stessa frase che il motore persiste nei warning della distinta: cita la
    // pagina stampata, ed è l'unico testo a schermo che lo faccia.
    expect(screen.getByText(/p\. stampata 433/i)).toBeTruthy();
    // Non blocca: si va avanti lo stesso.
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.getByRole("button", { name: /genera kit/i })).toBeTruthy();
  });

  it("le varianti scelte arrivano a kit.create dentro le specifiche", async () => {
    createMutate.mockResolvedValue({ id: "kv1", requestNumber: "KIT-2026-0008" });
    generateMutate.mockResolvedValue({ totalComponents: 17 });
    alPassoComponenti();
    accendiAntieffrazione();
    apriAltreVarianti();
    fireEvent.click(
      within(screen.getByRole("group", { name: /squadra angolare/i })).getByRole("radio", {
        name: /^base$/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // → riepilogo
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/richieste/kv1"));
    expect(createMutate.mock.calls[0]![0].specs.variants).toEqual({
      squadraAngolare: "BASE",
      movimentoAngolare: "DUE_NOTTOLINI",
      incontroNottolino: "ANTIEFFRAZIONE_INCLINATE",
      piastrinoAntieffrazione: true,
    });
  });

  it("il riepilogo elenca le scelte per esteso, mai la sola parola «antieffrazione»", () => {
    alPassoComponenti();
    accendiAntieffrazione();
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // → riepilogo
    const valore = screen.getByText(/Movimento angolare: Due nottolini/i);
    expect(valore.textContent).toMatch(/Incontri nottolino: Antieffrazione, viti inclinate/i);
    expect(valore.textContent).toMatch(/Piastrino antieffrazione/i);
  });

  it("senza toccare nulla il riepilogo dice «standard» e la richiesta non porta varianti", async () => {
    createMutate.mockResolvedValue({ id: "kv3", requestNumber: "KIT-2026-0010" });
    generateMutate.mockResolvedValue({ totalComponents: 16 });
    alPassoComponenti();
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // → riepilogo
    expect(screen.getByText(/standard del programma/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(createMutate).toHaveBeenCalled());
    // IL GOLDEN NON SI MUOVE: nessuna variante, nessun codice diverso.
    expect(createMutate.mock.calls[0]![0].specs.variants).toBeUndefined();
  });

  // Il ritorno indietro (spec §8): la geometria si sceglie al passo 3, le
  // varianti al 4. Tornare indietro e cambiarla può lasciare nel form una
  // scelta che quella geometria non pubblica.
  it("cambiare geometria al passo 3 riporta al default una variante non più disponibile", async () => {
    createMutate.mockResolvedValue({ id: "kv4", requestNumber: "KIT-2026-0011" });
    generateMutate.mockResolvedValue({ totalComponents: 16 });
    alPassoComponenti("A12_I13_B20");
    apriAltreVarianti();
    fireEvent.click(
      within(screen.getByRole("group", { name: /squadra angolare/i })).getByRole("radio", {
        // «Con compensatore», non «Traverso alluminio + compensatore»: sono due
        // opzioni distinte e l'interasse 8,5 non pubblica né l'una né l'altra.
        name: /^con compensatore$/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /indietro/i })); // 4 → 3
    scegliGeometria("A4_I85_B15"); // l'interasse 8,5 non pubblica i compensatori
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 3 → 4
    apriAltreVarianti();
    const squadra = screen.getByRole("group", { name: /squadra angolare/i });
    const scelte = within(squadra).getAllByRole("radio") as HTMLInputElement[];
    expect(scelte).toHaveLength(2);
    // Torna allo standard di QUESTA geometria (BASE), non resta un fantasma.
    expect(
      (within(squadra).getByRole("radio", { name: /^base$/i }) as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // → riepilogo
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0]![0].specs.variants).toBeUndefined();
  });

  /**
   * L'altra metà del ritorno indietro, e la meno ovvia: una scelta può restare
   * DISPONIBILE sulla nuova geometria ed esserne lo STANDARD. `BASE` è fuori
   * standard su `A12_I13_B20` (quindi si persiste) ed è lo standard di
   * `A4_I85_B15`: la potatura che scartava solo l'assente la teneva, e finiva a
   * DB dove una richiesta identica creata da zero scrive `NULL`.
   */
  it("cambiare geometria scarta anche la scelta che sulla nuova È lo standard", async () => {
    createMutate.mockResolvedValue({ id: "kv5", requestNumber: "KIT-2026-0012" });
    generateMutate.mockResolvedValue({ totalComponents: 16 });
    alPassoComponenti("A12_I13_B20");
    apriAltreVarianti();
    fireEvent.click(
      within(screen.getByRole("group", { name: /squadra angolare/i })).getByRole("radio", {
        name: /^base$/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /indietro/i })); // 4 → 3
    scegliGeometria("A4_I85_B15"); // dove BASE È lo standard, e resta fra le opzioni
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 3 → 4

    // Le due affermazioni della schermata non si contraddicono più: la riga di
    // stato non dice «Modificate» di un'opzione che porta il distintivo «standard».
    expect(screen.getByText(/Squadra angolare e incontro ribalta: standard/i)).toBeTruthy();
    apriAltreVarianti();
    const squadra = screen.getByRole("group", { name: /squadra angolare/i });
    expect(
      (within(squadra).getByRole("radio", { name: /^base$/i }) as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // → riepilogo
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(createMutate).toHaveBeenCalled());
    // Il default vive nel REGISTRO: la riga a DB è identica a quella di una
    // richiesta creata da zero su questa geometria.
    expect(createMutate.mock.calls[0]![0].specs.variants).toBeUndefined();
  });

  /**
   * I TRE stati della query dei prezzi. «Non a catalogo» è un'affermazione sul
   * listino AGB — la stessa classe di segnale che ha smascherato due moduli con
   * codici inesistenti: dirla mentre la query carica (cioè sempre, al primo
   * render) o quando è fallita è affermare un fatto che non si conosce.
   */
  it("mentre i prezzi caricano non dice «non a catalogo», e non inventa Δ", () => {
    catalogoQuery = { isPending: true, isError: false };
    alPassoComponenti();
    accendiAntieffrazione();
    apriAltreVarianti();
    const squadra = String(screen.getByRole("group", { name: /squadra angolare/i }).textContent);
    expect(squadra).toMatch(/in caricamento/i);
    expect(squadra).not.toMatch(/non a catalogo/i);
    expect(squadra).not.toMatch(/€/);
    // Nemmeno il totale di «Cosa cambia» si spaccia per noto.
    const cambia = String(screen.getByTestId("cosa-cambia").textContent);
    expect(cambia).toMatch(/in caricamento/i);
    expect(cambia).not.toMatch(/€/);
    // Caricare non è un errore: nessun allarme.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("se la query fallisce lo dice, e non lo attribuisce al catalogo", () => {
    catalogoQuery = { isPending: false, isError: true };
    alPassoComponenti();
    // Distinguibile da un buco del listino: è rete o server.
    expect(String(screen.getByRole("alert").textContent)).toMatch(/rete o del server/i);
    apriAltreVarianti();
    const squadra = String(screen.getByRole("group", { name: /squadra angolare/i }).textContent);
    expect(squadra).toMatch(/non caricato/i);
    expect(squadra).not.toMatch(/non a catalogo/i);
    expect(squadra).not.toMatch(/€/);
  });

  it("codice davvero assente dal catalogo: solo allora dice «non a catalogo»", () => {
    catalogoQuery = { data: {}, isPending: false, isError: false };
    alPassoComponenti();
    apriAltreVarianti();
    const squadra = String(screen.getByRole("group", { name: /squadra angolare/i }).textContent);
    expect(squadra).toMatch(/non a catalogo/i);
    expect(squadra).not.toMatch(/in caricamento/i);
    // La risposta è arrivata: non c'è nessun problema di rete da segnalare.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  /**
   * L'eccezione ai tre stati: «Senza piastrino» non ha codice, quindi non ha un
   * prezzo che possa caricare o fallire — vale zero per COSTRUZIONE, e nessuna
   * risposta del catalogo lo cambierà. Farle dire «prezzo in caricamento…» è la
   * stessa affermazione infondata che i tre stati esistono per impedire, al
   * contrario: un fatto noto spacciato per ignoto.
   */
  it("«Senza piastrino» vale zero anche mentre la query è in volo: l'assenza di codice vince", () => {
    catalogoQuery = { isPending: true, isError: false };
    alPassoComponenti();
    fireEvent.click(screen.getByRole("button", { name: /le tre scelte/i }));
    const piastrino = screen.getByRole("group", { name: /piastrino antieffrazione/i });
    const hintDi = (nome: RegExp) => {
      const radio = within(piastrino).getByRole("radio", { name: nome });
      return String(document.getElementById(radio.getAttribute("aria-describedby")!)?.textContent);
    };
    expect(hintDi(/^senza piastrino$/i)).toMatch(/0,00\s*€/);
    expect(hintDi(/^senza piastrino$/i)).not.toMatch(/caricamento/i);
    // L'altra opzione un codice ce l'ha, e resta onesta sul proprio stato.
    expect(hintDi(/^con piastrino antieffrazione$/i)).toMatch(/in caricamento/i);
    expect(hintDi(/^con piastrino antieffrazione$/i)).not.toMatch(/€/);
  });

  /**
   * `isError` si LEGGE, non si deduce da «non pending»: l'errore è l'unico dei
   * tre stati che accusa qualcuno (la rete, il server). Dedurlo per esclusione
   * faceva comparire l'allarme su ogni stato futuro che non fosse né dati né
   * pending — questo è quello di una query inattiva o disabilitata.
   */
  it("una query senza dati che non ha fallito non accusa la rete", () => {
    catalogoQuery = { isPending: false, isError: false };
    alPassoComponenti();
    expect(screen.queryByRole("alert")).toBeNull();
    apriAltreVarianti();
    const squadra = String(screen.getByRole("group", { name: /squadra angolare/i }).textContent);
    expect(squadra).toMatch(/in caricamento/i);
    expect(squadra).not.toMatch(/non caricato/i);
    expect(squadra).not.toMatch(/non a catalogo/i);
  });

  // I due pannelli dichiarano `aria-expanded`: senza `aria-controls` non si sa
  // COSA espandano.
  it("i due toggle dichiarano il pannello che comandano", () => {
    alPassoComponenti();
    const treScelte = screen.getByRole("button", { name: /le tre scelte/i });
    const altre = screen.getByRole("button", { name: /altre varianti/i });
    expect(treScelte.getAttribute("aria-controls")).toBeTruthy();
    expect(altre.getAttribute("aria-controls")).toBeTruthy();
    expect(document.getElementById(treScelte.getAttribute("aria-controls")!)).toBeNull();
    fireEvent.click(treScelte);
    fireEvent.click(altre);
    expect(document.getElementById(treScelte.getAttribute("aria-controls")!)).toBeTruthy();
    expect(document.getElementById(altre.getAttribute("aria-controls")!)).toBeTruthy();
  });

  // Nasce da un DIVIETO stampato sul listino: è la stessa classe degli errori di
  // passo di questa schermata, che usano già `alert`.
  it("l'avviso sulla combinazione vietata è un alert", () => {
    alPassoComponenti();
    fireEvent.click(screen.getByRole("button", { name: /le tre scelte/i }));
    fireEvent.click(
      within(screen.getByRole("group", { name: /incontri nottolino/i })).getByRole("radio", {
        name: /antieffrazione, viti inclinate/i,
      }),
    );
    expect(String(screen.getByRole("alert").textContent)).toMatch(/p\. stampata 433/i);
  });

  // «Δ totale a pezzo» si contraddiceva, e la frase che lo chiariva si leggeva
  // dopo il numero, cioè dopo aver frainteso.
  it("il totale si chiama «Differenza per pezzo», con la spiegazione PRIMA del numero", () => {
    alPassoComponenti();
    accendiAntieffrazione();
    const cambia = String(screen.getByTestId("cosa-cambia").textContent);
    expect(cambia).toMatch(/Differenza per pezzo/);
    expect(cambia).not.toMatch(/totale a pezzo/i);
    // Le quantità in gioco sono DUE, e il movimento angolare mancava.
    expect(cambia).toMatch(/il movimento angolare è 2/i);
    expect(cambia.indexOf("le quantità li moltiplicano")).toBeLessThan(
      cambia.indexOf("Differenza per pezzo"),
    );
  });

  // Regola inviolabile «mobile-first», come per materiale, geometria ed entrata.
  it("le griglie delle opzioni sono a una colonna sotto sm", () => {
    alPassoComponenti();
    apriAltreVarianti();
    for (const nome of [/sicurezza/i, /squadra angolare/i]) {
      const grid = screen.getByRole("group", { name: nome }).querySelector("div.grid");
      expect(grid?.className).toContain("grid-cols-1");
      expect(grid?.className).toContain("sm:grid-cols-2");
    }
  });
});

/**
 * Lo stato dell'interruttore antieffrazione NON è salvato: si deriva dalle tre
 * scelte (spec §7). Se lo fosse, i due dati potrebbero contraddirsi alla
 * rigenerazione — la classe di difetto che questa feature esiste per chiudere.
 */
describe("statoAntieffrazione", () => {
  it("nessuna variante → SPENTO", () => {
    expect(statoAntieffrazione(undefined)).toBe("SPENTO");
    expect(statoAntieffrazione({})).toBe("SPENTO");
  });

  it("tutte e tre → ACCESO", () => {
    expect(
      statoAntieffrazione({
        movimentoAngolare: "DUE_NOTTOLINI",
        incontroNottolino: "ANTIEFFRAZIONE_DRITTE",
        piastrinoAntieffrazione: true,
      }),
    ).toBe("ACCESO");
  });

  it("due su tre → PARZIALE", () => {
    expect(
      statoAntieffrazione({
        movimentoAngolare: "DUE_NOTTOLINI",
        piastrinoAntieffrazione: true,
      }),
    ).toBe("PARZIALE");
  });

  it("le varianti che non sono sicurezza non lo accendono", () => {
    expect(statoAntieffrazione({ squadraAngolare: "BASE", incontroRibalta: "ZAMA" })).toBe(
      "SPENTO",
    );
    // Standard espliciti: sono lo standard, non l'antieffrazione.
    expect(
      statoAntieffrazione({ movimentoAngolare: "UN_NOTTOLINO", incontroNottolino: "NORMALE" }),
    ).toBe("SPENTO");
  });
});

/**
 * Il reset al cambio di geometria usa le STESSE `opzioni*` del registro che
 * costruiscono le radio: una seconda lista scritta a mano si disallineerebbe
 * dalle tabelle, ed è esattamente il difetto che il registro esiste per chiudere.
 */
describe("variantiPerGeometria", () => {
  it("senza varianti non inventa nulla", () => {
    expect(variantiPerGeometria("A4_I85_B15", undefined)).toBeUndefined();
  });

  it("conserva le scelte che la geometria pubblica", () => {
    const v = { squadraAngolare: "COMPENSATORE" } as const;
    expect(variantiPerGeometria("A12_I13_B20", v)).toEqual(v);
  });

  it("scarta la squadra che l'interasse 8,5 non pubblica, e resta senza varianti", () => {
    expect(variantiPerGeometria("A4_I85_B15", { squadraAngolare: "COMPENSATORE" })).toBeUndefined();
  });

  // La potatura meno ovvia: DISPONIBILE non basta, perché sulla nuova geometria
  // può essere lo STANDARD — e uno standard materializzato nel dato non
  // seguirebbe più un cambio di default.
  it("scarta la scelta che sulla NUOVA geometria è lo standard", () => {
    // BASE è fuori standard su A12_I13_B20…
    expect(variantiPerGeometria("A12_I13_B20", { squadraAngolare: "BASE" })).toEqual({
      squadraAngolare: "BASE",
    });
    // …ed è lo standard di A4_I85_B15, dove pure resta fra le due opzioni.
    expect(variantiPerGeometria("A4_I85_B15", { squadraAngolare: "BASE" })).toBeUndefined();
  });

  it("non materializza nemmeno gli standard che non dipendono dalla geometria", () => {
    expect(
      variantiPerGeometria("A12_I13_B20", {
        movimentoAngolare: "UN_NOTTOLINO",
        incontroNottolino: "NORMALE",
        incontroRibalta: "ZAMA",
      }),
    ).toBeUndefined();
  });

  /**
   * L'asimmetria che restava: la potatura toglieva `undefined` ma non `false`.
   * Per il piastrino — l'unica variante booleana — lo standard è «nessun
   * piastrino», che il motore legge da `=== true`: `false` sarebbe quindi uno
   * standard MATERIALIZZATO, cioè ciò che questa potatura esiste per impedire
   * alle altre quattro. La UI non lo produce (spegnere scrive `undefined`), ma
   * `kit.create` accetta il blocco dal client.
   */
  it("scarta il piastrino «false»: è lo standard materializzato, come per le altre quattro", () => {
    expect(variantiPerGeometria("A12_I13_B20", { piastrinoAntieffrazione: false })).toBeUndefined();
    // E non si porta via il resto del blocco.
    expect(
      variantiPerGeometria("A12_I13_B20", {
        piastrinoAntieffrazione: false,
        movimentoAngolare: "DUE_NOTTOLINI",
      }),
    ).toEqual({ movimentoAngolare: "DUE_NOTTOLINI" });
  });

  it("scarta solo ciò che non esiste, non il resto del blocco", () => {
    expect(
      variantiPerGeometria("A4_I9_B18", {
        // Le viti dritte non esistono in aria 4…
        incontroNottolino: "ANTIEFFRAZIONE_DRITTE",
        // …e per l'asse 9 l'incontro ribalta non è nemmeno una scelta (una sola
        // voce a listino: `opzioniIncontroRibalta` restituisce []).
        incontroRibalta: "ACCIAIO_INCLINATE",
        // Questi due non dipendono dalla geometria: restano.
        movimentoAngolare: "DUE_NOTTOLINI",
        piastrinoAntieffrazione: true,
      }),
    ).toEqual({ movimentoAngolare: "DUE_NOTTOLINI", piastrinoAntieffrazione: true });
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Modalità MODIFICA (2026-08-01). Il wizard si riapre su `?da=<id>` per cambiare
// le sole varianti: geometria, entrata e quote sono congelate, perché cambiarle
// vuol dire un altro serramento — quindi una richiesta nuova.
// ─────────────────────────────────────────────────────────────────────────────
describe("wizard in modalità modifica", () => {
  const conRiga = (patch: Record<string, unknown> = {}) => {
    kitGetQuery = { data: { ...RIGA_EMESSA, ...patch }, isPending: false, isError: false };
  };

  it("idrata dalla richiesta e mostra le specifiche congelate", () => {
    conRiga();
    render(<NuovaRichiestaClient daId="k1" />);
    const testo = document.body.textContent ?? "";
    expect(testo.includes(geometriaLabel("A12_I13_B20"))).toBe(true);
    expect(testo.includes("KIT-2026-0007")).toBe(true);
    // La via d'uscita è SCRITTA, non lasciata indovinare: un campo assente
    // senza spiegazione è un ticket al supporto.
    expect(/richiesta nuova/i.test(testo)).toBe(true);
  });

  it("la geometria non è più una scelta: nessuna radio", () => {
    conRiga();
    render(<NuovaRichiestaClient daId="k1" />);
    expect(screen.queryByRole("group", { name: /geometria/i })).toBeNull();
  });

  it("il passo «Componenti» è quello di partenza, con le sue scelte", () => {
    conRiga();
    render(<NuovaRichiestaClient daId="k1" />);
    expect(screen.getByRole("radio", { name: /^Antieffrazione$/i })).toBeTruthy();
  });

  // Se `ricalcola` partisse all'apertura, chi cambia idea e chiude la scheda
  // lascerebbe la vecchia richiesta superata e congelata, puntando a una bozza
  // vuota.
  it("aprire la modifica non chiama ricalcola", () => {
    conRiga();
    render(<NuovaRichiestaClient daId="k1" />);
    expect(ricalcolaMutate).not.toHaveBeenCalled();
  });

  it("il conferma chiama ricalcola con le varianti scelte, non create", async () => {
    conRiga();
    ricalcolaMutate.mockResolvedValue({ id: "k2", requestNumber: "KIT-2026-0012" });
    generateMutate.mockResolvedValue({});
    render(<NuovaRichiestaClient daId="k1" />);

    fireEvent.click(screen.getByRole("radio", { name: /^Antieffrazione$/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /genera nuova versione/i }));

    await vi.waitFor(() => expect(ricalcolaMutate).toHaveBeenCalled());
    const arg = ricalcolaMutate.mock.calls[0]![0];
    expect(arg.kitRequestId).toBe("k1");
    expect(arg.variants.piastrinoAntieffrazione).toBe(true);
    // Modificare NON è creare: la richiesta nuova nasce come VERSIONE.
    expect(createMutate).not.toHaveBeenCalled();
  });

  // Il reset è ciò che rende l'operazione reversibile: senza, si può accendere
  // l'antieffrazione e mai più spegnerla.
  it("senza varianti scelte manda {}, cioè il reset esplicito allo standard", async () => {
    conRiga({ variants: { piastrinoAntieffrazione: true } });
    ricalcolaMutate.mockResolvedValue({ id: "k2", requestNumber: "KIT-2026-0012" });
    generateMutate.mockResolvedValue({});
    render(<NuovaRichiestaClient daId="k1" />);

    // Ristretta alla fieldset «Sicurezza»: «Normale» è anche il nome di
    // un'opzione dell'incontro nottolino, e il pannello «Altre varianti» si apre
    // da sé quando la richiesta parte già fuori standard.
    fireEvent.click(
      within(screen.getByRole("group", { name: /sicurezza/i })).getByRole("radio", {
        name: /normale/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /genera nuova versione/i }));

    await vi.waitFor(() => expect(ricalcolaMutate).toHaveBeenCalled());
    expect(ricalcolaMutate.mock.calls[0]![0].variants).toEqual({});
  });

  it("una riga che il motore non sa rileggere mostra il rifiuto, senza conferma", () => {
    // `geometry: null` è una riga scritta prima del cutover della geometria:
    // `kitInputFromRequest` la rifiuta, e nessuno può indovinarla.
    conRiga({ geometry: null });
    render(<NuovaRichiestaClient daId="k1" />);
    expect(screen.getByRole("alert").textContent).toMatch(/incoerente/i);
    expect(screen.queryByRole("button", { name: /genera nuova versione/i })).toBeNull();
  });

  // Il riepilogo dice «Cliente: Nessuno» quando `cliente` è null. In modifica
  // lo stato non si popolerebbe da sé, e la frase sarebbe FALSA: `ricalcola` fa
  // ereditare customerId e discountPercent alla nuova versione. Uno schermo che
  // contraddice ciò che il programma fa, proprio prima del conferma.
  it("in modifica il riepilogo nomina il cliente della richiesta, non «Nessuno»", () => {
    kitGetQuery = {
      data: {
        ...RIGA_EMESSA,
        customer: { id: "c1", companyName: "Fosca" },
        discountPercent: 42.5,
      },
      isPending: false,
      isError: false,
    };
    render(<NuovaRichiestaClient daId="k1" />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    const testo = document.body.textContent ?? "";
    expect(testo.includes("Fosca")).toBe(true);
    expect(/Cliente[\s\S]{0,20}Nessuno/.test(testo)).toBe(false);
  });

  // Lo sconto mostrato è quello TIMBRATO sulla richiesta, non quello corrente
  // dell'anagrafica: è ciò che la nuova versione eredita davvero.
  it("in modifica mostra lo sconto timbrato sulla richiesta", () => {
    kitGetQuery = {
      data: {
        ...RIGA_EMESSA,
        customer: { id: "c1", companyName: "Fosca" },
        discountPercent: 30,
      },
      isPending: false,
      isError: false,
    };
    render(<NuovaRichiestaClient daId="k1" />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    // 30% timbrato, NON il 42,5% che l'anagrafica mockata dà a Fosca.
    expect(document.body.textContent).toMatch(/30\s*%/);
    expect(document.body.textContent).not.toMatch(/42,5\s*%/);
  });

  // IL DIFETTO PIÙ GRAVE trovato in review, e non è ipotetico: `kit.get`
  // restituisce campi `Date` (createdAt/updatedAt/generatedAt) e lo structural
  // sharing di react-query NON regge sulle Date — con due payload IDENTICI che
  // ne contengono una, `replaceEqualDeep` restituisce un oggetto NUOVO
  // (verificato eseguendolo). Il QueryClient è `new QueryClient()` nudo, quindi
  // `staleTime: 0` e `refetchOnWindowFocus: true`: basta cambiare finestra e
  // tornare perché il refetch produca un riferimento nuovo. Se l'idratazione
  // riscrivesse il form a ogni cambio di riferimento, le scelte appena fatte
  // sparirebbero IN SILENZIO — e «Genera nuova versione» emetterebbe una
  // versione identica alla precedente, consumando un numero e congelando
  // l'originale per niente.
  it("un refetch con dati identici NON azzera le varianti appena scelte", () => {
    const dati = () => ({
      ...RIGA_EMESSA,
      createdAt: new Date("2026-08-01T00:00:00Z"),
      updatedAt: new Date("2026-08-01T00:00:00Z"),
    });
    kitGetQuery = { data: dati(), isPending: false, isError: false };
    const { rerender } = render(<NuovaRichiestaClient daId="k1" />);

    const anti = () =>
      within(screen.getByRole("group", { name: /sicurezza/i })).getByRole("radio", {
        name: /antieffrazione/i,
      }) as HTMLInputElement;
    fireEvent.click(anti());
    expect(anti().checked).toBe(true);

    // Il refetch: stesso contenuto, oggetto NUOVO — ciò che react-query
    // consegna davvero quando il payload contiene una Date.
    act(() => {
      kitGetQuery = { data: dati(), isPending: false, isError: false };
    });
    rerender(<NuovaRichiestaClient daId="k1" />);

    expect(anti().checked).toBe(true);
  });

  it("senza `daId` resta il wizard di creazione, e non entra in modalità modifica", () => {
    render(<NuovaRichiestaClient />);
    expect(screen.getByRole("button", { name: /avanti/i })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/KIT-2026-0007/);
  });
});
