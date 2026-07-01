import type { UserRole } from "@prisma/client";

export interface RouteToken {
  role?: UserRole;
}

/**
 * Pure route-protection decision. Returns a redirect target path, or null to
 * let the request proceed. Kept free of `next/*` imports so it is unit-testable.
 *
 * - Protected areas (/dashboard, /admin): anonymous → /login.
 * - /admin: non-ADMIN authenticated users → /dashboard.
 * - /login: already-authenticated users → /dashboard.
 */
export function decideRedirect(params: {
  pathname: string;
  token: RouteToken | null;
}): string | null {
  const { pathname, token } = params;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isLogin = pathname === "/login";

  if (isLogin) {
    return token ? "/dashboard" : null;
  }
  if (isAdmin || isDashboard) {
    if (!token) return "/login";
    if (isAdmin && token.role !== "ADMIN") return "/dashboard";
  }
  return null;
}
