"use client";
import { useState } from "react";
import { api } from "@/trpc/react";
import type { UserRole } from "@/lib/authz";

const ROLE_LABEL: Record<UserRole, string> = { AGENT: "Agente", ADMIN: "Amministratore" };

type UserListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  username?: string | null;
};

export function UtentiClient({ currentUserId }: { currentUserId: string }) {
  const users = api.user.list.useQuery();
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
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
              <th scope="col" className="px-3 py-2 font-medium">Nome</th>
              <th scope="col" className="px-3 py-2 font-medium">Email</th>
              <th scope="col" className="px-3 py-2 font-medium">Ruolo</th>
              <th scope="col" className="px-3 py-2 font-medium">Stato</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} onChanged={utils.refetch}
                onEdit={(u) => { setCreating(false); setEditingUser(u); }} />
            ))}
          </tbody>
        </table>
      </div>

      {creating && <CreateUserForm onClose={() => setCreating(false)} onCreated={() => { setCreating(false); utils.refetch(); }} />}
      {editingUser && (
        <EditUserForm user={editingUser} onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); utils.refetch(); }} />
      )}
    </div>
  );
}

const PLACEHOLDER_EMAIL_DOMAIN = "@no-email.ufptrade.local";

function UserRow({ user, isSelf, onChanged, onEdit }:
  { user: UserListItem; isSelf: boolean; onChanged: () => void; onEdit: (user: UserListItem) => void }) {
  const setActive = api.user.setActive.useMutation({ onSuccess: onChanged });
  const setRole = api.user.setRole.useMutation({ onSuccess: onChanged });
  const del = api.user.delete.useMutation({ onSuccess: onChanged });
  const active = user.status === "ACTIVE";
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-3 py-2 text-ink">{user.firstName} {user.lastName}</td>
      <td className="px-3 py-2 text-ink-muted">
        {user.email.endsWith(PLACEHOLDER_EMAIL_DOMAIN)
          ? <span className="text-ink-subtle">@{user.username} · nessuna email</span>
          : user.email}
      </td>
      <td className="px-3 py-2">{ROLE_LABEL[user.role as UserRole] ?? user.role}</td>
      <td className="px-3 py-2">
        <span className={active ? "text-success" : "text-danger"}>{active ? "Attivo" : "Disattivato"}</span>
      </td>
      <td className="px-3 py-2 text-right">
        {!isSelf && (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onEdit(user)}
              className="rounded border border-line-strong px-2 py-1 text-xs hover:border-brand">
              Modifica
            </button>
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
        {setActive.error && <p role="alert" className="mt-1 text-xs text-danger">{setActive.error.message}</p>}
        {setRole.error && <p role="alert" className="mt-1 text-xs text-danger">{setRole.error.message}</p>}
        {del.error && <p role="alert" className="mt-1 text-xs text-danger">{del.error.message}</p>}
      </td>
    </tr>
  );
}

function ResetPasswordButton({ id }: { id: string }) {
  const reset = api.user.resetPassword.useMutation();
  return (
    <>
      <button type="button"
        onClick={() => { const p = prompt("Nuova password (min 8 caratteri):"); if (p) reset.mutate({ id, password: p }); }}
        className="rounded border border-line-strong px-2 py-1 text-xs hover:border-brand">
        Reset password
      </button>
      {reset.error && <p role="alert" className="mt-1 text-xs text-danger">{reset.error.message}</p>}
    </>
  );
}

function CreateUserForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ email: "", username: "", firstName: "", lastName: "", password: "", role: "AGENT" as UserRole });
  const [formError, setFormError] = useState<string | null>(null);
  const create = api.user.create.useMutation({ onSuccess: onCreated });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleCreate() {
    const email = form.email.trim();
    const username = form.username.trim();
    if (!email && !username) {
      create.reset();
      setFormError("Devi specificare almeno un'email o uno username.");
      return;
    }
    setFormError(null);
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      password: form.password,
      role: form.role,
      ...(email ? { email } : {}),
      ...(username ? { username } : {}),
    };
    create.mutate(payload);
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 font-semibold text-ink">Nuovo utente</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome" id="firstName" value={form.firstName} onChange={set("firstName")} />
        <Field label="Cognome" id="lastName" value={form.lastName} onChange={set("lastName")} />
        <Field label="Email (opzionale)" id="email" type="email" value={form.email} onChange={set("email")} />
        <Field label="Username" id="username" value={form.username} onChange={set("username")} />
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
      <p className="mt-2 text-xs text-ink-subtle">Inserisci almeno un&apos;email o uno username.</p>
      {formError && <p role="alert" className="mt-2 text-sm text-danger">{formError}</p>}
      {create.error && <p role="alert" className="mt-2 text-sm text-danger">{create.error.message}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={create.isPending}
          onClick={handleCreate}
          className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
          {create.isPending ? "Creazione…" : "Crea"}
        </button>
        <button type="button" onClick={onClose} className="rounded border border-line-strong px-3 py-2 text-sm">Annulla</button>
      </div>
    </div>
  );
}

function EditUserForm({ user, onClose, onSaved }:
  { user: UserListItem; onClose: () => void; onSaved: () => void }) {
  const isPlaceholder = user.email.endsWith(PLACEHOLDER_EMAIL_DOMAIN);
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: isPlaceholder ? "" : user.email,
    username: user.username ?? "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const update = api.user.update.useMutation({ onSuccess: onSaved });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSave() {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    const username = form.username.trim();
    if (!firstName || !lastName) {
      update.reset();
      setFormError("Nome e cognome sono obbligatori.");
      return;
    }
    setFormError(null);
    update.mutate({
      id: user.id, firstName, lastName,
      ...(email ? { email } : {}),
      ...(username ? { username } : {}),
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 font-semibold text-ink">Modifica utente</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome" id="edit-firstName" value={form.firstName} onChange={set("firstName")} />
        <Field label="Cognome" id="edit-lastName" value={form.lastName} onChange={set("lastName")} />
        <Field label="Email (opzionale)" id="edit-email" type="email" value={form.email} onChange={set("email")} />
        <Field label="Username" id="edit-username" value={form.username} onChange={set("username")} />
      </div>
      <p className="mt-2 text-xs text-ink-subtle">Lascia vuoto un campo per non modificarlo.</p>
      {formError && <p role="alert" className="mt-2 text-sm text-danger">{formError}</p>}
      {update.error && <p role="alert" className="mt-2 text-sm text-danger">{update.error.message}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={update.isPending}
          onClick={handleSave}
          className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
          {update.isPending ? "Salvataggio…" : "Salva"}
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
