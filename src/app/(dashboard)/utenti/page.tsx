import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { UtentiClient } from "./utenti-client";

export default async function UtentiPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Utenti</h1>
        <p className="mt-1 text-sm text-ink-subtle">Crea e gestisci gli account degli agenti e degli amministratori.</p>
      </header>
      <UtentiClient currentUserId={session.user.id} />
    </div>
  );
}
