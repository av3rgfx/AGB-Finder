import { describe, it, expect } from "vitest";
import { resolveRuleModule, RULE_MODULES } from "./registry";

describe("registry moduli regole", () => {
  it("risolve il puntatore ARTECH al modulo registrato", () => {
    const module_ = resolveRuleModule({ engine: "artech-ar-legno", version: 1 });
    expect(module_.engineId).toBe("artech-ar-legno");
  });

  it("engine non registrato → errore esplicito", () => {
    expect(() => resolveRuleModule({ engine: "eclipse-v9", version: 1 })).toThrow(/eclipse-v9/);
  });

  it("shape non-puntatore (regole JSON legacy) → errore, la fonte di verità è il codice", () => {
    expect(() => resolveRuleModule({ positions: [{ code: "X" }] })).toThrow(/puntatore/i);
  });

  it("ogni modulo registrato ha engineId coerente con la chiave", () => {
    for (const [key, module_] of Object.entries(RULE_MODULES)) expect(module_.engineId).toBe(key);
  });
});
