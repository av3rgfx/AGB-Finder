import { describe, it, expect, vi } from "vitest";
import { buildAdminData, BASE_CATEGORIES } from "./seed";

describe("buildAdminData", () => {
  it("hashes the password and marks the user ADMIN/ACTIVE without leaking plaintext", async () => {
    const hash = vi.fn().mockResolvedValue("hashed-value");
    const data = await buildAdminData({ email: "admin@x.it", password: "s3cret-pw" }, hash);

    expect(hash).toHaveBeenCalledWith("s3cret-pw", 12);
    expect(data).toMatchObject({
      email: "admin@x.it",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: "hashed-value",
    });
    expect(JSON.stringify(data)).not.toContain("s3cret-pw");
  });

  it("applies default first/last name", async () => {
    const data = await buildAdminData({ email: "a@b.it", password: "x" }, vi.fn().mockResolvedValue("h"));
    expect(data.firstName).toBe("Admin");
    expect(data.lastName).toBe("UFP");
  });
});

describe("BASE_CATEGORIES", () => {
  it("has unique slugs", () => {
    const slugs = BASE_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
