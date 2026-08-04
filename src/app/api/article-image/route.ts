import { headers } from "next/headers";
import { get } from "@vercel/blob";
import { auth } from "@/server/auth/config";
import { env } from "@/env";
import { parseChiaveFoto, parseSizeFoto } from "./chiave-param";

export const runtime = "nodejs";

/**
 * Serve una foto d'articolo COLOMBO da Vercel Blob (store **PRIVATO**), dietro
 * auth. Stessa forma di `/api/listino`: sono foto di un fornitore e non devono
 * essere raggiungibili pubblicamente — `public/` è escluso perché il repo è
 * pubblico, e i byte non stanno in Postgres perché le 7.082 foto AGB dentro il DB
 * sono la causa unica dei tre limiti di piattaforma più caldi.
 *
 * Uso: `?k=<chiave>&size=320|900`. La chiave la costruisce il router da
 * `articles.image_url`; il browser non la inventa, ma la route la valida lo stesso.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Non autorizzato", { status: 401 });

  const url = new URL(req.url);
  const chiave = parseChiaveFoto(url.searchParams.get("k"));
  const size = parseSizeFoto(url.searchParams.get("size"));
  if (chiave === null || size === null) {
    return new Response("Richiesta non valida", { status: 400 });
  }

  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) return new Response("Foto non configurate", { status: 503 });

  const res = await get(`${chiave}-${size}.webp`, { access: "private", token }).catch(() => null);
  // La foto mancante è la NORMALITÀ — il 42% dei codici non ne ha una, ed è
  // minuteria che nessun catalogo fotografa. 404 pulito: un 5xx qui suonerebbe
  // come un'avaria, e la UI disegna comunque il suo segnaposto neutro.
  if (!res?.stream) return new Response("Foto non trovata", { status: 404 });

  return new Response(res.stream, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      // Immutabile PER CHIAVE: la chiave è derivata dal nome del file d'archivio,
      // quindi una foto diversa è una chiave diversa e la cache non va invalidata.
      "Cache-Control": "private, max-age=604800, immutable",
    },
  });
}
