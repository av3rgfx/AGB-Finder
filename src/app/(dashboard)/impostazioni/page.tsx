import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { ImpostazioniClient } from "./impostazioni-client";

export default async function ImpostazioniPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Impostazioni · API key AI</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Gestisci le chiavi API dei provider AI usati dall&apos;assistente e dal motore kit.
        </p>
      </header>
      <ImpostazioniClient />
    </div>
  );
}
