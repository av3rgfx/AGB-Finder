import "server-only";
import type { PrismaClient } from "@prisma/client";
import { KitGenerationError, kitInputSchema, type KitLine } from "./types";
import { resolveRuleModule } from "./registry";

export const ENGINE_VERSION = "1d.1";

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

    const lines = resolveRuleModule(template.rules).generate(input);

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
