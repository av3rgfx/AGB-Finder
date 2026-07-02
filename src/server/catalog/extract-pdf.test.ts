import { describe, it, expect, vi, beforeEach } from "vitest";

const execFileMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

import { extractPdfText } from "./extract-pdf";

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

beforeEach(() => {
  // NB: niente corpo-espressione — mockReset() ritorna il mock e vitest
  // invocherebbe il valore di ritorno di beforeEach come hook di cleanup.
  execFileMock.mockReset();
});

describe("extractPdfText", () => {
  it("invoca pdftotext -layout <pdf> - e risolve con lo stdout", async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: ExecCallback) => cb(null, "TESTO", ""),
    );
    await expect(extractPdfText("/tmp/listino.pdf")).resolves.toBe("TESTO");
    expect(execFileMock).toHaveBeenCalledWith(
      "pdftotext",
      ["-layout", "/tmp/listino.pdf", "-"],
      expect.objectContaining({ maxBuffer: expect.any(Number) }),
      expect.any(Function),
    );
  });

  it("rifiuta con un errore parlante se pdftotext fallisce", async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: ExecCallback) =>
        cb(new Error("ENOENT"), "", ""),
    );
    await expect(extractPdfText("/tmp/x.pdf")).rejects.toThrow(/pdftotext.*\/tmp\/x\.pdf/);
  });
});
