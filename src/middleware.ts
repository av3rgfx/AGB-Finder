import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { decideRedirect, type RouteToken } from "@/lib/route-guard";

/**
 * Edge route protection. Reads the JWT (no Prisma/bcrypt — Edge-safe) and
 * redirects based on the pure `decideRedirect` policy. Fine-grained RBAC is
 * still enforced in tRPC; this is a first-line guard.
 */
export async function middleware(req: NextRequest) {
  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as RouteToken | null;

  const target = decideRedirect({ pathname: req.nextUrl.pathname, token });
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
