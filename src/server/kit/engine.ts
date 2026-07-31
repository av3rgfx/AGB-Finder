import "server-only";
import type { PrismaClient } from "@prisma/client";
import { KitGenerationError, kitInputSchema, type KitLine } from "./types";
import { resolveRuleModule } from "./registry";
import type { VarianteId } from "./varianti-schema";

/**
 * Versione del codice-regole, timbrata su ogni distinta (`kit_requests.engine_version`).
 *
 * `1d.2` (2026-07-30) segna il **cutover della geometria**: `geometry` + `seatConfig`
 * al posto dei quattro campi numerici liberi (aria/interasse/battuta/sede), con i
 * codici geometria-dipendenti presi dalla tabella `artech-geometrie.ts` invece dei
 * soli codici del pilota. Va incrementata QUI, in questo cambio, perché è la stessa
 * migrazione che promuove il valore a colonna interrogabile: il ricalcolo versionato
 * (Task 5) deve poter rispondere a «quali righe le ha prodotte il motore vecchio»,
 * e con la stessa stringa prima e dopo non potrebbe.
 *
 * Regola: si incrementa ogni volta che il codice-regole può emettere righe diverse
 * per lo stesso input.
 */
export const ENGINE_VERSION = "1d.2";

export interface PricedKitLine extends KitLine {
  productId: string | null;
  name: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface KitOutput {
  lines: PricedKitLine[];
  totalPrice: number;
  totalComponents: number;
  warnings: string[];
  templateId: string;
  engineVersion: string;
}

type KitDb = Pick<PrismaClient, "kitTemplate" | "product">;

/**
 * Pipeline deterministica: VALIDATE → SELECT TEMPLATE → APPLY RULES →
 * risoluzione prodotti/prezzi dal catalogo. MAI LLM. Nessun raw SQL.
 */
export class KitEngine {
  constructor(private readonly db: KitDb) {}

  async generate(rawInput: unknown): Promise<KitOutput> {
    const parsed = kitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new KitGenerationError(`Specifiche non valide — ${details}`);
    }
    const input = parsed.data;

    const template = await this.db.kitTemplate.findFirst({
      where: {
        isActive: true,
        windowType: input.windowType,
        series: input.series,
        OR: [{ material: null }, { material: input.material }],
      },
      orderBy: { priority: "desc" },
    });
    if (!template)
      throw new KitGenerationError(
        `Nessun template kit attivo per ${input.windowType} / ${input.series} / ${input.material}.`,
      );

    const module_ = resolveRuleModule(template.rules);

    // STRATO 1 della garanzia sulle varianti (spec §6). Una variante persistita
    // che il modulo non dichiara è un dato raccolto e mai letto: il difetto che
    // questo progetto ha già pagato quattro volte. Qui è un rifiuto, col nome
    // della variante — non un silenzio.
    const varianti = "variants" in input ? (input.variants ?? {}) : {};
    const nonDichiarate = Object.entries(varianti)
      .filter(([, v]) => v !== undefined)
      .map(([id]) => id)
      .filter((id) => !module_.varianti.includes(id as VarianteId));
    if (nonDichiarate.length > 0)
      throw new KitGenerationError(
        `Il modulo "${module_.engineId}" non gestisce le varianti: ${nonDichiarate.join(", ")}. ` +
          "La richiesta le porta ma nessuna riga di distinta le userebbe.",
        "kit.varianti",
      );

    const lines = module_.generate(input);

    const products = await this.db.product.findMany({
      where: { agbCode: { in: lines.map((line) => line.code) } },
      select: { id: true, agbCode: true, name: true, basePrice: true },
    });
    const byCode = new Map(products.map((p) => [p.agbCode, p]));

    const warnings: string[] = [];
    const priced: PricedKitLine[] = lines.map((line) => {
      const product = byCode.get(line.code);
      if (!product) {
        warnings.push(`Codice ${line.code} non a listino: verificare con AGB.`);
        return { ...line, productId: null, name: null, unitPrice: null, totalPrice: null };
      }
      const unitPrice = Number(product.basePrice);
      return {
        ...line,
        productId: product.id,
        name: product.name,
        unitPrice,
        totalPrice: unitPrice * line.quantity,
      };
    });

    return {
      lines: priced,
      totalPrice: priced.reduce((sum, line) => sum + (line.totalPrice ?? 0), 0),
      totalComponents: priced.length,
      warnings,
      templateId: template.id,
      engineVersion: ENGINE_VERSION,
    };
  }
}
