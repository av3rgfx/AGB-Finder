import type { Metadata } from "next";
import { ArchivioClient } from "@/components/product/archivio-client";

export const metadata: Metadata = { title: "Archivio prodotti — UFPtrade" };

export default function ArchivioPage() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Archivio prodotti</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Catalogo AGB — cerca per nome, codice, finitura o materiale.
        </p>
      </div>
      <ArchivioClient />
    </div>
  );
}
