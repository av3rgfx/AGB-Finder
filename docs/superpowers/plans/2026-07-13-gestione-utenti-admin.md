# Gestione utenti (admin) + login username/password — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sezione admin-only `/utenti` per creare e gestire gli account (Fase A) + login con username per account anche senza email (Fase B).

**Architecture:** Estende il `userRouter` tRPC esistente (già `create`/`list`/`setStatus`, tutte `adminProcedure`) con le mutation di gestione, delegando al **plugin admin di Better Auth** (`auth.api.*`). Nuova pagina server-gated `/utenti` (pattern di `/impostazioni`) + client che consuma `api.user.*`. Fase B aggiunge il plugin `username` + email-segnaposto.

**Tech Stack:** Next.js 15 · React 19 · TypeScript strict · tRPC v11 · Better Auth 1.6.23 (plugin `admin`, `username`) · Prisma 6/Postgres · Vitest (+ jsdom) · Tailwind · pnpm 10.

## Global Constraints
- **RBAC**: ogni operazione via `adminProcedure` (= `enforceAuth` + `enforceRole(["ADMIN"])`). Pagina `/utenti` server-gated `role === "ADMIN"` (redirect `/dashboard`), come `src/app/(dashboard)/impostazioni/page.tsx`.
- **Anti-lockout** (lato server): nessun admin può disattivare/eliminare/declassare **sé stesso** né **l'ultimo ADMIN attivo** (`role:"ADMIN"`, `banned != true`, `status:"ACTIVE"`).
- **Disattivazione = hard**: `banUser` (blocca login + revoca sessioni) **e** `status:"INACTIVE"` (già applicato a livello tRPC da `enforceAuth`, `trpc.ts:51`). Riattiva = `unbanUser` + `status:"ACTIVE"`.
- **`delete` prudente**: consentito solo se l'utente ha **0** `kitRequests` e **0** `conversations`; altrimenti `TRPCError` `CONFLICT`.
- **API admin Better Auth** (verificate in `node_modules/better-auth/dist/plugins/admin/admin.d.mts`): `auth.api.setRole({headers, body:{userId, role}})`, `banUser({headers, body:{userId}})`, `unbanUser({headers, body:{userId}})`, `setUserPassword({headers, body:{userId, newPassword}})`, `removeUser({headers, body:{userId}})`, `createUser({headers, body:{email, password, name, role, data}})`. Passare sempre `headers: ctx.headers`.
- **UI in italiano**, stile coerente con `impostazioni-client.tsx` (token `border-line`, `bg-surface`, `text-ink`, `brand`, hook `api.*`).
- **Deterministico** dove serve; nessuna migrazione in Fase A; **una** migrazione in Fase B (username). pnpm 10. Test: `set -a; source .env; set +a; pnpm exec vitest run <path>`.

## File Structure
**Fase A** — Modifica: `src/server/api/routers/user.ts`, `src/server/api/routers/user.test.ts`, `src/components/layout/sidebar.tsx`, `src/app/(dashboard)/layout.tsx`. Crea: `src/app/(dashboard)/utenti/page.tsx`, `src/app/(dashboard)/utenti/utenti-client.tsx`, `src/app/(dashboard)/utenti/utenti-client.test.tsx`.
**Fase B** — Modifica: `src/server/auth/config.ts`, `src/lib/auth-client.ts`, `prisma/schema.prisma` (+migrazione), `src/components/auth/login-form.tsx`, `src/server/api/routers/user.ts` (+test), `utenti-client.tsx` (+test). Crea: migrazione username.

---

# FASE A — Sezione admin (rilasciabile da sola)

## Task A1: userRouter — anti-lockout helper + `setRole` + `setActive`

**Files:**
- Modify: `src/server/api/routers/user.ts`
- Test: `src/server/api/routers/user.test.ts`

**Interfaces:**
- Consumes: `adminProcedure`, `auth.api.setRole/banUser/unbanUser`, `ctx.db`, `ctx.session.user.id`, `ctx.headers`.
- Produces: `user.setRole({ id, role })`, `user.setActive({ id, active })`.

- [ ] **Step 1: Scrivi i test (RED)**

In `src/server/api/routers/user.test.ts` — leggi prima il file per riusare il pattern esistente (mock `auth`, caller `adminProcedure`). Aggiungi (adatta gli helper di mock già presenti; se il file mocka `@/server/auth/config`, estendi il mock con `setRole`/`banUser`/`unbanUser`):

```ts
// Assumi un helper esistente `callerAs(user)` che costruisce il caller tRPC con una
// session ADMIN e un db mockato/di test. Se non esiste, crealo sul modello dei test
// vicini (vedi dashboard.test.ts per il pattern di caller+ctx).
describe("user.setRole", () => {
  it("declassa un ADMIN se resta un altro admin attivo", async () => {
    // db con 2 admin attivi; target = admin #2
    const res = await caller.user.setRole({ id: "u2", role: "AGENT" });
    expect(res).toEqual({ id: "u2", role: "AGENT" });
    expect(setRoleApi).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: "u2", role: "AGENT" } }),
    );
  });
  it("BLOCCA il declassamento dell'ultimo admin attivo", async () => {
    // db con 1 solo admin attivo (= target)
    await expect(caller.user.setRole({ id: "uAdminUnico", role: "AGENT" })).rejects.toThrow(
      /almeno un amministratore/i,
    );
  });
  it("BLOCCA l'operazione su sé stessi", async () => {
    await expect(caller.user.setRole({ id: SELF_ID, role: "AGENT" })).rejects.toThrow(
      /tuo stesso account/i,
    );
  });
});

describe("user.setActive", () => {
  it("disattiva → banUser + status INACTIVE", async () => {
    const res = await caller.user.setActive({ id: "u2", active: false });
    expect(banApi).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: "u2" } }));
    expect(res.status).toBe("INACTIVE");
  });
  it("riattiva → unbanUser + status ACTIVE", async () => {
    const res = await caller.user.setActive({ id: "u2", active: true });
    expect(unbanApi).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: "u2" } }));
    expect(res.status).toBe("ACTIVE");
  });
  it("BLOCCA disattivare l'ultimo admin attivo e sé stessi", async () => {
    await expect(caller.user.setActive({ id: "uAdminUnico", active: false })).rejects.toThrow();
    await expect(caller.user.setActive({ id: SELF_ID, active: false })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Esegui i test — falliscono** (`Cannot read setRole`/route assente)

Run: `set -a; source .env; set +a; pnpm exec vitest run src/server/api/routers/user.test.ts`
Expected: FAIL (route inesistenti).

- [ ] **Step 3: Aggiungi l'helper anti-lockout + le mutation in `user.ts`**

In cima (dopo gli import) aggiungi `TRPCError`:
```ts
import { TRPCError } from "@trpc/server";
```

Aggiungi gli helper (sopra `export const userRouter`):
```ts
type Ctx = { db: typeof import("@/server/db").db; session: { user: { id: string } }; headers: Headers };

function assertNotSelf(ctx: { session: { user: { id: string } } }, targetId: string) {
  if (targetId === ctx.session.user.id)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Non puoi eseguire questa operazione sul tuo stesso account.",
    });
}

/** Blocca l'operazione se il target è l'ULTIMO admin attivo (role ADMIN, non bannato, ACTIVE). */
async function assertNotLastActiveAdmin(ctx: Ctx, targetId: string) {
  const target = await ctx.db.user.findUnique({
    where: { id: targetId },
    select: { role: true },
  });
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Utente non trovato." });
  if (target.role !== "ADMIN") return;
  const otherActiveAdmins = await ctx.db.user.count({
    where: { id: { not: targetId }, role: "ADMIN", banned: { not: true }, status: "ACTIVE" },
  });
  if (otherActiveAdmins === 0)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Operazione negata: deve restare almeno un amministratore attivo.",
    });
}
```

Aggiungi le due mutation dentro `createTRPCRouter({ ... })` (dopo `setStatus`):
```ts
  setRole: adminProcedure
    .input(z.object({ id: z.string(), role: z.enum(["AGENT", "ADMIN"]) }))
    .mutation(async ({ ctx, input }) => {
      assertNotSelf(ctx, input.id);
      if (input.role === "AGENT") await assertNotLastActiveAdmin(ctx, input.id);
      await auth.api.setRole({ headers: ctx.headers, body: { userId: input.id, role: input.role } });
      return { id: input.id, role: input.role };
    }),

  setActive: adminProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertNotSelf(ctx, input.id);
      if (!input.active) await assertNotLastActiveAdmin(ctx, input.id);
      if (input.active) {
        await auth.api.unbanUser({ headers: ctx.headers, body: { userId: input.id } });
      } else {
        await auth.api.banUser({ headers: ctx.headers, body: { userId: input.id } });
      }
      const status = input.active ? "ACTIVE" : "INACTIVE";
      await ctx.db.user.update({ where: { id: input.id }, data: { status } });
      return { id: input.id, status };
    }),
```

- [ ] **Step 4: Esegui i test — passano.** Run come Step 2. Expected: PASS.

- [ ] **Step 5: typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/server/api/routers/user.ts src/server/api/routers/user.test.ts
git commit -m "feat(users): setRole + setActive (ban) con paletti anti-lockout"
```

## Task A2: userRouter — `resetPassword` + `update` + `delete`

**Files:** Modify `src/server/api/routers/user.ts`, `src/server/api/routers/user.test.ts`
**Interfaces:** Produces `user.resetPassword({ id, password })`, `user.update({ id, firstName, lastName })`, `user.delete({ id })`. Consumes helper `assertNotSelf`/`assertNotLastActiveAdmin` (Task A1), `auth.api.setUserPassword/removeUser`.

- [ ] **Step 1: Test (RED)** in `user.test.ts`:
```ts
describe("user.resetPassword", () => {
  it("imposta una nuova password (min 8) via admin API", async () => {
    await caller.user.resetPassword({ id: "u2", password: "nuovapass1" });
    expect(setPwApi).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: "u2", newPassword: "nuovapass1" } }),
    );
  });
  it("rifiuta password < 8", async () => {
    await expect(caller.user.resetPassword({ id: "u2", password: "corta" })).rejects.toThrow();
  });
});
describe("user.update", () => {
  it("aggiorna nome/cognome e ricompone name", async () => {
    const res = await caller.user.update({ id: "u2", firstName: "Mario", lastName: "Rossi" });
    expect(res.firstName).toBe("Mario");
    // db.update chiamato con name "Mario Rossi"
    expect(updateArgs.data).toMatchObject({ firstName: "Mario", lastName: "Rossi", name: "Mario Rossi" });
  });
});
describe("user.delete", () => {
  it("elimina se 0 record collegati", async () => {
    // count kitRequests=0, conversations=0
    await caller.user.delete({ id: "u2" });
    expect(removeApi).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: "u2" } }));
  });
  it("BLOCCA (CONFLICT) se ha record collegati", async () => {
    // count kitRequests>0
    await expect(caller.user.delete({ id: "u3" })).rejects.toThrow(/record collegati|disattiv/i);
  });
  it("BLOCCA sé stessi e ultimo admin", async () => {
    await expect(caller.user.delete({ id: SELF_ID })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Esegui — falliscono.** Run: `... vitest run src/server/api/routers/user.test.ts`.

- [ ] **Step 3: Implementa in `user.ts`** (dentro il router):
```ts
  resetPassword: adminProcedure
    .input(z.object({ id: z.string(), password: z.string().min(8, "La password deve avere almeno 8 caratteri") }))
    .mutation(async ({ ctx, input }) => {
      await auth.api.setUserPassword({
        headers: ctx.headers,
        body: { userId: input.id, newPassword: input.password },
      });
      return { id: input.id };
    }),

  update: adminProcedure
    .input(z.object({ id: z.string(), firstName: z.string().min(1), lastName: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      ctx.db.user.update({
        where: { id: input.id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          name: `${input.firstName} ${input.lastName}`,
        },
        select: { id: true, firstName: true, lastName: true },
      }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertNotSelf(ctx, input.id);
      await assertNotLastActiveAdmin(ctx, input.id);
      const [kits, convs] = await Promise.all([
        ctx.db.kitRequest.count({ where: { agentId: input.id } }),
        ctx.db.conversation.count({ where: { agentId: input.id } }),
      ]);
      if (kits > 0 || convs > 0)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Utente con record collegati (richieste/conversazioni): disattivalo invece di eliminarlo.",
        });
      await auth.api.removeUser({ headers: ctx.headers, body: { userId: input.id } });
      return { id: input.id };
    }),
```
> **FK confermati** (`prisma/schema.prisma`): `KitRequest.agentId` (riga 255, relazione `KitRequestAgent`) e `Conversation.agentId` (riga 392) — **entrambi** `agentId` verso `User`. `ActivityLog`/`Settings` non bloccano l'eliminazione (log/impostazioni), coerente col perimetro.

- [ ] **Step 4: Esegui — passano.** typecheck.
- [ ] **Step 5: Commit**
```bash
git add src/server/api/routers/user.ts src/server/api/routers/user.test.ts
git commit -m "feat(users): resetPassword + update(nome) + delete (guardato record collegati)"
```

## Task A3: Pagina `/utenti` (server-gated) + `utenti-client.tsx`

**Files:** Create `src/app/(dashboard)/utenti/page.tsx`, `src/app/(dashboard)/utenti/utenti-client.tsx`, `src/app/(dashboard)/utenti/utenti-client.test.tsx`.
**Interfaces:** Consumes `api.user.list/create/setRole/setActive/resetPassword/update/delete`, `auth.api.getSession`.

- [ ] **Step 1: `page.tsx`** (server component, gate ADMIN — mirror `impostazioni/page.tsx`):
```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { UtentiClient } from "./utenti-client";

export default async function UtentiPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Utenti</h1>
        <p className="mt-1 text-sm text-ink-subtle">Crea e gestisci gli account degli agenti e degli amministratori.</p>
      </header>
      <UtentiClient currentUserId={session.user.id} />
    </div>
  );
}
```

- [ ] **Step 2: Test UI (RED)** — `utenti-client.test.tsx` (jsdom, mirror `nuova-client.test.tsx` per il mock di `@/trpc/react`):
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

const listData = [
  { id: "u1", email: "admin@x.it", firstName: "Adele", lastName: "Admin", role: "ADMIN", status: "ACTIVE", createdAt: new Date() },
  { id: "u2", email: "mario@x.it", firstName: "Mario", lastName: "Rossi", role: "AGENT", status: "ACTIVE", createdAt: new Date() },
];
const createMut = vi.fn(); const setActiveMut = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: {
    user: {
      list: { useQuery: () => ({ data: listData, isPending: false, isError: false, refetch: vi.fn() }) },
      create: { useMutation: () => ({ mutate: createMut, isPending: false, error: null }) },
      setActive: { useMutation: () => ({ mutate: setActiveMut, isPending: false }) },
      setRole: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      resetPassword: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
      delete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
    },
  },
}));
import { UtentiClient } from "./utenti-client";
afterEach(cleanup);

describe("UtentiClient", () => {
  it("elenca gli utenti con ruolo e stato", () => {
    render(<UtentiClient currentUserId="u1" />);
    expect(screen.getByText("mario@x.it")).toBeTruthy();
    expect(screen.getByText(/Rossi/)).toBeTruthy();
  });
  it("apre il form Nuovo utente e crea", () => {
    render(<UtentiClient currentUserId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /nuovo utente/i }));
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "new@x.it" } });
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Nuo" } });
    fireEvent.change(screen.getByLabelText(/cognome/i), { target: { value: "Vo" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /crea/i }));
    expect(createMut).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@x.it", firstName: "Nuo", lastName: "Vo", password: "password1", role: "AGENT" }),
    );
  });
  it("non mostra azioni distruttive sul proprio account", () => {
    render(<UtentiClient currentUserId="u1" />);
    const rows = screen.getAllByRole("row");
    const selfRow = rows.find((r) => within(r).queryByText("admin@x.it"));
    expect(within(selfRow!).queryByRole("button", { name: /elimina/i })).toBeNull();
  });
});
```

- [ ] **Step 3: `utenti-client.tsx`** — tabella + azioni + form. Stile coerente con `impostazioni-client.tsx`. (Componente completo; l'implementer può rifinire lo stile mantenendo i token esistenti — `border-line`, `bg-surface`, `text-ink`, `brand`, `danger`.)
```tsx
"use client";
import { useState } from "react";
import { api } from "@/trpc/react";

type Role = "AGENT" | "ADMIN";
const ROLE_LABEL: Record<Role, string> = { AGENT: "Agente", ADMIN: "Amministratore" };

export function UtentiClient({ currentUserId }: { currentUserId: string }) {
  const users = api.user.list.useQuery();
  const [creating, setCreating] = useState(false);
  const utils = { refetch: () => void users.refetch() };

  if (users.isPending) return <p className="text-sm text-ink-subtle">Caricamento…</p>;
  if (users.isError)
    return <p role="alert" className="rounded border border-danger/30 bg-danger/5 p-4 text-sm text-danger">Errore nel caricamento degli utenti.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setCreating(true)}
          className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Nuovo utente
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-ink-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Ruolo</th>
              <th className="px-3 py-2 font-medium">Stato</th>
              <th className="px-3 py-2 font-medium text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} onChanged={utils.refetch} />
            ))}
          </tbody>
        </table>
      </div>

      {creating && <CreateUserForm onClose={() => setCreating(false)} onCreated={() => { setCreating(false); utils.refetch(); }} />}
    </div>
  );
}

function UserRow({ user, isSelf, onChanged }:
  { user: { id: string; email: string; firstName: string; lastName: string; role: Role; status: string }; isSelf: boolean; onChanged: () => void }) {
  const setActive = api.user.setActive.useMutation({ onSuccess: onChanged });
  const setRole = api.user.setRole.useMutation({ onSuccess: onChanged });
  const del = api.user.delete.useMutation({ onSuccess: onChanged });
  const active = user.status === "ACTIVE";
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-3 py-2 text-ink">{user.firstName} {user.lastName}</td>
      <td className="px-3 py-2 text-ink-muted">{user.email}</td>
      <td className="px-3 py-2">{ROLE_LABEL[user.role]}</td>
      <td className="px-3 py-2">
        <span className={active ? "text-success" : "text-danger"}>{active ? "Attivo" : "Disattivato"}</span>
      </td>
      <td className="px-3 py-2 text-right">
        {!isSelf && (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setActive.mutate({ id: user.id, active: !active })}
              className="rounded border border-line-strong px-2 py-1 text-xs hover:border-brand">
              {active ? "Disattiva" : "Attiva"}
            </button>
            <button type="button" onClick={() => setRole.mutate({ id: user.id, role: user.role === "ADMIN" ? "AGENT" : "ADMIN" })}
              className="rounded border border-line-strong px-2 py-1 text-xs hover:border-brand">
              {user.role === "ADMIN" ? "→ Agente" : "→ Admin"}
            </button>
            <ResetPasswordButton id={user.id} />
            <button type="button"
              onClick={() => { if (confirm(`Eliminare ${user.firstName} ${user.lastName}?`)) del.mutate({ id: user.id }); }}
              className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/5">
              Elimina
            </button>
          </div>
        )}
        {del.error && <p role="alert" className="mt-1 text-xs text-danger">{del.error.message}</p>}
      </td>
    </tr>
  );
}

function ResetPasswordButton({ id }: { id: string }) {
  const reset = api.user.resetPassword.useMutation();
  return (
    <button type="button"
      onClick={() => { const p = prompt("Nuova password (min 8 caratteri):"); if (p) reset.mutate({ id, password: p }); }}
      className="rounded border border-line-strong px-2 py-1 text-xs hover:border-brand">
      Reset password
    </button>
  );
}

function CreateUserForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", password: "", role: "AGENT" as Role });
  const create = api.user.create.useMutation({ onSuccess: onCreated });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 font-semibold text-ink">Nuovo utente</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome" id="firstName" value={form.firstName} onChange={set("firstName")} />
        <Field label="Cognome" id="lastName" value={form.lastName} onChange={set("lastName")} />
        <Field label="Email" id="email" type="email" value={form.email} onChange={set("email")} />
        <Field label="Password" id="password" type="password" value={form.password} onChange={set("password")} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm text-ink-muted">Ruolo</label>
          <select id="role" value={form.role} onChange={set("role")}
            className="h-11 rounded border border-line-strong bg-surface px-3 text-sm text-ink">
            <option value="AGENT">Agente</option>
            <option value="ADMIN">Amministratore</option>
          </select>
        </div>
      </div>
      {create.error && <p role="alert" className="mt-2 text-sm text-danger">{create.error.message}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={create.isPending}
          onClick={() => create.mutate(form)}
          className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
          {create.isPending ? "Creazione…" : "Crea"}
        </button>
        <button type="button" onClick={onClose} className="rounded border border-line-strong px-3 py-2 text-sm">Annulla</button>
      </div>
    </div>
  );
}

function Field({ label, id, value, onChange, type = "text" }:
  { label: string; id: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-muted">{label}</label>
      <input id={id} type={type} value={value} onChange={onChange}
        className="h-11 rounded border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none" />
    </div>
  );
}
```

- [ ] **Step 4: Esegui i test UI — passano.** Run: `pnpm exec vitest run "src/app/(dashboard)/utenti/utenti-client.test.tsx"`. Expected: PASS.
- [ ] **Step 5: typecheck + commit**
```bash
git add "src/app/(dashboard)/utenti"
git commit -m "feat(users): pagina /utenti admin-gated con tabella, azioni e form nuovo utente"
```

## Task A4: Nav — sezione admin (Utenti + Impostazioni) gated sul ruolo

**Files:** Modify `src/components/layout/sidebar.tsx`, `src/app/(dashboard)/layout.tsx`.
**Interfaces:** `Sidebar` accetta `role: string`.

- [ ] **Step 1: `layout.tsx`** — passa il ruolo:
Sostituisci `<Sidebar />` con `<Sidebar role={session.user.role} />` (la session è già risolta in `layout.tsx:9`).

- [ ] **Step 2: `sidebar.tsx`** — aggiungi `Users` (lucide) all'import e rendi la sezione admin condizionale:
```tsx
import { LayoutDashboard, MessageSquare, Package, ClipboardList, Settings, Users } from "lucide-react";
```
Cambia la firma e la sezione in fondo:
```tsx
export function Sidebar({ role }: { role: string }) {
  const isAdmin = role === "ADMIN";
  return (
    <aside className="flex h-full w-full flex-col bg-surface-sidebar">
      {/* …header + PRIMARY_NAV invariati… */}
      {isAdmin && (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <NavItem href="/utenti" label="Utenti" icon={Users} />
          <NavItem href="/impostazioni" label="Impostazioni" icon={Settings} />
        </div>
      )}
    </aside>
  );
}
```
> Nota: prima la voce «Impostazioni» era visibile a tutti (la pagina reindirizzava i non-admin). Ora la sezione admin (Utenti + Impostazioni) compare solo agli admin — miglioria coerente col perimetro.

- [ ] **Step 3: typecheck + lint + suite completa + build**
Run: `pnpm typecheck && pnpm lint && (set -a; source .env; set +a; pnpm exec vitest run) && pnpm build`. Expected: verde.
- [ ] **Step 4: Commit**
```bash
git add src/components/layout/sidebar.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat(users): voce nav Utenti + sezione admin gated sul ruolo"
```

> **✅ Milestone Fase A**: sezione admin completa e rilasciabile. (Possibile PR/merge qui prima della Fase B.)

---

# FASE B — Username / account senza email

## Task B1: Plugin `username` (auth server+client) + migrazione schema

**Files:** Modify `src/server/auth/config.ts`, `src/lib/auth-client.ts`, `prisma/schema.prisma`. Create migrazione.
**Interfaces:** aggiunge `user.username`, `user.displayUsername` (nullable, unique); `authClient.signIn.username`.

- [ ] **Step 1: `config.ts`** — importa e registra il plugin (PRIMA di `nextCookies()`, che resta ultimo):
```ts
import { admin, username } from "better-auth/plugins";
```
```ts
  plugins: [
    admin({ ac, roles, defaultRole: "AGENT", adminRoles: ["ADMIN"] }),
    username(),
    nextCookies(), // deve restare l'ultimo plugin
  ],
```

- [ ] **Step 2: `auth-client.ts`** — aggiungi `usernameClient`:
```ts
import { adminClient, usernameClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({ plugins: [adminClient(), usernameClient()] });
```

- [ ] **Step 3: `schema.prisma`** — nel model `User` aggiungi (dopo `image`):
```prisma
  username        String?  @unique
  displayUsername String?  @map("display_username")
```
e un indice: `@@index([username])`.

- [ ] **Step 4: genera la migrazione** (senza DB, come Fase 1g):
```bash
set -a; source .env; set +a
pnpm exec prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma.bak \
  --to-schema-datamodel prisma/schema.prisma --script > /tmp/username.sql
```
> In pratica: fai `cp prisma/schema.prisma prisma/schema.prisma.bak` PRIMA della Step 3, poi `migrate diff` produce l'`ALTER TABLE "user" ADD COLUMN "username" ... UNIQUE` + `display_username`. Crea la cartella `prisma/migrations/<timestamp>_username/migration.sql` col contenuto generato, rimuovi il `.bak`. Verifica il nome tabella reale (`user`) nel SQL. **Non** applicare qui (Neon via ops al deploy).
Poi: `pnpm exec prisma generate`.

- [ ] **Step 5: verifica typecheck + suite** (il client Prisma ora ha `username`). Commit:
```bash
git add src/server/auth/config.ts src/lib/auth-client.ts prisma/schema.prisma prisma/migrations
git commit -m "feat(auth): plugin username Better Auth + migrazione username/displayUsername"
```

## Task B2: `create`/`update`/`list` con username + email-segnaposto

**Files:** Modify `src/server/api/routers/user.ts`, `src/server/api/routers/user.test.ts`.
**Interfaces:** `create` accetta `email?`, `username?` (almeno uno); `list`/`update` includono `username`.

- [ ] **Step 1: Test (RED)** in `user.test.ts`:
```ts
describe("user.create (username / senza email)", () => {
  it("con username e senza email → sintetizza email-segnaposto e passa username", async () => {
    await caller.user.create({ username: "mrossi", firstName: "Mario", lastName: "Rossi", password: "password1", role: "AGENT" });
    expect(createUserApi).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ email: "mrossi@no-email.ufptrade.local" }),
    }));
    // username impostato sull'utente creato
    expect(updateArgs.data).toMatchObject({ username: "mrossi", displayUsername: "mrossi" });
  });
  it("rifiuta se manca sia email sia username", async () => {
    await expect(caller.user.create({ firstName: "A", lastName: "B", password: "password1", role: "AGENT" })).rejects.toThrow(/email o username/i);
  });
});
```

- [ ] **Step 2: Esegui — falliscono.**

- [ ] **Step 3: Implementa** — aggiorna `create` in `user.ts`:
```ts
const PLACEHOLDER_DOMAIN = "no-email.ufptrade.local";

  create: adminProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        username: z.string().min(3).max(32).regex(/^[a-z0-9._-]+$/i, "Username: lettere, numeri, . _ -").optional(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
        role: z.enum(["AGENT", "ADMIN"]).default("AGENT"),
      }).refine((v) => v.email || v.username, { message: "Fornisci almeno un'email o uno username." }),
    )
    .mutation(async ({ ctx, input }) => {
      const username = input.username?.toLowerCase();
      if (username) {
        const clash = await ctx.db.user.findUnique({ where: { username }, select: { id: true } });
        if (clash) throw new TRPCError({ code: "CONFLICT", message: "Username già in uso." });
      }
      const email = input.email ?? `${username}@${PLACEHOLDER_DOMAIN}`;
      const created = await auth.api.createUser({
        headers: ctx.headers,
        body: { email, password: input.password, name: `${input.firstName} ${input.lastName}`, role: input.role,
          data: { firstName: input.firstName, lastName: input.lastName } },
      });
      if (username) {
        await ctx.db.user.update({ where: { id: created.user.id }, data: { username, displayUsername: input.username } });
      }
      return created.user;
    }),
```
> **Verifica nel task**: se `auth.api.createUser` accetta già `username` nel `body`/`data` (dipende da come il plugin espone il campo), preferiscilo all'`update` successivo. In ogni caso l'`update` è il fallback sicuro.

Aggiorna `userSelect` (aggiungi `username: true`) e permetti `username` in `update` (con lo stesso check unicità).

- [ ] **Step 4: Esegui — passano.** typecheck. Commit:
```bash
git add src/server/api/routers/user.ts src/server/api/routers/user.test.ts
git commit -m "feat(users): create/update/list con username + email-segnaposto per account senza email"
```

## Task B3: Login email-o-username + form create con email opzionale/username

**Files:** Modify `src/components/auth/login-form.tsx`, `src/app/(dashboard)/utenti/utenti-client.tsx` (+ test).
**Interfaces:** login accetta email o username; form create ha campo username + email opzionale.

- [ ] **Step 1: `login-form.tsx`** — generalizza il campo. Rinomina label/placeholder a «Email o username», togli il vincolo `EMAIL_RE` come *blocco* (resta solo per decidere il metodo), e nel submit:
```ts
    const id = email.trim();
    const isEmail = EMAIL_RE.test(id);
    const { error } = isEmail
      ? await authClient.signIn.email({ email: id, password, rememberMe: remember })
      : await authClient.signIn.username({ username: id, password, rememberMe: remember });
```
Aggiorna la validazione: `if (!id) errors.email = "Inserisci email o username."` (togli il test EMAIL_RE bloccante). Label → «Email o username»; `autoComplete="username"` resta.

- [ ] **Step 2: `utenti-client.tsx` (create form)** — email **opzionale** + campo **username**; validazione «almeno uno» lato client + hint. Aggiungi `username` allo state e ai `Field`, rendi l'email non obbligatoria, e passa `username` (se valorizzato) a `create.mutate`. Aggiorna il test del form: creare con solo username (email vuota) chiama `create.mutate` con `{ username: "...", ... }` senza `email`.

- [ ] **Step 3: `utenti-client.tsx` (tabella)** — colonna email: mostra l'email vera **oppure** `@username` con «(nessuna email)» quando l'email finisce per `@no-email.ufptrade.local`:
```tsx
{u.email.endsWith("@no-email.ufptrade.local") ? <span className="text-ink-subtle">@{u.username} · nessuna email</span> : u.email}
```

- [ ] **Step 4: gate completi + commit**
Run: `pnpm typecheck && pnpm lint && (set -a; source .env; set +a; pnpm exec vitest run) && pnpm build`.
```bash
git add "src/components/auth/login-form.tsx" "src/app/(dashboard)/utenti"
git commit -m "feat(auth): login con email o username + form utenti con email opzionale/username"
```

---

## Note di chiusura (post-plan, in finishing)
- Aggiornare `handoff.md` + `CLAUDE.md` STATO.
- Correggere nella spec la frase sul `status` (è enforced a livello tRPC, non «per niente»): il ban aggiunge blocco login + revoca sessioni.
- **Al deploy**: applicare la migrazione username a Neon (`migrate deploy` via ops-neon) — Fase B.
- Valutare (fuori scope) un self-service «cambia la tua password» per gli agenti.

## Self-Review
- **Spec coverage**: sezione admin /utenti (A3/A4) ✅; create/list esistenti + setRole/setActive/resetPassword/update/delete (A1/A2) ✅; anti-lockout self+ultimo-admin (A1/A2) ✅; delete guardato record collegati (A2) ✅; disattiva=ban+status (A1) ✅; username plugin+migrazione (B1) ✅; email-segnaposto (B2) ✅; login email-o-username (B3) ✅; due fasi (A milestone) ✅.
- **Placeholder scan**: i «verifica nel task» sono passi d'azione concreti (nomi FK per il count; se createUser accetta username), non placeholder; il resto è codice completo.
- **Type consistency**: `assertNotSelf`/`assertNotLastActiveAdmin` definiti in A1 e usati in A2; `userId`/`newPassword`/`role`/`active`/`id` coerenti tra router/test/UI; `Sidebar({role})` coerente tra layout e sidebar; `username` coerente tra schema/router/UI/login.
