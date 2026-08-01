import type { Metadata } from "next";
import { NuovaRichiestaClient } from "./nuova-client";

export const metadata: Metadata = { title: "Nuova richiesta kit — UFPtrade" };

/**
 * `?da=<id>` apre il wizard in **modifica** su una richiesta esistente: stessi
 * componenti da scegliere, ma le specifiche del serramento sono congelate e al
 * conferma nasce una nuova versione invece di una richiesta nuova.
 *
 * In Next 15 `searchParams` è una Promise, quindi la pagina è `async`.
 */
export default async function NuovaRichiestaPage({
  searchParams,
}: {
  searchParams: Promise<{ da?: string }>;
}) {
  const { da } = await searchParams;
  return <NuovaRichiestaClient daId={da} />;
}
