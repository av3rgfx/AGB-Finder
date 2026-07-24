import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSession, findUnique } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
}));
vi.mock("@/server/auth/config", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@/server/db", () => ({ db: { productImage: { findUnique } } }));

import { GET } from "./route";

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
});

describe("GET /api/product-image?code=…", () => {
  it("senza sessione → 401", async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/product-image?code=E10157.14.93"));
    expect(res.status).toBe(401);
  });

  it("codice non valido → 400 (e non tocca il DB)", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    for (const bad of ["", "abc", "E10157", "E10157.14", "'; DROP TABLE", "E10157.14.93 "]) {
      const res = await GET(
        new Request(`http://x/api/product-image?code=${encodeURIComponent(bad)}`),
      );
      expect(res.status, `code=${bad}`).toBe(400);
    }
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("codice senza immagine → 404", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/product-image?code=E10157.14.93"));
    expect(res.status).toBe(404);
  });

  it("codice con immagine → 200 con i byte e il mime giusto", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue({ data: Buffer.from([1, 2, 3]), mimeType: "image/png" });
    const res = await GET(new Request("http://x/api/product-image?code=E10157.14.93"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(findUnique).toHaveBeenCalledWith({
      where: { agbCode: "E10157.14.93" },
      select: { data: true, mimeType: true },
    });
  });
});
