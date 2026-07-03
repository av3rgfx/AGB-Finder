import type { Metadata } from "next";
import { AssistenteClient } from "./assistente-client";

export const metadata: Metadata = { title: "Assistente — UFPtrade" };

export default function AssistentePage() {
  return <AssistenteClient />;
}
