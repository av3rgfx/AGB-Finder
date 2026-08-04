import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { decideRedirect } from "@/lib/route-guard";

/**
 * Edge route protection. Optimistic session-cookie check (no DB) for first-line
 * redirects. Real auth + RBAC is enforced server-side (tRPC / server layouts).
 */
export function middleware(req: NextRequest) {
  const hasSession = Boolean(getSessionCookie(req));
  const target = decideRedirect({ pathname: req.nextUrl.pathname, hasSession });

  if (target && target !== req.nextUrl.pathname) {
    const url = req.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // ⚠️ Allowlist cablato: le rotte non elencate qui NON passano da questo
  // controllo e restano protette dal solo `redirect("/login")` del layout
  // server — vale già oggi per /archivio, /richieste, /clienti, /utenti,
  // /impostazioni. Il reparto maniglie e la scelta del reparto ci entrano
  // invece di ereditare la lacuna.
  matcher: ["/", "/dashboard/:path*", "/admin/:path*", "/maniglie/:path*", "/login"],
};
