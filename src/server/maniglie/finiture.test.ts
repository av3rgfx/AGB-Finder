import { describe, it, expect } from "vitest";
import { FINITURE, FINITURE_PER_CODICE, finituraDiCodice } from "./finiture";

describe("finiture ufficiali COLOMBO", () => {
  it("sono trentuno, come la pagina 13 del catalogo", () => {
    expect(FINITURE).toHaveLength(31);
  });

  it("ogni finitura ha codice, nome e colore esadecimale", () => {
    for (const f of FINITURE) {
      expect(f.codice).toMatch(/^[A-Z0-9/]{2,5}$/);
      expect(f.nome.length).toBeGreaterThan(2);
      expect(f.colore).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("nessun codice ripetuto", () => {
    expect(new Set(FINITURE.map((f) => f.codice)).size).toBe(31);
  });

  it("legge la coda del codice articolo", () => {
    expect(finituraDiCodice("0CD41R-CM")).toBe("CM");
    expect(finituraDiCodice("0AC11RSMY-C12")).toBe("C12");
  });

  it("una coda che non è fra le 31 non è una finitura", () => {
    // `CR8` è un bicolore CROMO/CROMAT: esiste nel listino (33 codici) ma COLOMBO
    // non lo pubblica fra le finiture. Inventare una categoria sulle code non
    // riconosciute è esattamente ciò che la scheda misure vieta.
    expect(finituraDiCodice("0CD41R-CR8")).toBeNull();
  });

  it("un codice senza trattino non ha coda di finitura", () => {
    // 237 codici del listino vero sono così.
    expect(finituraDiCodice("CB22DKSMSXCR8")).toBeNull();
  });

  it("l'indice per codice ha una voce per finitura", () => {
    expect(FINITURE_PER_CODICE.get("OL")?.nome).toBe("Oroplus");
    expect(FINITURE_PER_CODICE.size).toBe(31);
  });
});
