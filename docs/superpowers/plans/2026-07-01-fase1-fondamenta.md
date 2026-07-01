# Fase 1 — Fondamenta (UFPtrade) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **UI/UX tasks (Task 8, 9, 10) MUST be developed through the `impeccable` skill** (standing project instruction). **Any architectural doubt or inconsistency encountered during execution MUST be routed through the `llm-council` skill** (standing project instruction).

**Goal:** Build the foundation ("Fondamenta") of the UFPtrade B2B webapp — project scaffolding, full database schema, authentication (NextAuth Credentials + JWT + RBAC), tRPC core, login page, and the agent dashboard shell — so an admin-seeded agent can log in and land on a protected dashboard.

**Architecture:** Next.js 15 App Router (single app, route groups `(auth)`/`(dashboard)`) with a hard server boundary under `src/server/`. tRPC v11 is the only client↔server transport; Prisma is the only DB access layer. Auth is stateless (NextAuth v4 Credentials provider, JWT session read in the tRPC context and in Edge middleware). RBAC is enforced by layered tRPC procedures (`public` → `authed` → `agent` → `admin`).

**Tech Stack:** Next.js 15, React 19, TypeScript (strict), tRPC v11, `@tanstack/react-query` v5, Prisma 6 + PostgreSQL 16 + pgvector, NextAuth v4, `bcryptjs`, `zod`, `superjson`, Tailwind CSS 3.4, `lucide-react`, Vitest. Package manager: `pnpm`. App root = repo root `/home/user/AGB-Finder/`.

## Global Constraints

Copied verbatim from the design docs and the LLM Council verdict (2026-07-01). Every task's requirements implicitly include this section.

- **TypeScript strict mode always** (`"strict": true`, plus `noUncheckedIndexedAccess`).
- **All API calls through tRPC** — never `fetch` directly from the client.
- **All DB queries through Prisma** — never raw SQL except in migrations and the one hybrid-search `$queryRaw` (Fase 1b, out of scope here).
- **Kit generation is a deterministic TypeScript engine — never LLM.** (Out of scope for Fondamenta; do not scaffold LLM kit logic.)
- **Single-agent AI with tool-use**, dual provider Gemini (primary) + Kimi (fallback). (Out of scope here.)
- **Every AI call goes through BullMQ** with rate limiting + circuit breaker. (Out of scope here.)
- **Italian language for ALL UI text.**
- **Product codes always in monospace font** (JetBrains Mono).
- **Admin creates all accounts — no self-registration** for agents.
- **RBAC roles:** `PUBLIC` → `AGENT` → `ADMIN`.
- **Auth = NextAuth v4** (`next-auth@^4.24.11`), Credentials + JWT (8h session), **NO PrismaAdapter**, `bcryptjs` (not `bcrypt`).
- **pgvector embedding column = `vector(768)`**, dimension centralized in one constant `EMBEDDING_DIM = 768`.
- **Directory structure = detailed T3 layout**; server-only code under `src/server/` (guarded with `import "server-only"`), client tRPC under `src/trpc/`.
- **Design tokens:** Brand Orange `#E86824` (dark `#C4551A`, light `#FEF0E6`); warm neutrals N900 `#1A1714` … N50 `#FAF9F7`; Inter (UI) + JetBrains Mono (codes); light theme; dark sidebar `#1A1714`.
- Every task ends green: `pnpm typecheck && pnpm lint && pnpm test` (and `pnpm build` for the final task).

---

## Council Decisions Baked In (2026-07-01)

1. **NextAuth v4** (not Auth.js v5 beta) — pinned `^4.24.11` with a React 19 peer override. Session read via `getServerSession(authOptions)`.
2. **No `PrismaAdapter`** — pure Credentials + JWT; `bcryptjs`; no `Account`/`Session`/`VerificationToken` models.
3. **`vector(768)`** — corrects the doc's `vector(1536)`; `EMBEDDING_DIM = 768` single source of truth.
4. **Detailed `src/server/api/...` layout** — server boundary under `src/server/`, `env.ts` with zod, thin `src/middleware.ts`.

> **Open decision for the user:** auth version (v4 per council vs v5/Better Auth). Plan assumes **v4**. If switched to v5, only Tasks 4, 5, 7 auth wiring change (`auth()` helper replaces `getServerSession`); the rest is identical.

---

## File Structure

```
/  (repo root = app root)
├── package.json, pnpm-lock.yaml, tsconfig.json, next.config.mjs,
│   tailwind.config.ts, postcss.config.mjs, .eslintrc.json, .prettierrc,
│   vitest.config.ts, .env.example, .env, .gitignore, docker-compose.yml, Dockerfile.dev
├── prisma/
│   ├── schema.prisma            # 12 models (Task 3) — embedding vector(768)
│   ├── migrations/…             # init migration + pgvector/tsvector SQL (Task 3)
│   └── seed.ts                  # admin + base categories (Task 11)
├── src/
│   ├── env.ts                   # zod-validated env (Task 2)
│   ├── middleware.ts            # Edge route protection via getToken (Task 7)
│   ├── app/
│   │   ├── layout.tsx           # root: fonts + Providers (Task 6/8)
│   │   ├── providers.tsx        # SessionProvider + tRPC/React Query (Task 6)
│   │   ├── globals.css          # design tokens / Tailwind layers (Task 8)
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts   # NextAuth handler (Task 4)
│   │   │   └── trpc/[trpc]/route.ts          # tRPC fetch adapter (Task 6)
│   │   ├── (auth)/login/page.tsx             # login (Task 9, impeccable)
│   │   └── (dashboard)/
│   │       ├── layout.tsx                    # guarded shell (Task 10, impeccable)
│   │       └── dashboard/page.tsx            # dashboard home skeleton (Task 10)
│   ├── server/
│   │   ├── db.ts                # Prisma singleton, server-only (Task 3)
│   │   ├── auth/config.ts       # NextAuthOptions, no adapter (Task 4)
│   │   ├── api/
│   │   │   ├── trpc.ts          # init + createTRPCContext + procedures (Task 5)
│   │   │   ├── root.ts          # appRouter (Task 5)
│   │   │   └── routers/
│   │   │       ├── health.ts    # ping (Task 5)
│   │   │       ├── auth.ts      # me (Task 6)
│   │   │       └── user.ts      # admin-create agent (Task 6)
│   │   └── constants/embedding.ts   # EMBEDDING_MODEL, EMBEDDING_DIM=768 (Task 3)
│   ├── trpc/
│   │   ├── react.tsx            # client tRPC (Task 6)
│   │   └── query-client.ts      # shared QueryClient (Task 6)
│   ├── components/
│   │   ├── ui/{button,input,cn}.tsx         # primitives (Task 8, impeccable)
│   │   └── layout/{sidebar,topbar}.tsx      # shell (Task 10, impeccable)
│   ├── lib/utils.ts            # cn(), formatters (Task 8)
│   └── types/next-auth.d.ts    # Session/JWT/User augmentation (Task 4)
└── tests/… (co-located *.test.ts preferred; Vitest)
```

---

## Task 1: Repo scaffolding, tooling & strict TypeScript

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml` (omit — single package), `tsconfig.json`, `next.config.mjs`, `.eslintrc.json`, `.prettierrc`, `.gitignore`, `vitest.config.ts`, `postcss.config.mjs`
- Create: `src/app/layout.tsx` (minimal placeholder), `src/app/page.tsx` (redirect to `/login`)

**Interfaces:**
- Produces: working `pnpm dev`/`build`/`typecheck`/`lint`/`test` scripts; `@/*` path alias → `src/*`.

- [ ] **Step 1: Initialize package.json** with pinned deps and scripts.

```jsonc
{
  "name": "ufptrade",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "next": "15.3.0", "react": "19.1.0", "react-dom": "19.1.0",
    "next-auth": "^4.24.11", "bcryptjs": "^3.0.2",
    "@prisma/client": "^6.5.0",
    "@trpc/server": "^11.0.0", "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0", "@tanstack/react-query": "^5.66.0",
    "zod": "^3.24.0", "superjson": "^2.2.2", "lucide-react": "^0.475.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0", "@types/node": "^22.0.0",
    "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0",
    "@types/bcryptjs": "^2.4.6",
    "prisma": "^6.5.0", "tsx": "^4.19.0",
    "tailwindcss": "^3.4.17", "postcss": "^8.5.0", "autoprefixer": "^10.4.20",
    "eslint": "^9.18.0", "eslint-config-next": "15.3.0",
    "prettier": "^3.4.0", "prettier-plugin-tailwindcss": "^0.6.0",
    "vitest": "^3.0.0"
  },
  "pnpm": { "overrides": { "next-auth>react": "$react", "next-auth>react-dom": "$react-dom" } }
}
```

- [ ] **Step 2: tsconfig.json** — strict mode + path alias.

```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom","dom.iterable","ES2022"],
    "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noUncheckedIndexedAccess": true, "noEmit": true,
    "esModuleInterop": true, "resolveJsonModule": true, "isolatedModules": true,
    "jsx": "preserve", "incremental": true, "skipLibCheck": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: next.config.mjs, eslint, prettier, gitignore, vitest.config.ts, postcss.config.mjs** (concrete minimal configs). `.gitignore` includes `node_modules`, `.next`, `.env`, `/coverage`. `vitest.config.ts` sets `environment: "node"` and the `@` alias via `vite-tsconfig-paths` or manual `resolve.alias`.

- [ ] **Step 4: Placeholder `src/app/layout.tsx` + `src/app/page.tsx`** (`page.tsx` → `redirect("/login")`).

- [ ] **Step 5: Install & verify.** Run `pnpm install`, then `pnpm typecheck` (expect PASS, 0 errors) and `pnpm lint` (expect PASS).

- [ ] **Step 6: Commit** — `chore: scaffold Next.js 15 + TS strict + tooling`.

---

## Task 2: Environment validation (`src/env.ts`)

**Files:** Create `src/env.ts`, `.env.example`, `.env`; Test `src/env.test.ts`.

**Interfaces:** Produces `env` object with typed `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `REDIS_URL`, `GEMINI_API_KEY?`, `KIMI_API_KEY?`, `IP_HASH_SECRET`, `NODE_ENV`.

- [ ] **Step 1: Write failing test** `src/env.test.ts` — a `parseEnv(raw)` helper throws on missing `NEXTAUTH_SECRET`, and returns a typed object when all required vars present.

```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";
describe("parseEnv", () => {
  it("throws when NEXTAUTH_SECRET missing", () => {
    expect(() => parseEnv({ DATABASE_URL: "postgres://x", DIRECT_URL: "postgres://x",
      NEXTAUTH_URL: "http://localhost:3000", REDIS_URL: "redis://x", IP_HASH_SECRET: "s" }))
      .toThrow();
  });
  it("parses a valid env", () => {
    const e = parseEnv({ DATABASE_URL: "postgres://x", DIRECT_URL: "postgres://x",
      NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: "at-least-32-chars-xxxxxxxxxxxxxx",
      REDIS_URL: "redis://x", IP_HASH_SECRET: "s", NODE_ENV: "test" });
    expect(e.NEXTAUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
```

- [ ] **Step 2: Run** `pnpm test src/env.test.ts` → FAIL (`parseEnv` not defined).
- [ ] **Step 3: Implement `src/env.ts`** — zod schema, `parseEnv(raw)` exported for testing, `export const env = parseEnv(process.env)`. `NEXTAUTH_SECRET` min 32; AI keys optional.
- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Write `.env.example`** (all vars from ARCHITETTURA §7.3) and a local `.env` (dev values for docker-compose Postgres/Redis; generate secrets with `openssl rand -base64 32`).
- [ ] **Step 6: Commit** — `feat: add zod-validated env config`.

---

## Task 3: Prisma schema, embedding constant, DB client & initial migration

**Files:** Create `prisma/schema.prisma`, `src/server/db.ts`, `src/server/constants/embedding.ts`, `docker-compose.yml`, `Dockerfile.dev`; migration under `prisma/migrations/`. Test `src/server/db.test.ts` (smoke).

**Interfaces:**
- Produces: Prisma client `db` (`import { db } from "@/server/db"`), all 12 models, enums (`UserRole`, `UserStatus`, `KitRequestStatus`, `WindowType`, `MaterialType`, `HingeSide`, `OpeningDirection`, `ConversationStatus`, `MessageRole`, `MessageStatus`, `ActivityType`, `SettingCategory`, `SyncStatus`), `EMBEDDING_DIM = 768`.

- [ ] **Step 1: `docker-compose.yml`** — `ankane/pgvector:latest` (Postgres, `utpistoia` db) + `redis:7-alpine`, matching ARCHITETTURA §7.2. Run `docker compose up -d`; verify `pg_isready`.
- [ ] **Step 2: `src/server/constants/embedding.ts`**

```ts
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIM = 768; // MUST equal vector(N) in schema.prisma
```

- [ ] **Step 3: `prisma/schema.prisma`** — copy the full schema verbatim from `ufptrade/ARCHITETTURA_COMPLETA.md` §2.1, with **exactly these corrections**:
  - `generator client` → add `output` optional; keep `previewFeatures = ["postgresqlExtensions"]`.
  - `datasource db` → `extensions = [vector]` (map name `vector`).
  - **`Product.embedding` → `Unsupported("vector(768)")?`** (was 1536). Update the comment to `// gemini-embedding-001 @ 768 dims`.
  - Do **not** add `Account`/`Session`/`VerificationToken` models (no adapter).
  - Keep all `@@index`, `@@map`, GIN/HNSW index declarations.
- [ ] **Step 4: `src/server/db.ts`** — server-only Prisma singleton.

```ts
import "server-only";
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ log: ["error","warn"] });
if (process.env.NODE_ENV !== "production") g.prisma = db;
```

- [ ] **Step 5: Create migration** — `pnpm prisma migrate dev --name init`. Then hand-augment the generated migration SQL with the pgvector/tsvector setup from ARCHITETTURA §2.2/§2.3: `CREATE EXTENSION IF NOT EXISTS vector;`, Italian text-search config, the `update_product_search_vector()` trigger. Re-run `prisma migrate dev` to apply.
- [ ] **Step 6: Smoke test `src/server/db.test.ts`** — connects and `db.user.count()` returns `0` (requires docker Postgres). Mark as integration; run `pnpm test`.
- [ ] **Step 7: Verify** `pnpm prisma generate && pnpm typecheck` → PASS.
- [ ] **Step 8: Commit** — `feat: prisma schema (12 models), pgvector(768), db client, init migration`.

---

## Task 4: NextAuth v4 config (no adapter) + type augmentation + handler

**Files:** Create `src/server/auth/config.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/[...nextauth]/route.ts`. Test `src/server/auth/config.test.ts`.

**Interfaces:**
- Produces: `authOptions: NextAuthOptions`; augmented `Session.user` with `{ id, role, status, firstName, lastName }`. Consumed by Tasks 5, 6, 7.

- [ ] **Step 1: Failing test** `src/server/auth/config.test.ts` — extract the `authorize` logic into a testable `authorizeUser(creds, deps)` where `deps = { findUser, compare }`. Cases: (a) missing creds → `null`; (b) user not found → `null`; (c) `status !== "ACTIVE"` → `null`; (d) bad password → `null`; (e) valid → returns `{ id, email, role, status, firstName, lastName }`.

```ts
import { describe, it, expect, vi } from "vitest";
import { authorizeUser } from "./config";
const base = { id:"u1", email:"a@b.it", passwordHash:"h", role:"AGENT",
  status:"ACTIVE", firstName:"Anna", lastName:"Bianchi" };
describe("authorizeUser", () => {
  it("rejects suspended users", async () => {
    const res = await authorizeUser({ email:"a@b.it", password:"x" },
      { findUser: vi.fn().mockResolvedValue({ ...base, status:"SUSPENDED" }),
        compare: vi.fn().mockResolvedValue(true) });
    expect(res).toBeNull();
  });
  it("returns the safe user on valid credentials", async () => {
    const res = await authorizeUser({ email:"a@b.it", password:"ok" },
      { findUser: vi.fn().mockResolvedValue(base), compare: vi.fn().mockResolvedValue(true) });
    expect(res).toMatchObject({ id:"u1", role:"AGENT" });
    expect((res as any).passwordHash).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `src/server/auth/config.ts`** — `import "server-only"`; export `authorizeUser` (pure, injected deps) and `authOptions` (NO adapter; `session.strategy="jwt"`, `maxAge` 8h, `updateAge` 1h; CredentialsProvider whose `authorize` calls `authorizeUser` with real `db.user.findUnique` + `bcryptjs.compare`; `jwt`/`session` callbacks copying `id/role/status/firstName/lastName`; `pages.signIn="/login"`; `events.signIn`/`signOut` → `db.activityLog.create`).
- [ ] **Step 4: `src/types/next-auth.d.ts`** — augment `Session`, `User`, and `next-auth/jwt` `JWT` with the extra fields (required under strict mode).
- [ ] **Step 5: `src/app/api/auth/[...nextauth]/route.ts`** — `const handler = NextAuth(authOptions); export { handler as GET, handler as POST };`
- [ ] **Step 6: Run test + typecheck** → PASS.
- [ ] **Step 7: Commit** — `feat: NextAuth v4 credentials auth (no adapter), typed session`.

---

## Task 5: tRPC core — init, context, RBAC procedures, root router

**Files:** Create `src/server/api/trpc.ts`, `src/server/api/root.ts`, `src/server/api/routers/health.ts`. Test `src/server/api/trpc.test.ts`.

**Interfaces:**
- Produces: `createTRPCContext`, `createCallerFactory`, `publicProcedure`, `authedProcedure`, `agentProcedure`, `adminProcedure`, `createTRPCRouter`, `appRouter`, `AppRouter` type. Consumed by Tasks 6, 7.

- [ ] **Step 1: Failing test** `src/server/api/trpc.test.ts` — build a tiny router with `adminProcedure.query(()=>"ok")` and call via `createCallerFactory` with fabricated contexts: (a) no session → `UNAUTHORIZED`; (b) session role `AGENT` → `FORBIDDEN`; (c) role `ADMIN` → `"ok"`; and `agentProcedure` allows both `AGENT` and `ADMIN`.

```ts
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure, createCallerFactory } from "./trpc";
const router = createTRPCRouter({ secret: adminProcedure.query(() => "ok") });
const call = (session: any) =>
  createCallerFactory(router)({ db: {} as any, session });
describe("adminProcedure", () => {
  it("rejects anonymous", async () => {
    await expect(call(null).secret()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("rejects non-admin", async () => {
    await expect(call({ user: { role: "AGENT", status: "ACTIVE" } }).secret())
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("allows admin", async () => {
    expect(await call({ user: { role: "ADMIN", status: "ACTIVE" } }).secret()).toBe("ok");
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `src/server/api/trpc.ts`** — `initTRPC.context<...>().create({ transformer: superjson })`; `createTRPCContext({ req, session })` returning `{ db, session }` (session param injectable for tests; production path uses `getServerSession(authOptions)`); `enforceAuth` middleware (throws `UNAUTHORIZED` if no `session.user`, `FORBIDDEN` if `status!=="ACTIVE"`); `enforceRole(roles)` middleware; export the four procedures + `createTRPCRouter` + `createCallerFactory`.
- [ ] **Step 4: `src/server/api/routers/health.ts`** — `ping: publicProcedure.query(()=>({ ok:true, ts:Date.now() }))`. `src/server/api/root.ts` — `appRouter = createTRPCRouter({ health: healthRouter })` + export `AppRouter`.
- [ ] **Step 5: Run test + typecheck** → PASS.
- [ ] **Step 6: Commit** — `feat: tRPC core with layered RBAC procedures`.

---

## Task 6: tRPC HTTP handler + React/Server clients + Providers + auth/user routers

**Files:** Create `src/app/api/trpc/[trpc]/route.ts`, `src/trpc/react.tsx`, `src/trpc/query-client.ts`, `src/app/providers.tsx`, `src/server/api/routers/auth.ts`, `src/server/api/routers/user.ts`. Modify `src/server/api/root.ts`, `src/app/layout.tsx`. Test `src/server/api/routers/user.test.ts`.

**Interfaces:**
- Produces: client `api` (tRPC React hooks), `auth.me` query, `user.create` mutation (admin-only, hashes password with bcryptjs).

- [ ] **Step 1: Failing test** `user.test.ts` — `user.create` called by an `ADMIN` caller with `{ email, firstName, lastName, password, role }` calls `db.user.create` with a **bcrypt hash** (not the plaintext) and never returns `passwordHash`; called by an `AGENT` caller → `FORBIDDEN`. Use `createCallerFactory` with a mocked `db`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement routers.** `auth.ts` → `me: authedProcedure.query(({ctx})=>ctx.session.user)`. `user.ts` → `create: adminProcedure.input(zodSchema).mutation(...)` hashing with `bcryptjs.hash(pw,12)`, `list: adminProcedure.query(...)`, `setStatus: adminProcedure...`. Add both to `appRouter`.
- [ ] **Step 4: HTTP handler** `src/app/api/trpc/[trpc]/route.ts` — `fetchRequestHandler` wiring `createTRPCContext` with `getServerSession(authOptions)`.
- [ ] **Step 5: Client** `src/trpc/query-client.ts` (shared `QueryClient` w/ superjson), `src/trpc/react.tsx` (`createTRPCReact<AppRouter>()`, `TRPCReactProvider` with `httpBatchLink` + superjson). `src/app/providers.tsx` — wrap `SessionProvider` + `TRPCReactProvider`. Wire into `src/app/layout.tsx`.
- [ ] **Step 6: Run test + typecheck** → PASS.
- [ ] **Step 7: Commit** — `feat: tRPC HTTP handler, React client, providers, auth/user routers`.

---

## Task 7: Edge middleware route protection

**Files:** Create `src/middleware.ts`. Test `src/middleware.test.ts` (matcher/logic unit).

**Interfaces:** Produces route guard: unauthenticated → redirect `/login`; authenticated non-admin hitting `/admin/*` → redirect `/dashboard`.

- [ ] **Step 1: Failing test** — extract a pure `decideRedirect({ pathname, token })` returning `null | string`; cases: no token on `/dashboard` → `/login`; `AGENT` token on `/admin` → `/dashboard`; `ADMIN` on `/admin` → `null`; any token on `/login` → `/dashboard`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `src/middleware.ts`** — export `decideRedirect` (pure) + `middleware` using `getToken({ req, secret })` (Edge-safe, **no Prisma/bcrypt**), applying `decideRedirect`; `export const config = { matcher: ["/dashboard/:path*","/admin/:path*","/login"] }`.
- [ ] **Step 4: Run test + typecheck** → PASS.
- [ ] **Step 5: Commit** — `feat: edge middleware route protection`.

---

## Task 8: Design tokens + base UI primitives  ⚠️ use `impeccable`

**Files:** Create `src/app/globals.css`, `tailwind.config.ts`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`. Modify `src/app/layout.tsx` (fonts). Test `src/components/ui/button.test.tsx` (optional render test).

**Interfaces:** Produces `cn()`, `<Button variant>`, `<Input>` matching DESIGN.md; CSS variables for the full palette; `next/font` Inter + JetBrains Mono (`--font-sans`, `--font-mono`).

- [ ] **Step 1: Invoke the `impeccable` skill** to design the token layer + primitives against DESIGN.md (colors, radii 6/8/12, elevation, motion 150ms).
- [ ] **Step 2:** `tailwind.config.ts` — map brand/neutral/semantic tokens, `fontFamily.sans/mono`, radius, shadows. `globals.css` — CSS vars + base layer (bg `#FAF9F7`, text `#1A1714`).
- [ ] **Step 3:** `src/lib/utils.ts` `cn()` (clsx + tailwind-merge). `Button` (primary/secondary/ghost/danger) and `Input` (label, icon slots, focus ring orange) per DESIGN.md §Components.
- [ ] **Step 4: Wire fonts** in `layout.tsx`; verify `pnpm build` renders and `pnpm typecheck` PASS.
- [ ] **Step 5: Commit** — `feat: design tokens + Button/Input primitives (impeccable)`.

---

## Task 9: Login page  ⚠️ use `impeccable`

**Files:** Create `src/app/(auth)/login/page.tsx`, `src/components/auth/login-form.tsx`. Test `src/components/auth/login-form.test.tsx`.

**Interfaces:** Consumes `signIn("credentials")`, `<Button>/<Input>`. Produces the split-screen login (BrandPanel + FormPanel) from wireframe §2.

- [ ] **Step 1: Invoke `impeccable`** for the login layout (grid `1fr 480px`, brand panel `#E86824` hidden on tablet, form panel, password toggle, "Ricordami", error banner) — all copy in Italian.
- [ ] **Step 2: Failing test** `login-form.test.tsx` — invalid email shows the Italian validation message and does **not** call `signIn`; valid submit calls `signIn` with `{ redirect:false, email, password }`; a returned `error` renders "Email o password errate." (mock `next-auth/react`).
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** `login-form.tsx` (client, zod validate, `signIn`, loading/error states) + `login/page.tsx` (server, layout). Font monospace not needed here.
- [ ] **Step 5: Run test + typecheck** → PASS.
- [ ] **Step 6: Commit** — `feat: login page + credentials form (impeccable)`.

---

## Task 10: Dashboard shell (sidebar + topbar + home skeleton)  ⚠️ use `impeccable`

**Files:** Create `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/topbar.tsx`, `src/components/layout/nav-item.tsx`. Test `src/components/layout/sidebar.test.tsx`.

**Interfaces:** Consumes `getServerSession(authOptions)`. Produces the guarded shell from wireframe §3 (dark sidebar 240px: Dashboard, Chat AI, Archivio, Richieste Kit, Impostazioni; topbar 64px search + notifiche + UserMenu).

- [ ] **Step 1: Invoke `impeccable`** for the shell (sidebar `#1A1714`, active nav `rgba(232,104,36,0.12)`/`#E86824`, topbar, avatar initials) — Italian labels; responsive collapse note.
- [ ] **Step 2: Failing test** `sidebar.test.tsx` — renders the 5 Italian nav labels and marks the active item from the current path.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** `layout.tsx` (server-guard: `if (!session) redirect("/login")`), `sidebar.tsx`/`topbar.tsx`/`nav-item.tsx`, and a `dashboard/page.tsx` skeleton (stat-card grid placeholders — real data is Fase 1e). Product codes, when shown, use `font-mono`.
- [ ] **Step 5: Run test + typecheck** → PASS.
- [ ] **Step 6: Commit** — `feat: dashboard shell (sidebar/topbar) with server guard (impeccable)`.

---

## Task 11: Database seed (admin + base categories)

**Files:** Create `prisma/seed.ts`. Modify `package.json` (`prisma.seed`). Test `prisma/seed.test.ts` (unit of the pure helper).

**Interfaces:** Produces an idempotent seed: one `ADMIN` user (email/password from env, bcrypt-hashed) + a handful of base `ProductCategory` rows.

- [ ] **Step 1: Failing test** — a pure `buildAdminData({ email, password, hash })` returns `{ email, role:"ADMIN", status:"ACTIVE", passwordHash: <hashed> }` and never stores plaintext.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `prisma/seed.ts`** — `buildAdminData` + a `main()` using `db.user.upsert` (idempotent by email) and `db.productCategory.upsert` for base categories; read admin creds from env (fail loudly if unset).
- [ ] **Step 4: Run** `pnpm db:seed` against docker Postgres; verify admin exists (`prisma studio`). Run unit test → PASS.
- [ ] **Step 5: Commit** — `feat: idempotent DB seed (admin + base categories)`.

---

## Task 12: End-to-end foundation verification

**Files:** none (verification + docs). Optionally create `README.md` (dev quickstart) and a `SessionStart` hook (via `session-start-hook` skill) so web sessions can run `pnpm typecheck`/`test`.

- [ ] **Step 1:** `docker compose up -d` → `pnpm db:migrate` → `pnpm db:seed`.
- [ ] **Step 2:** `pnpm dev`; manually verify: `/` → `/login`; wrong creds → Italian error; seeded admin login → `/dashboard` shell renders; direct `/dashboard` while logged-out → `/login`.
- [ ] **Step 3:** Run the full gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green.
- [ ] **Step 4:** (Optional) `README.md` quickstart + `session-start-hook`.
- [ ] **Step 5: Commit** — `chore: foundation e2e verification + dev docs`.

---

## Acceptance Criteria (maps to ARCHITETTURA §8.2 Fase 1a)

- `docker compose up` starts Postgres(pgvector)+Redis without errors.
- `prisma migrate dev` applies cleanly (incl. pgvector extension + tsvector trigger).
- Seeded admin logs in (JWT session); wrong credentials rejected with Italian message.
- tRPC middleware blocks unauthenticated access (`UNAUTHORIZED`) and wrong-role access (`FORBIDDEN`); admin sees `/admin`, agent does not.
- Dashboard shell renders per wireframe §3; all UI copy in Italian; product-code font is monospace.
- Green: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Out of Scope (later phases — do NOT build now)

Catalog import + hybrid search + embeddings generation (1b) · AI chat/RAG/tools (1c) · Kit deterministic engine (1d) · dashboard live data & full responsive polish (1e) · Vercel/Neon/Upstash deploy + CI (1f) · BullMQ queues/workers, PDF, email, analytics, admin panels (Fase 2). The `embedding vector(768)` column is created now but left null until 1b.
