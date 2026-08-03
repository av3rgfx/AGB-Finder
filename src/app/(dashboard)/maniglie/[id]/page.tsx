import type { Metadata } from "next";
import { ArticoloClient } from "./articolo-client";

export const metadata: Metadata = { title: "Articolo — UFPtrade" };

// Next 15: `params` è una Promise.
export default async function ArticoloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArticoloClient id={id} />;
}
