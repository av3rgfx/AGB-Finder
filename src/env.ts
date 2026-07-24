import { z } from "zod";

/**
 * Server-side environment schema. All app configuration is validated here so a
 * misconfiguration fails fast at boot rather than at first use.
 *
 * Prisma engine paths (PRISMA_QUERY_ENGINE_LIBRARY, PRISMA_SCHEMA_ENGINE_BINARY)
 * and Node's NODE_EXTRA_CA_CERTS are intentionally NOT validated here — they are
 * infrastructure vars consumed directly by Prisma/Node, not app config.
 */
const envSchema = z.object({
  // Database (Neon / local Postgres)
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Auth (NextAuth v4)
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),

  // Redis (Upstash / local)
  REDIS_URL: z.string().min(1),

  // AI providers (optional in Fondamenta — wired in later phases)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  KIMI_API_KEY: z.string().optional(),
  KIMI_MODEL: z.string().default("kimi-k2.6"),

  // Security
  IP_HASH_SECRET: z.string().min(1),
  SETTINGS_ENCRYPTION_KEY: z.string().optional(),

  // Listino su Vercel Blob, pre-splittato in pagine singole (feature «visualizza nel
  // listino», Opzione B). Template dell'URL della paginetta con placeholder «{page}»
  // (es. https://…/listino/page-{page}.pdf) + numero totale di pagine. Entrambe assenti
  // = feature off. Server-only: il client passa sempre e solo da /api/listino.
  LISTINO_PAGE_URL_TEMPLATE: z
    .string()
    .url()
    .refine((v) => v.includes("{page}"), "manca il placeholder {page}")
    .optional(),
  LISTINO_TOTAL_PAGES: z.coerce.number().int().positive().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

/** Parse and validate an environment record. Exported for testing. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = parseEnv(process.env);
