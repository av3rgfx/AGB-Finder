import { describe, it, expect } from "vitest";
import { resolveRuleModule, RULE_MODULES } from "./registry";
import { TIPOLOGIE_CON_VARIANTI } from "./artech-varianti";

describe("registry moduli regole", () => {
  it("risolve il puntatore ARTECH al modulo registrato", () => {
    const module_ = resolveRuleModule({ engine: "artech-ar-legno", version: 1 });
    expect(module_.engineId).toBe("artech-ar-legno");
  });

  it("risolve il modulo vasistas legno", () => {
    const module_ = resolveRuleModule({ engine: "artech-vasistas-legno", version: 1 });
    expect(module_.engineId).toBe("artech-vasistas-legno");
  });

  it("engine non registrato → errore esplicito", () => {
    expect(() => resolveRuleModule({ engine: "eclipse-v9", version: 1 })).toThrow(/eclipse-v9/);
  });

  it("shape non-puntatore (regole JSON legacy) → errore, la fonte di verità è il codice", () => {
    expect(() => resolveRuleModule({ positions: [{ code: "X" }] })).toThrow(/puntatore/i);
  });

  it("puntatore con chiavi estranee → errore (ADR: nessuna regola sconfina nel DB)", () => {
    expect(() =>
      resolveRuleModule({ engine: "artech-ar-legno", version: 1, positions: [{ code: "X" }] }),
    ).toThrow(/puntatore/i);
  });

  it("ogni modulo registrato ha engineId coerente con la chiave", () => {
    for (const [key, module_] of Object.entries(RULE_MODULES)) expect(module_.engineId).toBe(key);
  });

  // Lega `TIPOLOGIE_CON_VARIANTI` (in `artech-varianti.ts`) alla realtà dei
  // moduli: la lista non è derivabile dal registro, perché `RuleModule` non
  // porta la tipologia. Se un modulo comincia — o smette — di dichiarare
  // varianti, questo test fallisce e indica la costante da aggiornare, invece di
  // lasciare la UI a offrire un passo vuoto (o a nasconderne uno che serve).
  it("solo il modulo anta-ribalta legno dichiara varianti", () => {
    const conVarianti = Object.values(RULE_MODULES)
      .filter((m) => m.varianti.length > 0)
      .map((m) => m.engineId);
    expect(conVarianti).toEqual(["artech-ar-legno"]);
    expect(TIPOLOGIE_CON_VARIANTI).toEqual(["ANTA_RIBALTA"]);
  });
});
