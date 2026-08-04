import { createTRPCRouter } from "@/server/api/trpc";
import { healthRouter } from "@/server/api/routers/health";
import { authRouter } from "@/server/api/routers/auth";
import { userRouter } from "@/server/api/routers/user";
import { productRouter } from "@/server/api/routers/product";
import { chatRouter } from "@/server/api/routers/chat";
import { kitRouter } from "@/server/api/routers/kit";
import { customerRouter } from "@/server/api/routers/customer";
import { dashboardRouter } from "@/server/api/routers/dashboard";
import { settingsRouter } from "@/server/api/routers/settings";
import { articleRouter } from "@/server/api/routers/article";

/** Root tRPC router. Add feature routers here as the app grows. */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  user: userRouter,
  product: productRouter,
  chat: chatRouter,
  kit: kitRouter,
  customer: customerRouter,
  dashboard: dashboardRouter,
  settings: settingsRouter,
  // Reparto maniglie: tabelle proprie, mai `Product`.
  article: articleRouter,
});

export type AppRouter = typeof appRouter;
