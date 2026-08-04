"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Grid2X2,
  LayoutDashboard,
  MessageSquare,
  Package,
  Search,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { NavItem, type NavItemProps } from "./nav-item";
import { HOME_REPARTI, repartoDaPathname } from "@/lib/reparti";

const NAV_SERRAMENTI: NavItemProps[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistente", label: "Assistente", icon: MessageSquare },
  { href: "/archivio", label: "Archivio", icon: Package },
  { href: "/richieste", label: "Richieste Kit", icon: ClipboardList },
  // Fuori dal blocco ADMIN: l'anagrafica è condivisa e il router usa
  // `agentProcedure`. Fino al 2026-07-30 `customer.update`/`delete` esistevano
  // senza una schermata da cui raggiungerli.
  { href: "/clienti", label: "Clienti", icon: Building2 },
];

/**
 * «Catalogo», non «Archivio»: due sezioni con lo stesso nome in due reparti
 * manderebbero l'agente in quello sbagliato, e «Archivio» è già il catalogo AGB
 * del reparto serramenti.
 *
 * E non più «Disponibilità», che era giusto finché la pagina era una casella di
 * ricerca sulla giacenza: «disponibilità» nomina un ATTRIBUTO, e su 3.456 codici
 * quell'attributo è falso 95 volte su 100 (178 articoli in pronta consegna, il
 * 5,2%). L'etichetta prometteva una stanza di cose pronte e contiene un
 * catalogo. La domanda di Andrea non si perde: vive nel pallino di ogni riga,
 * che è dove lui guarda comunque.
 */
const NAV_MANIGLIE: NavItemProps[] = [
  { href: "/maniglie", label: "Catalogo", icon: Search },
];

// Lo storico dei caricamenti vive DENTRO la pagina di import, sotto il
// riepilogo: sono due momenti dello stesso gesto, e una voce di menu in più per
// una tabella nella stessa schermata sarebbe un link a un'ancora travestito da
// sezione.
const NAV_MANIGLIE_ADMIN: NavItemProps[] = [
  { href: "/maniglie/import", label: "Import", icon: Upload },
];

const NAV: Record<string, NavItemProps[]> = {
  serramenti: NAV_SERRAMENTI,
  maniglie: NAV_MANIGLIE,
};

export function Sidebar({ role }: { role: string }) {
  const isAdmin = role === "ADMIN";
  // Il reparto si deduce dall'INDIRIZZO, non da uno stato salvato: un link
  // condiviso mostra sempre il reparto giusto. `usePathname` invece di una prop
  // anche per non rendere obbligatorio un parametro nuovo su ogni chiamante.
  const pathname = usePathname();
  const reparto = repartoDaPathname(pathname ?? "/dashboard");
  const slug = reparto?.slug ?? "serramenti";
  const nav = NAV[slug] ?? NAV_SERRAMENTI;

  return (
    <aside className="flex h-full w-full flex-col bg-surface-sidebar">
      <div className="px-3 pb-2 pt-3">
        <div className="px-2">
          <span className="text-lg font-bold tracking-tight text-white">
            UFP<span className="font-normal text-white/60">trade</span>
          </span>
        </div>

        {/* Dove sei + come si torna indietro, nello stesso posto. Prima qui
            c'era solo il wordmark statico, e non esisteva alcun ritorno: si
            cambiava reparto solo col logout. */}
        {reparto && (
          <Link
            href={HOME_REPARTI}
            className="mt-2.5 flex items-center justify-between gap-2 rounded bg-white/[0.07] px-2.5 py-2 transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-bold tracking-[0.08em] text-white">
                {reparto.nome}
              </span>
              <span className="block text-[10px] text-white/55">Cambia reparto</span>
            </span>
            <Grid2X2 className="size-4 shrink-0 text-white/45" aria-hidden />
          </Link>
        )}
      </div>

      <nav aria-label="Navigazione principale" className="flex flex-1 flex-col gap-1 px-3 py-2">
        {nav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
        {isAdmin &&
          slug === "maniglie" &&
          NAV_MANIGLIE_ADMIN.map((item) => <NavItem key={item.href} {...item} />)}
      </nav>

      {/* Utenti e Impostazioni non appartengono a nessuno dei due reparti: sono
          dell'app. Compaiono in entrambe le sidebar — un link duplicato non è
          una pagina duplicata, e costringere Andrea a passare dai serramenti
          per cambiare una password sarebbe il distacco preso alla lettera
          contro l'utente. */}
      {isAdmin && (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <NavItem href="/utenti" label="Utenti" icon={Users} />
          <NavItem href="/impostazioni" label="Impostazioni" icon={Settings} />
        </div>
      )}
    </aside>
  );
}
