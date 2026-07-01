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
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login"],
};
