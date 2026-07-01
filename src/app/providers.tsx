"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { TRPCReactProvider } from "@/trpc/react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </SessionProvider>
  );
}
