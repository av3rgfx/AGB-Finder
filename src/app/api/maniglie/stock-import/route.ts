import { headers } from "next/headers";
import * as XLSX from "xlsx";
import { auth } from "@/server/auth/config";
import { db } from "@/server/db";
import { extractStockCodes, matchStockCodes, diffStock } from "@/server/maniglie/stock-file";
import { currentStockImport } from "@/server/maniglie/stock-status";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ANTEPRIMA di un import di pronta consegna. NON scrive nulla.
 *
 * Route handler invece di tRPC: è l'unica deroga ammessa alla regola «tutte le
 * API via tRPC», per la stessa ragione dello streaming SSE — un upload multipart
 * non è esprimibile su `httpBatchLink`. La SCRITTURA resta in tRPC
 * (`article.confirmStockImport`), quindi la deroga copre solo la lettura del file.
 *
 * Il riepilogo prima della conferma non è un vezzo: è ciò che impedisce di
 * pubblicare a dieci agenti il file della marca sbagliata, ed è esattamente ciò
 * che Andrea ha chiesto («ogni volta che viene importato un file con codici
 * inesistenti, devono essere ignorati, magari con un avviso prima di importare»).
 */

const MAX_BYTES = 2 * 1024 * 1024; // il file vero pesa 35 KB

export async function POST(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  // Il ruolo si verifica QUI: fuori da tRPC non c'è `adminProcedure` a farlo.
  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Riservato agli amministratori" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const file = form.get("file");
  const brand = String(form.get("brand") ?? "COLOMBO")
    .trim()
    .toUpperCase();
  if (!(file instanceof File)) {
    return Response.json({ error: "Nessun file caricato" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "Il file è vuoto" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Il file supera i 2 MB: non sembra un elenco di codici" },
      { status: 413 },
    );
  }

  let rawCodes: string[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return Response.json({ error: "Il file non contiene fogli" }, { status: 400 });
    }
    // Si legge SOLO la prima colonna, ignorando fogli successivi, formule e
    // tutto il resto: meno superficie letta, meno modi di sbagliare.
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, {
      header: 1,
      raw: true,
      blankrows: false,
    });
    rawCodes = extractStockCodes(rows);
  } catch {
    return Response.json(
      { error: "File non leggibile: atteso un foglio di calcolo .xls" },
      { status: 400 },
    );
  }

  if (rawCodes.length === 0) {
    return Response.json(
      { error: "Nessun codice trovato nella prima colonna del file" },
      { status: 400 },
    );
  }

  const articles = await db.article.findMany({
    where: { brand },
    select: { id: true, codeNorm: true },
  });
  const byNorm = new Map(articles.map((a) => [a.codeNorm, a.id]));
  const match = matchStockCodes(rawCodes, byNorm);

  const previous = await currentStockImport(db, brand);
  const previousCodes = previous
    ? (
        await db.stockLine.findMany({
          where: { importId: previous.id },
          select: { codeNorm: true },
        })
      ).map((l) => l.codeNorm)
    : [];
  const { entered, left } = diffStock(
    previousCodes,
    match.lines.map((l) => l.codeNorm),
  );

  return Response.json({
    fileName: file.name,
    brand,
    // I codici grezzi tornano al client e li rimanda alla conferma: la scrittura
    // li ri-aggancia DA CAPO lato server, quindi l'anteprima è informativa e non
    // una fonte di verità di cui fidarsi.
    rawCodes: match.lines.map((l) => l.rawCode),
    rowCount: rawCodes.length,
    matchedCount: match.matchedCount,
    orphans: match.orphans,
    duplicates: match.duplicates,
    invalid: match.invalid,
    entered: entered.length,
    left: left.length,
    previousImportedAt: previous?.importedAt ?? null,
  });
}
