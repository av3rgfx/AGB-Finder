import { describe, it, expect, vi } from "vitest";

// Feature off: nessuna env del listino configurata → la route deve dare 503.
const { getSession, get } = vi.hoisted(() => ({ getSession: vi.fn(), get: vi.fn() }));
vi.mock("@/server/auth/config", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@vercel/blob", () => ({ get }));
vi.mock("@/env", () => ({ env: {} }));

import { GET } from "./route";

describe("GET /api/listino — feature non configurata", () => {
  it("con sessione ma env assenti → 503 (e non tocca il Blob)", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await GET(new Request("http://x/api/listino?page=1"));
    expect(res.status).toBe(503);
    expect(get).not.toHaveBeenCalled();
  });
});
