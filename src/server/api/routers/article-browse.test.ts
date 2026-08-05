import { describe, it, expect } from "vitest";
import { searchInputSchema } from "./article";

/**
 * `article.search` aveva accolto anche lo sfoglio, per non duplicare tutto ciò
 * che sta dopo (`resolveStock`, `toSummary`, la data dell'import, la forma della
 * riga). Con le tendine lo sfoglio manda TUTTE le righe del gruppo in una volta,
 * quindi quella strada sarebbe rimasta come SECONDA definizione delle stesse
 * righe, libera di divergere da `browseSerie`. È stata smontata: qui resta la
 * sola ricerca testuale.
 */
describe("searchInputSchema", () => {
  it("accetta la sola query: è la ricerca di sempre", () => {
    expect(searchInputSchema.safeParse({ query: "lara" }).success).toBe(true);
  });

  it("RIFIUTA il tipo: lo sfoglio non passa più da qui", () => {
    // Con le tendine, `search({tipo})` sarebbe una SECONDA definizione di «le
    // righe di questo gruppo», libera di divergere da `browseSerie`. La
    // ricerca testuale è l'unico mestiere rimasto a questa procedura.
    expect(searchInputSchema.safeParse({ tipo: "MANIGLIONE" }).success).toBe(false);
  });

  it("RIFIUTA tipo e famiglia insieme", () => {
    expect(searchInputSchema.safeParse({ tipo: "LARA", famiglia: "CB71R" }).success).toBe(false);
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
