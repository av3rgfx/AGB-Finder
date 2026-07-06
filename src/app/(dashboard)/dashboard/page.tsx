import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/server/auth/config";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = { title: "Dashboard — UFPtrade" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const firstName = session?.user.firstName ?? "";
  const isAdmin = session?.user.role === "ADMIN";
  return <DashboardClient firstName={firstName} isAdmin={isAdmin} />;
}
