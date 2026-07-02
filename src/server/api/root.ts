import { createTRPCRouter } from "@/server/api/trpc";
import { healthRouter } from "@/server/api/routers/health";
import { authRouter } from "@/server/api/routers/auth";
import { userRouter } from "@/server/api/routers/user";
import { productRouter } from "@/server/api/routers/product";

/** Root tRPC router. Add feature routers here as the app grows. */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  user: userRouter,
  product: productRouter,
});

export type AppRouter = typeof appRouter;
