import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { ImportClient } from "./import-client";

/**
 * Importazione della pronta consegna: la usa SOLO Andrea (ADMIN).
 *
 * È l'unico punto dell'app in cui una persona sola pubblica un dato a tutti e
 * dieci gli agenti, quindi il ruolo si verifica anche QUI: le mutation sono già
 * `adminProcedure`, ma una pagina raggiungibile da un agente gli mostrerebbe uno
 * schermo di pulsanti che falliscono, che è un modo di dire «riprova» a chi non
 * deve provare affatto.
 */
export default async function ImportProntaConsegnaPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/maniglie");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Pronta consegna · importazione</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Carica l&apos;elenco dei codici disponibili a magazzino. Prima di pubblicarlo vedrai un
          riepilogo di ciò che cambia per gli agenti.
        </p>
      </header>
      <ImportClient />
    </div>
  );
}
