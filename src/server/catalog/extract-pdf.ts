import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Extract layout-preserving text from a PDF via poppler's `pdftotext`.
 * Runtime prerequisite for the import only: `apt-get install poppler-utils`.
 */
export async function extractPdfText(pdfPath: string): Promise<string> {
  const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}
