import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";

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
      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Email già registrata." });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      return ctx.db.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          passwordHash,
        },
        select: userSelect,
      });
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
