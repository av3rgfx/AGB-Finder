import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/server/auth/config", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@/env", () => ({
  env: {
    LISTINO_PAGE_URL_TEMPLATE: "https://blob.example/listino/page-{page}.pdf",
    LISTINO_TOTAL_PAGES: 959,
  },
}));

import { GET } from "./route";

beforeEach(() => {
  getSession.mockReset();
  vi.restoreAllMocks();
});

describe("GET /api/listino?page=N", () => {
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
  });

  it("page valida → 200, fetch dell'URL risolto dal template, SENZA header Range", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-length": "3" },
      }),
    );
    const res = await GET(new Request("http://x/api/listino?page=418"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-length")).toBe("3");
    // Nessun Range: il file singolo si scarica per intero.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://blob.example/listino/page-418.pdf");
  });

  it("upstream 404 su pagina in-range → 502", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 404 }));
    const res = await GET(new Request("http://x/api/listino?page=500"));
    expect(res.status).toBe(502);
  });
});
