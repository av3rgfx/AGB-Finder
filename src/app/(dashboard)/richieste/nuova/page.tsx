import type { Metadata } from "next";
import { NuovaRichiestaClient } from "./nuova-client";

export const metadata: Metadata = { title: "Nuova richiesta kit — UFPtrade" };

export default function NuovaRichiestaPage() {
  return <NuovaRichiestaClient />;
}
