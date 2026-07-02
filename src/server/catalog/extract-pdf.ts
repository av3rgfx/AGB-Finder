// Thin wrapper su poppler-utils. Isolato dal parser: i test del parser non richiedono il binario.
import { execFile } from "node:child_process";

const MAX_BUFFER = 256 * 1024 * 1024; // il listino estratto è ~4 MB; margine largo

export function extractPdfText(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("pdftotext", ["-layout", pdfPath, "-"], { maxBuffer: MAX_BUFFER }, (error, stdout) => {
      if (error) {
        reject(
          new Error(
            `pdftotext fallito per ${pdfPath}: ${error.message}. Verifica che poppler-utils sia installato.`,
          ),
        );
      } else {
        resolve(stdout);
      }
    });
  });
}
