import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Accedi — UFPtrade",
  description: "Area riservata agli agenti di Utensilferramenta Pistoiese S.p.A.",
};

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      UFP<span className="font-normal opacity-70">trade</span>
    </span>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_480px]">
      {/* Brand panel — hidden on tablet/mobile (wireframe §2.5) */}
      <aside
        className="relative hidden flex-col items-center justify-center overflow-hidden bg-brand px-12 text-white lg:flex"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <div className="relative flex flex-col items-center text-center">
          <Wordmark className="text-5xl font-bold tracking-tight" />
          <p className="mt-6 max-w-xs text-lg leading-relaxed text-white/90">
            Utensilferramenta Pistoiese S.p.A.
          </p>
          <p className="mt-2 text-sm text-white/70">Ferramenta per serramenti dal 1972</p>
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col justify-center bg-surface-page px-6 py-12 sm:px-14">
        <div className="mx-auto w-full max-w-sm">
          <Wordmark className="mb-8 block text-2xl font-bold tracking-tight text-brand lg:hidden" />

          <h1 className="text-2xl font-bold tracking-tight text-ink">Accedi all&apos;Area Agenti</h1>
          <p className="mb-8 mt-1.5 text-sm text-ink-subtle">
            Inserisci le tue credenziali per continuare.
          </p>

          <Suspense fallback={<div className="h-96" aria-hidden />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
