import "server-only";
import type { PrismaClient } from "@prisma/client";

export const CHAT_PRODUCT_SELECT = {
  id: true,
  agbCode: true,
  name: true,
  shortDescription: true,
  basePrice: true,
  priceUnit: true,
  listinoPage: true,
} as const;

export interface ChatProductSummary {
  id: string;
  agbCode: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  priceUnit: string;
  listinoPage: number | null;
}

/** Risolve i prodotti citati in un turno di chat (referencedProductIds) per la UI. */
export async function resolveChatProducts(
  db: Pick<PrismaClient, "product">,
  ids: string[],
): Promise<ChatProductSummary[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({ where: { id: { in: ids } }, select: CHAT_PRODUCT_SELECT });
  return rows.map((p) => ({ ...p, basePrice: Number(p.basePrice) }));
}
