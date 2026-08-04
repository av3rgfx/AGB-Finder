import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/server/auth/config";
import { REPARTI } from "@/lib/reparti";

/**
 * La scelta del reparto: la prima schermata dopo il login.
 *
 * Si ATTRAVERSA a ogni accesso, e non ricorda nulla — nessun cookie, nessun
 * `localStorage`. Un reparto ripescato in silenzio da uno stato invisibile
 * sarebbe l'ottava occorrenza della classe di difetto che questo progetto ha già
 * chiuso sette volte. Chi ha un segnalibro o un `callbackUrl` non passa di qui,
 * quindi il passaggio non è un pedaggio per tutti.
 *
 * Le tessere sono DERIVATE dalla lista `REPARTI`: aggiungerne uno è una riga di
 * dati, non una schermata nuova.
 */
export default async function ScegliReparto() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const nome = session.user.firstName?.trim();

  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <header className="flex h-16 shrink-0 items-center border-b border-line bg-surface px-4 sm:px-6">
        <span className="text-lg font-bold tracking-tight text-ink">
          UFP<span className="font-normal text-ink-subtle">trade</span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-7 sm:px-6 sm:py-12">
        {nome && <p className="text-sm text-ink-subtle">Buongiorno, {nome}</p>}
        <h1 className="mt-1 text-[23px] font-semibold tracking-tight text-ink sm:text-3xl">
          Scegli il reparto
        </h1>

        <div className="mt-5 grid gap-3 sm:mt-7 sm:grid-cols-2 sm:gap-4">
          {REPARTI.map((reparto) => (
            <Link
              key={reparto.slug}
              href={reparto.home}
              className="group relative rounded-lg border border-line-strong bg-surface p-4 pb-11 shadow-card transition-[border-color,box-shadow] duration-150 ease-out-quart hover:border-brand hover:shadow-pop focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:p-5 sm:pb-12"
            >
              <p className="text-xl font-bold tracking-[0.005em] text-ink sm:text-2xl">
                {reparto.nome}
              </p>
              <p className="mt-0.5 text-[13.5px] text-ink-muted">{reparto.mestiere}</p>
              {/* Il marchio sta QUI e non nel titolo: quando entreranno HOPPE,
                  OLIVARI, DND e GHIDINI cresce questa riga, e la tessera non si
                  rinomina mai. */}
              <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-ink-subtle">
                {reparto.marchi.join(" · ")}
              </p>

              <div className="my-3 h-px bg-line" />

              {/* Le sezioni dentro: chi entra la prima volta non deve provare
                  entrambe le tessere per capire dove andare. */}
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {reparto.sezioni.join(" · ")}
              </p>

              <ArrowRight
                className="absolute bottom-3.5 right-4 size-[18px] text-line-strong transition-colors group-hover:text-brand"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
