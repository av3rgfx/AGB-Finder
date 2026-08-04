import type { PrismaClient } from "@prisma/client";

/**
 * «In pronta consegna» è DERIVATO, mai salvato: l'articolo compare in una
 * `StockLine` dell'ultimo import non annullato per quella marca.
 *
 * Un solo posto in cui la verità è scritta, e nessun aggiornamento di massa a
 * ogni caricamento. È l'opposto di `Product.isAvailable`, che era un flag deciso
 * dal programma e ha mentito su 7.488 prodotti fino al passo 0.
 *
 * Tutto Prisma: qui vive la REGOLA di business, e non deve finire in un raw SQL.
 */

export interface CurrentStockImport {
  id: string;
  importedAt: Date;
}

/**
 * L'import che vale oggi. `null` = nessuna pronta consegna caricata per quella
 * marca: allora non si dice «da ordinare» (che sarebbe un'affermazione), si dice
 * che il dato non c'è.
 */
export async function currentStockImport(
  db: PrismaClient,
  brand: string,
): Promise<CurrentStockImport | null> {
  return db.stockImport.findFirst({
    where: { brand, cancelledAt: null },
    orderBy: { importedAt: "desc" },
    select: { id: true, importedAt: true },
  });
}

/**
 * TUTTI gli articoli in pronta consegna secondo quell'import.
 *
 * L'eccezione dichiarata al «si interroga per sottoinsieme» qui sotto: serve al
 * filtro «solo pronta consegna», che deve restringere un raggruppamento
 * sull'INTERO listino e non su una pagina di venti righe. Il costo è quello che
 * è misurato, non quello che si teme: sul file vero di Andrea sono **178
 * articoli su 3.456**, cioè il 5,2% — la lista che esce di qui è corta per
 * costruzione, perché è corta la pronta consegna.
 *
 * Resta Prisma, ed è il punto: la REGOLA («in pronta consegna» = riga
 * dell'ultimo import non annullato) non entra in un `$queryRaw`. Al raw SQL del
 * raggruppamento arriva solo una lista di id già decisa qui.
 */
export async function allAvailableArticleIds(
  db: PrismaClient,
  importId: string,
): Promise<string[]> {
  const lines = await db.stockLine.findMany({
    where: { importId, articleId: { not: null } },
    select: { articleId: true },
  });
  return lines.map((l) => l.articleId!).filter(Boolean);
}

/**
 * Fra gli articoli dati, quali sono in pronta consegna secondo quell'import.
 * Si interroga per sottoinsieme e non per intero listino: la pagina mostra 20
 * righe, non 3.456.
 */
export async function availableArticleIds(
  db: PrismaClient,
  importId: string,
  articleIds: string[],
): Promise<Set<string>> {
  if (articleIds.length === 0) return new Set();
  const lines = await db.stockLine.findMany({
    where: { importId, articleId: { in: articleIds } },
    select: { articleId: true },
  });
  const ids = new Set<string>();
  for (const l of lines) if (l.articleId) ids.add(l.articleId);
  return ids;
}
