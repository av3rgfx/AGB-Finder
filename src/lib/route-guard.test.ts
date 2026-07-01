import { describe, it, expect } from "vitest";
import { decideRedirect } from "./route-guard";

describe("decideRedirect", () => {
  it("sends anonymous users on /dashboard to /login", () => {
    expect(decideRedirect({ pathname: "/dashboard", token: null })).toBe("/login");
  });

  it("sends anonymous users on /admin to /login", () => {
    expect(decideRedirect({ pathname: "/admin/users", token: null })).toBe("/login");
  });

  it("sends an AGENT hitting /admin to /dashboard", () => {
    expect(decideRedirect({ pathname: "/admin", token: { role: "AGENT" } })).toBe("/dashboard");
  });

  it("allows an ADMIN on /admin", () => {
    expect(decideRedirect({ pathname: "/admin/users", token: { role: "ADMIN" } })).toBeNull();
  });

  it("allows an AGENT on /dashboard", () => {
    expect(decideRedirect({ pathname: "/dashboard", token: { role: "AGENT" } })).toBeNull();
  });

  it("redirects an authenticated user away from /login", () => {
    expect(decideRedirect({ pathname: "/login", token: { role: "AGENT" } })).toBe("/dashboard");
  });

  it("leaves an anonymous user on /login", () => {
    expect(decideRedirect({ pathname: "/login", token: null })).toBeNull();
  });
});
