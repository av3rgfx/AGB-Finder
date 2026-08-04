import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSession, get } = vi.hoisted(() => ({ getSession: vi.fn(), get: vi.fn() }));
vi.mock("@/server/auth/config", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@vercel/blob", () => ({ get }));
vi.mock("@/env", () => ({ env: { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test" } }));

import { GET } from "./route";

function fakeStream() {
  return new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array([1, 2, 3]));
      c.close();
    },
  });
}

const CHIAVE = "maniglie/colombo/01-fedra/fedra-1ol";
const req = (qs: string) => new Request(`http://x/api/article-image?${qs}`);

beforeEach(() => {
  getSession.mockReset();
  get.mockReset();
});

describe("GET /api/article-image (Blob privato, dietro auth)", () => {
  it("senza sessione → 401, e non tocca il Blob", async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(req(`k=${encodeURIComponent(CHIAVE)}&size=320`));
    expect(res.status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });

  it("chiave fuori dal nostro prefisso → 400", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await GET(req("k=listino%2Fpage-1&size=320"));
    expect(res.status).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });

  it("formato non generato → 400", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await GET(req(`k=${encodeURIComponent(CHIAVE)}&size=1200`));
    expect(res.status).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });

  it("serve il WebP del formato chiesto, dallo store privato", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    get.mockResolvedValue({ stream: fakeStream() });
    const res = await GET(req(`k=${encodeURIComponent(CHIAVE)}&size=900`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(get).toHaveBeenCalledWith(`${CHIAVE}-900.webp`, {
      access: "private",
      token: "vercel_blob_rw_test",
    });
  });

  it("foto assente → 404: è la normalità, non un guasto", async () => {
    // Il 42% dei codici non ha una foto, e la UI disegna il segnaposto senza
    // dire che è successo qualcosa. Un 5xx qui suonerebbe come un'avaria.
    getSession.mockResolvedValue({ user: { id: "u1" } });
    get.mockResolvedValue(null);
    expect((await GET(req(`k=${encodeURIComponent(CHIAVE)}&size=320`))).status).toBe(404);

    get.mockRejectedValue(new Error("BlobNotFoundError"));
    expect((await GET(req(`k=${encodeURIComponent(CHIAVE)}&size=320`))).status).toBe(404);
  });

  it("senza token configurato → 503, non un 500", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({ env: { BLOB_READ_WRITE_TOKEN: undefined } }));
    const { GET: GETsenzaToken } = await import("./route");
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await GETsenzaToken(req(`k=${encodeURIComponent(CHIAVE)}&size=320`));
    expect(res.status).toBe(503);
    vi.doUnmock("@/env");
    vi.resetModules();
  });
});
