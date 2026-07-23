import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/server/auth/config", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@/env", () => ({ env: { LISTINO_PDF_URL: "https://blob.example/listino.pdf" } }));

import { GET } from "./route";

beforeEach(() => {
  getSession.mockReset();
  vi.restoreAllMocks();
});

describe("GET /api/listino", () => {
  it("senza sessione → 401", async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/listino"));
    expect(res.status).toBe(401);
  });

  it("con sessione e Range → inoltra e ritorna 206 con gli header giusti", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: { "content-range": "bytes 0-2/100", "content-length": "3" },
      }),
    );
    const res = await GET(new Request("http://x/api/listino", { headers: { range: "bytes=0-2" } }));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-2/100");
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://blob.example/listino.pdf",
      expect.objectContaining({ headers: { Range: "bytes=0-2" } }),
    );
  });
});
