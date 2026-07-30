import { describe, it, expect } from "vitest";
import { kitInputSchema, asArtech, asTour, KitGenerationError } from "./types";

const valid = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "ALLUMINIO",
  geometry: "A12_I13_B20",
  entrata: "E15",
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

const validTour = {
  windowType: "BILICO",
  widthMm: 700,
  heightMm: 900,
  material: "LEGNO",
  finish: "MARRONE RAL 8019",
  series: "TOUR",
  tourSchema: 2,
};

describe("kitInputSchema", () => {
  it("accetta l'input della distinta golden", () => {
    expect(kitInputSchema.parse(valid)).toMatchObject({ widthMm: 550, heightMm: 1820 });
  });

  it("rifiuta serie non coperta", () => {
    expect(kitInputSchema.safeParse({ ...valid, series: "PLANA" }).success).toBe(false);
  });

  it("rifiuta dimensioni fuori 300-3000 e valori fuori dagli enum", () => {
    expect(kitInputSchema.safeParse({ ...valid, widthMm: 200 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, geometry: "A9_I11_B17" }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, seatConfig: "SEDE_22" }).success).toBe(false);
  });

  /**
   * Le 7 geometrie del listino 2026. Prima erano tre numeri liberi che ne
   * permettevano centinaia di inesistenti — e non permettevano l'interasse 8,5,
   * che in un `Int` non ci sta: i clienti che lo ordinano erano tutti rifiutati.
   */
  it("accetta tutte e 7 le geometrie, interasse 8,5 compreso", () => {
    for (const geometry of [
      "A4_I85_B15",
      "A4_I9_B18",
      "A4_I13_B18",
      "A12_I9_B18",
      "A12_I9_B20",
      "A12_I13_B18",
      "A12_I13_B20",
    ])
      expect(kitInputSchema.safeParse({ ...valid, geometry }).success, geometry).toBe(true);
  });

  /**
   * `SEDE_30` è *scrivibile* ma non *generabile*: chi ha quel serramento deve
   * arrivare al messaggio del motore, che gli dice cosa manca (l'incontro DSS
   * 13x30 non è a listino), invece di sbattere contro un errore di validazione
   * che non spiega niente. Il rifiuto è in `assertSeatConfigSupportata`.
   */
  it("seatConfig accetta SEDE_30 e vale STANDARD quando non è indicata", () => {
    expect(kitInputSchema.safeParse({ ...valid, seatConfig: "SEDE_30" }).success).toBe(true);
    const { seatConfig: _s, ...senza } = valid;
    expect(kitInputSchema.parse(senza)).toMatchObject({ seatConfig: "STANDARD" });
  });

  /**
   * L'agente dice che l'apertura è «quasi sempre a tirare»: il default evita di
   * chiedere ogni volta un dato che nessun modulo legge ancora (domanda 16).
   */
  it("openingDir vale TIRARE quando non è indicata", () => {
    const { openingDir: _o, ...senza } = valid;
    expect(kitInputSchema.parse(senza)).toMatchObject({ openingDir: "TIRARE" });
  });

  it("sashWeightKg è opzionale e non rompe gli input esistenti", () => {
    expect(kitInputSchema.safeParse(valid).success).toBe(true);
    expect(kitInputSchema.safeParse({ ...valid, sashWeightKg: 75 }).success).toBe(true);
  });

  it("sashWeightKg rifiuta valori fuori scala", () => {
    expect(kitInputSchema.safeParse({ ...valid, sashWeightKg: 0 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, sashWeightKg: 250 }).success).toBe(false);
  });

  it("il ramo ARTECH esige la geometria: senza, rifiuta", () => {
    const { geometry: _g, ...senzaGeometria } = valid;
    expect(kitInputSchema.safeParse(senzaGeometria).success).toBe(false);
  });

  it("il ramo ARTECH esige l'entrata: senza, rifiuta con un messaggio italiano", () => {
    const { entrata: _omessa, ...senzaEntrata } = valid;
    const result = kitInputSchema.safeParse(senzaEntrata);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toBe("Scegli l'entrata maniglia (7,5 o 15 mm).");
  });

  it("accetta entrambe le entrate pubblicate e rifiuta qualunque altra", () => {
    for (const entrata of ["E75", "E15"] as const)
      expect(kitInputSchema.safeParse({ ...valid, entrata }).success).toBe(true);
    expect(kitInputSchema.safeParse({ ...valid, entrata: "E0" }).success).toBe(false);
  });

  it("il ramo ARTECH non accetta le tipologie di un'altra serie", () => {
    expect(kitInputSchema.safeParse({ ...valid, windowType: "BILICO" }).success).toBe(false);
  });
});

describe("kitInputSchema — ramo TOUR", () => {
  it("accetta un bilico senza i campi geometria ARTECH", () => {
    expect(kitInputSchema.parse(validTour)).toMatchObject({ series: "TOUR", tourSchema: 2 });
  });

  it("esige tourSchema, e solo nell'intervallo 1-5", () => {
    const { tourSchema: _t, ...senza } = validTour;
    expect(kitInputSchema.safeParse(senza).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...validTour, tourSchema: 0 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...validTour, tourSchema: 6 }).success).toBe(false);
  });

  it("il bilico è l'unica tipologia della serie TOUR", () => {
    expect(kitInputSchema.safeParse({ ...validTour, windowType: "ANTA_RIBALTA" }).success).toBe(
      false,
    );
  });

  /**
   * È LA RAGIONE DELL'UNIONE, non un dettaglio. `kit.create` riversa nella riga
   * ogni campo dell'input parsato e `kit.generate` ricostruisce l'input del
   * motore RILEGGENDO quelle colonne: la riga a DB È l'input di ogni
   * rigenerazione. Se la geometria ARTECH sopravvivesse al parse di un bilico,
   * verrebbe persistita e poi ri-somministrata al modulo TOUR che la ignora —
   * cioè esattamente il bug «campi raccolti, validati e ignorati» della bonifica,
   * spostato dal motore alla persistenza.
   */
  it("scarta la geometria ARTECH da un input TOUR invece di persistirla", () => {
    const parsed = kitInputSchema.parse({
      ...validTour,
      geometry: "A12_I13_B20",
      seatConfig: "STANDARD",
      openingSide: "SINISTRA",
      openingDir: "TIRARE",
      supplementaryClosures: true,
    });
    expect(parsed).not.toHaveProperty("geometry");
    expect(parsed).not.toHaveProperty("seatConfig");
    expect(parsed).not.toHaveProperty("openingSide");
    expect(parsed).not.toHaveProperty("openingDir");
    expect(parsed).not.toHaveProperty("supplementaryClosures");
  });

  it("sashWeightKg resta disponibile al bilico (portata delle cerniere)", () => {
    expect(kitInputSchema.safeParse({ ...validTour, sashWeightKg: 180 }).success).toBe(true);
  });

  it("scarta l'entrata da un input TOUR invece di persistirla", () => {
    const parsed = kitInputSchema.parse({ ...validTour, entrata: "E15" });
    expect("entrata" in parsed).toBe(false);
  });
});

describe("restringimenti asArtech / asTour", () => {
  it("asArtech passa un input ARTECH e rifiuta un TOUR", () => {
    const artech = kitInputSchema.parse(valid);
    expect(asArtech(artech).geometry).toBe("A12_I13_B20");
    expect(() => asArtech(kitInputSchema.parse(validTour))).toThrow(KitGenerationError);
  });

  it("asTour passa un input TOUR e rifiuta un ARTECH", () => {
    const tour = kitInputSchema.parse(validTour);
    expect(asTour(tour).tourSchema).toBe(2);
    expect(() => asTour(kitInputSchema.parse(valid))).toThrow(KitGenerationError);
  });
});
