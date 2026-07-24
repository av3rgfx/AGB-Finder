"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { makeHighlighter } from "./highlight";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// Opzione B: ogni pagina del listino è un file singolo su Vercel Blob, servito da
// /api/listino?page=N e scaricato per intero (niente Range) → tutte le immagini
// arrivano prima del disegno. `numPages` del documento è sempre 1: il totale
// arriva come prop dal layout (env LISTINO_TOTAL_PAGES).
const PDF_OPTIONS = {} as const;

// Larghezza massima di rendering su desktop; su mobile ci si adatta al contenitore.
const MAX_PAGE_WIDTH = 720;

export function ListinoViewer({
  code,
  page,
  totalPages,
  onClose,
}: {
  code: string;
  page: number;
  totalPages: number | null;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(page);
  const [width, setWidth] = useState<number>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlight = useMemo(() => makeHighlighter(code), [code]);
  const file = useMemo(() => `/api/listino?page=${current}`, [current]);

  useEffect(() => setCurrent(page), [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Mobile-first: dimensiona il canvas della pagina sul contenitore misurato (un
  // canvas non si ridimensiona via CSS senza sfocare) → niente overflow a ≤375px.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.min(MAX_PAGE_WIDTH, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canPrev = current > 1;
  const canNext = totalPages != null && current < totalPages;

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
            {totalPages != null ? ` / ${totalPages}` : ""}
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

        <div ref={scrollRef} className="flex-1 overflow-auto bg-surface-sunken p-2">
          <Document
            file={file}
            options={PDF_OPTIONS}
            loading={<p className="p-6 text-center text-sm text-ink-subtle">Caricamento pagina…</p>}
            error={
              <p className="p-6 text-center text-sm text-danger">Impossibile aprire il listino.</p>
            }
          >
            <Page
              pageNumber={1}
              width={width}
              customTextRenderer={highlight}
              renderAnnotationLayer={false}
              className="mx-auto max-w-full"
            />
          </Document>
        </div>

        <footer className="flex items-center justify-center gap-4 border-t border-line px-4 py-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setCurrent((c) => Math.max(1, c - 1))}
            aria-label="Pagina precedente"
            className="rounded p-1 text-ink-subtle hover:bg-surface-sunken disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!canNext}
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
