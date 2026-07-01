import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { auth } from "@/server/auth/config";

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

/**
 * User administration. Admin-only — agents never self-register (project rule).
 * Account creation delegates to Better Auth's admin plugin (hashing, account row).
 */
export const userRouter = createTRPCRouter({
  create: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
        role: z.enum(["AGENT", "ADMIN"]).default("AGENT"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await auth.api.createUser({
        headers: ctx.headers,
        body: {
          email: input.email,
          password: input.password,
          name: `${input.firstName} ${input.lastName}`,
          role: input.role,
          data: { firstName: input.firstName, lastName: input.lastName },
        },
      });
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
});
