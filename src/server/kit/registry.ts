import { z } from "zod";
import { KitGenerationError, type RuleModule } from "./types";
import { artechAntaRibaltaLegno } from "./rules-artech-legno";
import { artechAntaRibaltaPvc } from "./rules-artech-pvc";
import { artechAntaRibaltaAlu } from "./rules-artech-alu";

/**
 * KitTemplate.rules a DB è SOLO un puntatore versionato al modulo regole in
 * codice (ADR 2026-07-04). Qualsiasi altra shape è un errore: la fonte di
 * verità delle regole è git, mai il DB.
 */
export const templateRulesSchema = z
  .object({
    engine: z.string().min(1),
    version: z.number().int().min(1),
  })
  .strict();

export const RULE_MODULES: Record<string, RuleModule> = {
  [artechAntaRibaltaLegno.engineId]: artechAntaRibaltaLegno,
  [artechAntaRibaltaPvc.engineId]: artechAntaRibaltaPvc,
  [artechAntaRibaltaAlu.engineId]: artechAntaRibaltaAlu,
};

export function resolveRuleModule(rules: unknown): RuleModule {
  const parsed = templateRulesSchema.safeParse(rules);
  if (!parsed.success)
    throw new KitGenerationError(
      "Template kit non valido: rules deve essere il puntatore {engine, version}.",
    );
  const module_ = RULE_MODULES[parsed.data.engine];
  if (!module_)
    throw new KitGenerationError(
      `Nessun modulo regole registrato per engine "${parsed.data.engine}".`,
    );
  return module_;
}
