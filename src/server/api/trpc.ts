import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { UserRole } from "@/lib/authz";
import type { AuthSession } from "@/server/auth/config";
import { db } from "@/server/db";

/** Request-scoped context shared by every procedure. */
export interface TRPCContext {
  db: typeof db;
  session: AuthSession | null;
  headers: Headers;
}

/** Build the context from an already-resolved session (see the route handler). */
export function createTRPCContext(opts: {
  session: AuthSession | null;
  headers: Headers;
}): TRPCContext {
  return { db, session: opts.session, headers: opts.headers };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Anyone (no auth). */
export const publicProcedure = t.procedure;

/** Requires an authenticated, ACTIVE user; narrows session to non-null. */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Autenticazione richiesta. Effettua il login.",
    });
  }
  if (ctx.session.user.status !== "ACTIVE") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        ctx.session.user.status === "SUSPENDED"
          ? "Account sospeso. Contatta l'amministratore."
          : "Account inattivo.",
    });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** Requires one of the allowed roles (assumes enforceAuth ran first). */
const enforceRole = (roles: readonly UserRole[]) =>
  t.middleware(({ ctx, next }) => {
    const role = ctx.session?.user?.role;
    if (!role) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Autenticazione richiesta." });
    }
    if (!(roles as readonly string[]).includes(role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Ruolo '${role}' non autorizzato per questa operazione.`,
      });
    }
    return next();
  });

/** Any authenticated ACTIVE user. */
export const authedProcedure = t.procedure.use(enforceAuth);

/** AGENT or ADMIN. */
export const agentProcedure = t.procedure.use(enforceAuth).use(enforceRole(["AGENT", "ADMIN"]));

/** ADMIN only. */
export const adminProcedure = t.procedure.use(enforceAuth).use(enforceRole(["ADMIN"]));
