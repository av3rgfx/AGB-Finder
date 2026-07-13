"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { User, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REMEMBER_KEY = "ufp:email";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({});
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) setEmail(saved);
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const id = email.trim();
    const errors: { email?: string; password?: string } = {};
    if (!id) errors.email = "Inserisci email o username.";
    if (!password) errors.password = "Inserisci la password.";
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    const isEmail = EMAIL_RE.test(id);
    const { error } = isEmail
      ? await authClient.signIn.email({ email: id, password, rememberMe: remember })
      : await authClient.signIn.username({ username: id, password, rememberMe: remember });
    setLoading(false);

    if (error) {
      setError("Credenziali non valide.");
      return;
    }

    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, id);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignore */
    }

    router.replace(params.get("callbackUrl") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink-muted">
          Email o username
        </label>
        <Input
          id="email"
          type="text"
          autoComplete="username"
          placeholder="nome@utensilferramenta.it oppure username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={Boolean(fieldError.email)}
          aria-describedby={fieldError.email ? "email-error" : undefined}
          leadingIcon={<User className="size-5" aria-hidden />}
          disabled={loading}
        />
        {fieldError.email && (
          <p id="email-error" className="text-sm text-danger">
            {fieldError.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink-muted">
          Password
        </label>
        <Input
          id="password"
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={Boolean(fieldError.password)}
          aria-describedby={fieldError.password ? "password-error" : undefined}
          leadingIcon={<Lock className="size-5" aria-hidden />}
          disabled={loading}
          trailingSlot={
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Nascondi password" : "Mostra password"}
              className="grid size-8 place-items-center rounded text-ink-subtle transition-colors hover:text-ink"
            >
              {showPw ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          }
        />
        {fieldError.password && (
          <p id="password-error" className="text-sm text-danger">
            {fieldError.password}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 rounded border-line-strong text-brand accent-brand"
          />
          Ricordami
        </label>
        <button
          type="button"
          onClick={() => setForgotOpen((v) => !v)}
          className="text-sm font-medium text-brand transition-colors hover:text-brand-dark hover:underline"
        >
          Password dimenticata?
        </button>
      </div>

      {forgotOpen && (
        <p className="rounded border border-line bg-surface-sunken px-3.5 py-2.5 text-sm text-ink-muted">
          Contatta l&apos;amministratore per reimpostare la password.
        </p>
      )}

      <Button type="submit" loading={loading} className="w-full">
        {loading ? "Accesso in corso…" : "Accedi"}
      </Button>

      <div className="relative py-1 text-center">
        <span className="absolute inset-x-0 top-1/2 -z-10 border-t border-line" aria-hidden />
        <span className="bg-surface-page px-3 text-xs text-ink-subtle">oppure</span>
      </div>

      <a
        href="mailto:admin@utensilferramenta.it?subject=Richiesta%20accesso%20UFPtrade"
        className={cn(
          "inline-flex h-11 w-full items-center justify-center rounded border border-line-strong bg-surface text-sm font-medium text-ink transition-colors hover:bg-surface-sunken",
        )}
      >
        Richiedi accesso (contatta l&apos;amministratore)
      </a>
    </form>
  );
}
