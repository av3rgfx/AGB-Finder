import { headers } from "next/headers";
import { auth } from "@/server/auth/config";
import { env } from "@/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Streamma il listino PDF da Vercel Blob dietro auth, inoltrando le Range-request. */
export async function GET(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Non autorizzato", { status: 401 });

  const url = env.LISTINO_PDF_URL;
  if (!url) return new Response("Listino non configurato", { status: 503 });

  const range = req.headers.get("range");
  const upstream = await fetch(url, range ? { headers: { Range: range } } : {});

  const out = new Headers();
  out.set("Content-Type", "application/pdf");
  out.set("Accept-Ranges", "bytes");
  out.set("Cache-Control", "private, max-age=3600");
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) out.set("Content-Range", contentRange);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) out.set("Content-Length", contentLength);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
