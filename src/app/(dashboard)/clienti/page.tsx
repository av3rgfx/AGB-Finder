import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { ClientiClient } from "./clienti-client";

/**
 * Nessun gate ADMIN, a differenza di `/utenti`: l'anagrafica clienti è
 * **condivisa** fra gli agenti — `Customer` non ha un proprietario — e il router
 * usa `agentProcedure`. Un gate qui nasconderebbe una funzione che il server
 * concede comunque.
 */
export default async function ClientiPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Clienti</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Lo sconto e il profilo serramento di ciascun cliente. Il profilo non precompila nulla: si
          applica con un clic quando crei una richiesta.
        </p>
      </header>
      <ClientiClient />
    </div>
  );
}
