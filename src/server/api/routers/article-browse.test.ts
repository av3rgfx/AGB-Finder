import { describe, it, expect } from "vitest";
import { searchInputSchema } from "./article";

/**
 * `article.search` serviva una sola strada: si digita, si cerca. Con lo sfoglio
 * ne serve una seconda — si sceglie un gruppo, e non si digita niente — e le due
 * condividono tutto ciò che sta dopo: `resolveStock`, `toSummary`, la data
 * dell'import, la forma della riga a schermo. Un secondo endpoint le avrebbe
 * duplicate; un input che accetta l'una O l'altra no.
 */
describe("searchInputSchema", () => {
  it("accetta la sola query: è la ricerca di sempre", () => {
    expect(searchInputSchema.safeParse({ query: "lara" }).success).toBe(true);
  });

  it("accetta il solo tipo: è lo sfoglio", () => {
    expect(searchInputSchema.safeParse({ tipo: "MANIGLIONE" }).success).toBe(true);
  });

  it("accetta tipo e famiglia insieme: è il terzo livello", () => {
    expect(searchInputSchema.safeParse({ tipo: "LARA", famiglia: "CB71R" }).success).toBe(true);
  });

  it("RIFIUTA una richiesta senza né query né tipo", () => {
    // Sarebbe «dammi tutto»: 3.456 righe, e la pagina non ha modo di dire
    // all'agente di quale insieme stia guardando venti elementi.
    expect(searchInputSchema.safeParse({}).success).toBe(false);
  });

  it("RIFIUTA una famiglia senza il suo tipo", () => {
    // La famiglia è definita DENTRO un gruppo: `CB71R` da sola non individua
    // nulla, e la regola che scarta la famiglia degenere ha bisogno della parola
    // del gruppo per funzionare.
    expect(searchInputSchema.safeParse({ famiglia: "CB71R" }).success).toBe(false);
  });

  it("rifiuta una query di soli spazi invece di trattarla come una ricerca", () => {
    expect(searchInputSchema.safeParse({ query: "   " }).success).toBe(false);
  });

  it("ha i valori di default di sempre per marca, limite e offset", () => {
    const parsed = searchInputSchema.parse({ query: "lara" });
    expect(parsed).toMatchObject({ brand: "COLOMBO", limit: 20, offset: 0 });
  });

  it("non accetta un limite oltre 50: la pagina è una pagina", () => {
    expect(searchInputSchema.safeParse({ query: "lara", limit: 500 }).success).toBe(false);
  });
});
