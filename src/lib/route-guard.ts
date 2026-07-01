/**
 * Pure route-protection decision. Returns a redirect target path, or null to
 * let the request proceed. Kept free of framework imports so it is unit-testable.
 *
 * The Edge middleware only knows whether a session cookie exists (optimistic).
 * Fine-grained RBAC (e.g. ADMIN-only areas) is enforced server-side in tRPC and
 * the admin layout, not here.
 *
 * - Protected areas (/dashboard, /admin) without a session → /login.
 * - /login with an existing session → /dashboard.
 */
export function decideRedirect(params: {
  pathname: string;
  hasSession: boolean;
}): string | null {
  const { pathname, hasSession } = params;
  const isProtected =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");
  const isLogin = pathname === "/login";

  if (isLogin) return hasSession ? "/dashboard" : null;
  if (isProtected) return hasSession ? null : "/login";
  return null;
}
