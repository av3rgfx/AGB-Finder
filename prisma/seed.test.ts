import { describe, it, expect } from "vitest";
import { buildAdminUserData, BASE_CATEGORIES } from "./seed";

describe("buildAdminUserData", () => {
  it("marks the user ADMIN/ACTIVE, verified, with a composed name", () => {
    const data = buildAdminUserData("admin@x.it", "Anna", "Bianchi");
    expect(data).toMatchObject({
      email: "admin@x.it",
      name: "Anna Bianchi",
      firstName: "Anna",
      lastName: "Bianchi",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true,
    });
  });

  it("does not carry a password (it lives in the Account row)", () => {
    expect(buildAdminUserData("a@b.it")).not.toHaveProperty("password");
  });
});

describe("BASE_CATEGORIES", () => {
  it("has unique slugs", () => {
    const slugs = BASE_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
