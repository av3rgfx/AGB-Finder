"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

const ListinoViewer = dynamic(
  () => import("./listino-viewer").then((m) => m.ListinoViewer),
  { ssr: false },
);

type Target = { code: string; page: number };
const Ctx = createContext<{ open: (t: Target) => void } | null>(null);

/**
 * Monta un solo viewer del listino a livello di layout. `totalPages` è una
 * costante di deploy (env LISTINO_TOTAL_PAGES) letta dal layout server e passata
 * come prop: serve al viewer per l'indicatore «pag. N / totale» e per disabilitare
 * «successiva» all'ultima pagina (ogni file è a pagina singola, quindi il documento
 * non conosce il totale).
 */
export function ListinoViewerProvider({
  children,
  totalPages,
}: {
  children: ReactNode;
  totalPages: number | null;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  return (
    <Ctx.Provider value={{ open: setTarget }}>
      {children}
      {target && (
        <ListinoViewer
          code={target.code}
          page={target.page}
          totalPages={totalPages}
          onClose={() => setTarget(null)}
        />
      )}
    </Ctx.Provider>
  );
}

export function useListinoViewer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useListinoViewer richiede <ListinoViewerProvider>.");
  return ctx;
}
