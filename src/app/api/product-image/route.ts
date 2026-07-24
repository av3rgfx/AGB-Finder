import { headers } from "next/headers";
import { auth } from "@/server/auth/config";
import { db } from "@/server/db";

export const runtime = "nodejs";

/** Codice AGB completo, ancorato (validazione stretta del parametro). */
const AGB_CODE = /^[A-Z]\d{5}\.\d{2}\.\d{2}$/;

/**
 * Serve la foto prodotto (estratta dal listino) dal DB, dietro auth. Le immagini
 * sono servite come <img> nativi — niente PDF.js, così i JPEG2000 del listino
 * (che PDF.js non rende) si vedono, convertiti in PNG lato estrazione. Uso: `?code=AGB`.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Non autorizzato", { status: 401 });

  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!AGB_CODE.test(code)) return new Response("Codice non valido", { status: 400 });

  const image = await db.productImage.findUnique({
    where: { agbCode: code },
    select: { data: true, mimeType: true },
  });
  if (!image) return new Response("Immagine non trovata", { status: 404 });

  // Copia in un Uint8Array con ArrayBuffer proprio (BodyInit valido, niente ArrayBufferLike).
  const body = new Uint8Array(image.data.byteLength);
  body.set(image.data);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      // Immutabile per edizione del listino → cache lunga.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
