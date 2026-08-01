import { describe, it, expect } from "vitest";
import { componiVarianti, variantiSchema, VARIANTE_IDS } from "./varianti-schema";

describe("componiVarianti", () => {
  it("toglie le chiavi non scelte", () => {
    expect(componiVarianti({ squadraAngolare: "BASE", incontroRibalta: undefined })).toEqual({
      squadraAngolare: "BASE",
    });
  });

  // `false` si pota come `undefined`: per il piastrino — l'unica variante
  // booleana — lo standard è «nessun piastrino», che il motore legge da
  // `=== true`. `{ piastrinoAntieffrazione: false }` sarebbe uno standard
  // MATERIALIZZATO, cioè ciò che la potatura esiste per impedire alle altre.
  it("pota anche il false del piastrino", () => {
    expect(componiVarianti({ piastrinoAntieffrazione: false })).toBeUndefined();
  });

  it("un blocco vuoto è undefined, non {}", () => {
    expect(componiVarianti({})).toBeUndefined();
  });

  it("il blocco potato resta valido per lo schema", () => {
    const potato = componiVarianti({ squadraAngolare: "BASE", piastrinoAntieffrazione: false });
    expect(variantiSchema.safeParse(potato).success).toBe(true);
  });

  it("VARIANTE_IDS copre tutte le chiavi dello schema", () => {
    expect([...VARIANTE_IDS].sort()).toEqual(Object.keys(variantiSchema.shape).sort());
  });
});
