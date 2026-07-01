import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

export const authRouter = createTRPCRouter({
  /** The current authenticated user (from the JWT session). */
  me: authedProcedure.query(({ ctx }) => ctx.session.user),
});
