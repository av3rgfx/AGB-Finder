import type { Metadata } from "next";
import { ArchivioClient } from "./archivio-client";

export const metadata: Metadata = { title: "Archivio — UFPtrade" };

export default function ArchivioPage() {
  return <ArchivioClient />;
}
