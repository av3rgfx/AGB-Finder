import type { Metadata } from "next";
import { RichiesteClient } from "./richieste-client";

export const metadata: Metadata = { title: "Richieste Kit — UFPtrade" };

export default function RichiestePage() {
  return <RichiesteClient />;
}
