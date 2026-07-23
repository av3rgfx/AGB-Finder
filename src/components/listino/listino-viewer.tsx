"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { makeHighlighter } from "./highlight";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// NON impostare `disableAutoFetch: true`: con quell'opzione PDF.js carica testo e
// grafica vettoriale ma NON recupera gli XObject immagine della pagina (le foto
// dei prodotti restavano bianche). Coi default (auto-fetch attivo) PDF.js recupera
// anche le immagini; le range-request restano usate (fetch progressivo del file).
const PDF_OPTIONS = {} as const;

export function ListinoViewer({
  code,
  page,
  onClose,
}: {
  code: string;
  page: number;
  onClose: () => void;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [current, setCurrent] = useState(page);
  const highlight = useMemo(() => makeHighlighter(code), [code]);

  useEffect(() => setCurrent(page), [page]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Listino — codice ${code}`}
      className="fixed inset-0 z-50 flex bg-black/70 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="mx-auto flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <span className="font-mono text-sm text-ink">{code}</span>
          <span className="text-xs text-ink-subtle">
            pag. {current}
            {numPages ? ` / ${numPages}` : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="rounded p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-auto bg-surface-sunken p-2">
          <Document
            file="/api/listino"
            options={PDF_OPTIONS}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<p className="p-6 text-center text-sm text-ink-subtle">Caricamento listino…</p>}
            error={
              <p className="p-6 text-center text-sm text-danger">Impossibile aprire il listino.</p>
            }
          >
            <Page
              pageNumber={current}
              width={720}
              customTextRenderer={highlight}
              renderAnnotationLayer={false}
              className="mx-auto max-w-full"
            />
          </Document>
        </div>

        <footer className="flex items-center justify-center gap-4 border-t border-line px-4 py-2">
          <button
            type="button"
            disabled={current <= 1}
            onClick={() => setCurrent((c) => Math.max(1, c - 1))}
            aria-label="Pagina precedente"
            className="rounded p-1 text-ink-subtle hover:bg-surface-sunken disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={numPages != null && current >= numPages}
            onClick={() => setCurrent((c) => c + 1)}
            aria-label="Pagina successiva"
            className="rounded p-1 text-ink-subtle hover:bg-surface-sunken disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </footer>
      </div>
    </div>
  );
}
