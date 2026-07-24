import { headers } from "next/headers";
import { get } from "@vercel/blob";
import { auth } from "@/server/auth/config";
import { env } from "@/env";
import { parsePageParam } from "./page-param";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Serve UNA singola pagina del listino da Vercel Blob (store PRIVATO), dietro auth
 * (Opzione B: il listino è pre-splittato in pagine singole, ognuna un file minuscolo
 * con tutte le sue immagini). La paginetta si legge lato server col token Blob e si
 * streamma per intero — così PDF.js riceve tutti gli XObject immagine prima di
 * disegnare, e il PDF non è mai raggiungibile pubblicamente. Uso: `?page=N`.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Non autorizzato", { status: 401 });

  const token = env.BLOB_READ_WRITE_TOKEN;
  const total = env.LISTINO_TOTAL_PAGES;
  if (!token || total == null) {
    return new Response("Listino non configurato", { status: 503 });
  }

  const page = parsePageParam(new URL(req.url).searchParams.get("page"), total);
  if (page == null) return new Response("Pagina non valida", { status: 400 });

  const result = await get(`listino/page-${page}.pdf`, { access: "private", token }).catch(
    () => null,
  );
  if (!result?.stream) {
    return new Response("Pagina del listino non trovata", { status: 502 });
  }

  const out = new Headers();
  out.set("Content-Type", "application/pdf");
  // Le paginette sono immutabili per edizione del listino → cache lunga (back-paging istantaneo).
  out.set("Cache-Control", "private, max-age=86400");

  return new Response(result.stream, { status: 200, headers: out });
}
