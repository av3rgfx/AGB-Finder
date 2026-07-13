import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { auth } from "@/server/auth/config";

const userSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

const PLACEHOLDER_DOMAIN = "no-email.ufptrade.local";

type Ctx = {
  db: typeof import("@/server/db").db;
  session: { user: { id: string } };
  headers: Headers;
};

function assertNotSelf(ctx: { session: { user: { id: string } } }, targetId: string) {
  if (targetId === ctx.session.user.id)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Non puoi eseguire questa operazione sul tuo stesso account.",
    });
}

/** Blocca l'operazione se il target è l'ULTIMO admin attivo (role ADMIN, non bannato, ACTIVE). */
async function assertNotLastActiveAdmin(ctx: Ctx, targetId: string) {
  const target = await ctx.db.user.findUnique({
    where: { id: targetId },
    select: { role: true },
  });
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Utente non trovato." });
  if (target.role !== "ADMIN") return;
  const otherActiveAdmins = await ctx.db.user.count({
    where: { id: { not: targetId }, role: "ADMIN", banned: { not: true }, status: "ACTIVE" },
  });
  if (otherActiveAdmins === 0)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Operazione negata: deve restare almeno un amministratore attivo.",
    });
}

/**
 * User administration. Admin-only — agents never self-register (project rule).
 * Account creation delegates to Better Auth's admin plugin (hashing, account row).
 */
export const userRouter = createTRPCRouter({
  create: adminProcedure
    .input(
      z
        .object({
          email: z.string().email().optional(),
          username: z
            .string()
            .min(3)
            .max(32)
            .regex(/^[a-z0-9._-]+$/i, "Username: lettere, numeri, . _ -")
            .optional(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
          role: z.enum(["AGENT", "ADMIN"]).default("AGENT"),
        })
        .refine((v) => v.email || v.username, { message: "Fornisci almeno un'email o uno username." }),
    )
    .mutation(async ({ ctx, input }) => {
      const username = input.username?.toLowerCase();
      if (username) {
        const clash = await ctx.db.user.findUnique({ where: { username }, select: { id: true } });
        if (clash) throw new TRPCError({ code: "CONFLICT", message: "Username già in uso." });
      }
      const email = input.email ?? `${username}@${PLACEHOLDER_DOMAIN}`;
      const created = await auth.api.createUser({
        headers: ctx.headers,
        body: {
          email,
          password: input.password,
          name: `${input.firstName} ${input.lastName}`,
          role: input.role,
          data: { firstName: input.firstName, lastName: input.lastName },
        },
      });
      if (username) {
        await ctx.db.user.update({
          where: { id: created.user.id },
          data: { username, displayUsername: input.username },
        });
      }
      return created.user;
    }),

  list: adminProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({ select: userSelect, orderBy: { createdAt: "desc" } }),
  ),

  setStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]) }))
    .mutation(({ ctx, input }) =>
      ctx.db.user.update({
        where: { id: input.id },
        data: { status: input.status },
        select: { id: true, status: true },
      }),
    ),

  setRole: adminProcedure
    .input(z.object({ id: z.string(), role: z.enum(["AGENT", "ADMIN"]) }))
    .mutation(async ({ ctx, input }) => {
      assertNotSelf(ctx, input.id);
      if (input.role === "AGENT") await assertNotLastActiveAdmin(ctx, input.id);
      await auth.api.setRole({
        headers: ctx.headers,
        body: { userId: input.id, role: input.role },
      });
      return { id: input.id, role: input.role };
    }),

  setActive: adminProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertNotSelf(ctx, input.id);
      if (!input.active) await assertNotLastActiveAdmin(ctx, input.id);
      if (input.active) {
        await auth.api.unbanUser({ headers: ctx.headers, body: { userId: input.id } });
      } else {
        await auth.api.banUser({ headers: ctx.headers, body: { userId: input.id } });
      }
      const status = input.active ? "ACTIVE" : "INACTIVE";
      await ctx.db.user.update({ where: { id: input.id }, data: { status } });
      return { id: input.id, status };
    }),

  resetPassword: adminProcedure
    .input(
      z.object({
        id: z.string(),
        password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await auth.api.setUserPassword({
        headers: ctx.headers,
        body: { userId: input.id, newPassword: input.password },
      });
      return { id: input.id };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        username: z
          .string()
          .min(3)
          .max(32)
          .regex(/^[a-z0-9._-]+$/i, "Username: lettere, numeri, . _ -")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const username = input.username?.toLowerCase();
      if (input.email) {
        const clash = await ctx.db.user.findFirst({
          where: { email: input.email, id: { not: input.id } },
          select: { id: true },
        });
        if (clash) throw new TRPCError({ code: "CONFLICT", message: "Email già in uso." });
      }
      if (username) {
        const clash = await ctx.db.user.findFirst({
          where: { username, id: { not: input.id } },
          select: { id: true },
        });
        if (clash) throw new TRPCError({ code: "CONFLICT", message: "Username già in uso." });
      }
      return ctx.db.user.update({
        where: { id: input.id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          name: `${input.firstName} ${input.lastName}`,
          ...(input.email ? { email: input.email } : {}),
          ...(username ? { username, displayUsername: input.username } : {}),
        },
        select: { id: true, firstName: true, lastName: true, email: true, username: true },
      });
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    assertNotSelf(ctx, input.id);
    await assertNotLastActiveAdmin(ctx, input.id);
    const [kits, convs, settingsRefs] = await Promise.all([
      ctx.db.kitRequest.count({ where: { agentId: input.id } }),
      ctx.db.conversation.count({ where: { agentId: input.id } }),
      ctx.db.settings.count({ where: { updatedBy: input.id } }),
    ]);
    if (kits > 0 || convs > 0 || settingsRefs > 0)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Utente con record collegati (richieste/conversazioni/impostazioni): disattivalo invece di eliminarlo.",
      });
    await auth.api.removeUser({ headers: ctx.headers, body: { userId: input.id } });
    return { id: input.id };
  }),
});
