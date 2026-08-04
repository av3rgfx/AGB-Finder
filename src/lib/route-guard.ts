import { HOME_REPARTI } from "./reparti";

/**
 * Pure route-protection decision. Returns a redirect target path, or null to
 * let the request proceed. Kept free of framework imports so it is unit-testable.
 *
 * The Edge middleware only knows whether a session cookie exists (optimistic).
 * Fine-grained RBAC (e.g. ADMIN-only areas) is enforced server-side in tRPC and
 * the admin layout, not here.
 *
 * - Protected areas without a session → /login.
 * - /login with an existing session → «/», la schermata di scelta del reparto.
 *
 * ⚠️ Il matcher del middleware è un ALLOWLIST cablato che copre meno di quanto
 * sembri: `/archivio`, `/richieste`, `/clienti`, `/utenti`, `/impostazioni` non
 * ci sono mai stati, e sono protetti dal solo `redirect("/login")` del layout
 * server. Questa funzione decide su ciò che il matcher le fa vedere; la lista
 * qui sotto è allineata a quella del middleware.
 */
const PROTETTE = ["/dashboard", "/admin", "/maniglie", HOME_REPARTI];

export function decideRedirect(params: {
  pathname: string;
  hasSession: boolean;
}): string | null {
  const { pathname, hasSession } = params;
  const isProtected = PROTETTE.some(
    (base) => pathname === base || (base !== "/" && pathname.startsWith(`${base}/`)),
  );
  const isLogin = pathname === "/login";

  // Dopo il login si atterra sulla SCELTA DEL REPARTO, non dentro un reparto:
  // è l'unica risposta onesta quando l'app non sa dove si vuole andare — e non
  // la sa, perché non ricorda (nessun cookie: sarebbe un valore deciso dal
  // programma e mai dichiarato). Chi ha un segnalibro o un `callbackUrl` ci
  // arriva dritto lo stesso, quindi il passaggio non è un pedaggio per tutti.
  if (isLogin) return hasSession ? HOME_REPARTI : null;
  if (isProtected) return hasSession ? null : "/login";
  return null;
}
