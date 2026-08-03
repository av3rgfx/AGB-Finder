import { describe, it, expect } from "vitest";
import { decideRedirect } from "./route-guard";

describe("decideRedirect", () => {
  it("sends anonymous users on /dashboard to /login", () => {
    expect(decideRedirect({ pathname: "/dashboard", hasSession: false })).toBe("/login");
  });

  it("sends anonymous users on /admin to /login", () => {
    expect(decideRedirect({ pathname: "/admin/users", hasSession: false })).toBe("/login");
  });

  it("allows an authenticated user on /dashboard", () => {
    expect(decideRedirect({ pathname: "/dashboard", hasSession: true })).toBeNull();
  });

  it("leaves an anonymous user on /login", () => {
    expect(decideRedirect({ pathname: "/login", hasSession: false })).toBeNull();
  });

  it("ignores unprotected paths", () => {
    expect(decideRedirect({ pathname: "/prodotti", hasSession: false })).toBeNull();
  });

  // ── Selettore di reparto ──────────────────────────────────────────────

  it("dopo il login si atterra sulla SCELTA DEL REPARTO, non dentro un reparto", () => {
    // Prima puntava a `/dashboard`, cioè dentro i serramenti: il selettore
    // sarebbe stato una schermata che nessuno vede.
    expect(decideRedirect({ pathname: "/login", hasSession: true })).toBe("/");
  });

  it("protegge la schermata di scelta: senza sessione si va al login", () => {
    // `/` prima non era nel matcher e faceva `redirect("/login")` da sola; ora
    // che è una pagina vera, la protezione deve esserci per davvero.
    expect(decideRedirect({ pathname: "/", hasSession: false })).toBe("/login");
  });

  it("lascia passare chi è autenticato sulla scelta del reparto", () => {
    expect(decideRedirect({ pathname: "/", hasSession: true })).toBeNull();
  });

  it("protegge il reparto maniglie", () => {
    // Nasceva con la stessa lacuna delle altre rotte: fuori dal matcher.
    expect(decideRedirect({ pathname: "/maniglie", hasSession: false })).toBe("/login");
    expect(decideRedirect({ pathname: "/maniglie/abc", hasSession: false })).toBe("/login");
    expect(decideRedirect({ pathname: "/maniglie/import", hasSession: false })).toBe("/login");
  });

  it("lascia passare chi è autenticato nel reparto maniglie", () => {
    expect(decideRedirect({ pathname: "/maniglie", hasSession: true })).toBeNull();
  });

  it("NON protegge per prefisso di stringa una rotta che è un'altra cosa", () => {
    // `/manigliette` non è dentro `/maniglie`: il confine è il segmento.
    expect(decideRedirect({ pathname: "/manigliette", hasSession: false })).toBeNull();
  });
});
