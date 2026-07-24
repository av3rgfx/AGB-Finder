import { Suspense } from "react";
import type { Metadata } from "next";
import { ArchivioClient } from "./archivio-client";

export const metadata: Metadata = { title: "Archivio — UFPtrade" };

export default function ArchivioPage() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden />}>
      <ArchivioClient />
    </Suspense>
  );
}
