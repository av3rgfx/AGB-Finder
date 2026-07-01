import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "UFPtrade — Utensilferramenta Pistoiese",
  description: "Gestionale agenti e catalogo AGB per Utensilferramenta Pistoiese S.p.A.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
