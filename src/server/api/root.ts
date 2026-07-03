import { createTRPCRouter } from "@/server/api/trpc";
import { healthRouter } from "@/server/api/routers/health";
import { authRouter } from "@/server/api/routers/auth";
import { userRouter } from "@/server/api/routers/user";
import { productRouter } from "@/server/api/routers/product";
import { chatRouter } from "@/server/api/routers/chat";

/** Root tRPC router. Add feature routers here as the app grows. */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  user: userRouter,
  product: productRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
