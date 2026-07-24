import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSession, get } = vi.hoisted(() => ({ getSession: vi.fn(), get: vi.fn() }));
vi.mock("@/server/auth/config", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@vercel/blob", () => ({ get }));
vi.mock("@/env", () => ({
  env: { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test", LISTINO_TOTAL_PAGES: 959 },
}));

import { GET } from "./route";

function fakeStream() {
  return new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array([1, 2, 3]));
      c.close();
    },
  });
}

beforeEach(() => {
  getSession.mockReset();
  get.mockReset();
});

describe("GET /api/listino?page=N (store privato)", () => {
  it("senza sessione → 401", async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/listino?page=418"));
    expect(res.status).toBe(401);
  });

  it("page non valida → 400", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    for (const bad of ["0", "01", "-1", "1.5", "abc", "1000000", ""]) {
      const res = await GET(new Request(`http://x/api/listino?page=${encodeURIComponent(bad)}`));
      expect(res.status, `page=${bad}`).toBe(400);
    }
    expect(get).not.toHaveBeenCalled();
  });

  it("page valida → 200, legge il blob privato per pathname col token", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    get.mockResolvedValue({ stream: fakeStream(), blob: { size: 3 } });
    const res = await GET(new Request("http://x/api/listino?page=418"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(get).toHaveBeenCalledWith("listino/page-418.pdf", {
      access: "private",
      token: "vercel_blob_rw_test",
    });
  });

  it("blob mancante (get → null) su pagina in-range → 502", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    get.mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/listino?page=500"));
    expect(res.status).toBe(502);
  });

  it("errore del blob (get rigetta) → 502, non propaga l'eccezione", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    get.mockRejectedValue(new Error("boom"));
    const res = await GET(new Request("http://x/api/listino?page=500"));
    expect(res.status).toBe(502);
  });
});
