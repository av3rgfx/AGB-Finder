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

  it("redirects an authenticated user away from /login", () => {
    expect(decideRedirect({ pathname: "/login", hasSession: true })).toBe("/dashboard");
  });

  it("leaves an anonymous user on /login", () => {
    expect(decideRedirect({ pathname: "/login", hasSession: false })).toBeNull();
  });

  it("ignores unprotected paths", () => {
    expect(decideRedirect({ pathname: "/prodotti", hasSession: false })).toBeNull();
  });
});
