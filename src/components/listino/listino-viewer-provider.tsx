"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

const ListinoViewer = dynamic(
  () => import("./listino-viewer").then((m) => m.ListinoViewer),
  { ssr: false },
);

type Target = { code: string; page: number };
const Ctx = createContext<{ open: (t: Target) => void } | null>(null);

export function ListinoViewerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  return (
    <Ctx.Provider value={{ open: setTarget }}>
      {children}
      {target && (
        <ListinoViewer code={target.code} page={target.page} onClose={() => setTarget(null)} />
      )}
    </Ctx.Provider>
  );
}

export function useListinoViewer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useListinoViewer richiede <ListinoViewerProvider>.");
  return ctx;
}
