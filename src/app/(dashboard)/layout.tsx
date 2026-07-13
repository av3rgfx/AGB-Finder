import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { firstName, lastName } = session.user;
  const name = `${firstName} ${lastName}`.trim();
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || name[0]?.toUpperCase() || "?";

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <div className="hidden md:block">
        <Sidebar role={session.user.role ?? "AGENT"} />
      </div>
      <div className="flex min-h-screen flex-col">
        <TopBar name={name} initials={initials} />
        <main className="flex-1 bg-surface-page p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
