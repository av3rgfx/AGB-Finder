import { createTRPCRouter } from "@/server/api/trpc";
import { healthRouter } from "@/server/api/routers/health";
import { authRouter } from "@/server/api/routers/auth";
import { userRouter } from "@/server/api/routers/user";

/** Root tRPC router. Add feature routers here as the app grows. */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
