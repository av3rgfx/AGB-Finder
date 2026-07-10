import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { getRedis } from "@/server/ai/redis";
import { testProviderKey } from "@/server/ai/test-connection";
import { getStatus, resolveApiKey, setApiKey, type AiProvider } from "@/server/settings/service";

const providerSchema = z.enum(["gemini", "kimi"]);
const ALL_PROVIDERS: AiProvider[] = ["gemini", "kimi"];

export const settingsRouter = createTRPCRouter({
  aiKeys: createTRPCRouter({
    status: adminProcedure.query(({ ctx }) =>
      Promise.all(ALL_PROVIDERS.map((provider) => getStatus(ctx.db, provider))),
    ),

    testConnection: adminProcedure
      .input(z.object({ provider: providerSchema, apiKey: z.string().min(1).optional() }))
      .mutation(async ({ ctx, input }) => {
        const key = input.apiKey ?? (await resolveApiKey(ctx.db, input.provider));
        if (!key) return { ok: false as const, error: "Nessuna key configurata per questo provider" };
        return testProviderKey(input.provider, key);
      }),

    set: adminProcedure
      .input(z.object({ provider: providerSchema, apiKey: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const result = await testProviderKey(input.provider, input.apiKey);
        if (!result.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error ?? "Test di connessione fallito" });
        }
        await setApiKey(ctx.db, getRedis(), input.provider, input.apiKey, ctx.session.user.id);
        return getStatus(ctx.db, input.provider);
      }),
  }),
});
