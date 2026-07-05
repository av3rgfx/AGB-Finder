import type { Metadata } from "next";
import { DettaglioClient } from "./dettaglio-client";

export const metadata: Metadata = { title: "Dettaglio richiesta kit — UFPtrade" };

// Next 15: params è una Promise.
export default async function RichiestaDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DettaglioClient id={id} />;
}
