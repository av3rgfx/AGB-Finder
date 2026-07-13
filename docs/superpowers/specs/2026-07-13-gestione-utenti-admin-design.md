# Gestione utenti (admin) + login username/password — Design

**Data:** 2026-07-13 · **Stato:** design approvato dall'utente ·
**Auth:** Better Auth 1.6.23 (plugin `admin`, ruoli AGENT/ADMIN) · **UI:** italiano

## Contesto (stato attuale)

- **Auth = Better Auth** (email/password, `disableSignUp` — solo admin creano account,
  sessioni DB 8h con revoca, plugin `admin` con ruoli custom AGENT/ADMIN via access-control).
  Config: `src/server/auth/config.ts`; client `src/lib/auth-client.ts` (`adminClient()`).
  Var d'ambiente ancora chiamate `NEXTAUTH_URL`/`NEXTAUTH_SECRET` (residuo migrazione, funzionali).
- **Backend gestione utenti già parziale** — `src/server/api/routers/user.ts` (tutte `adminProcedure`):
  - `create` (email, firstName, lastName, password ≥8, role) → delega a `auth.api.createUser`;
  - `list` (elenco utenti);
  - `setStatus` (ACTIVE/INACTIVE/SUSPENDED) — **NON applicato al login** (vedi sotto).
- **Model `User`** (`prisma/schema.prisma`): `email` (unique), `firstName`, `lastName`,
  `role` ("AGENT"|"ADMIN"), `status` ("ACTIVE"|"INACTIVE"|"SUSPENDED"), campi admin-plugin
  `banned`/`banReason`/`banExpires`. Relazioni: `sessions`, `accounts`, `conversations`,
  `kitRequests` (`KitRequestAgent`), `activityLogs`, `settings`. **Nessuno `username`.**
- **RBAC**: `adminProcedure = enforceAuth + enforceRole(["ADMIN"])` (`src/server/api/trpc.ts`).
- **Pagina admin di riferimento**: `/impostazioni` (`src/app/(dashboard)/impostazioni/page.tsx`)
  — server component che fa `auth.api.getSession` → redirect `/login` se non loggato,
  redirect `/dashboard` se `role !== "ADMIN"`, poi rende un client component.
- **Non esiste** una pagina `/utenti`.
- **GAP di sicurezza**: `status` non è controllato al login → «disattivare» un utente con
  `setStatus` NON gli impedisce di accedere. Il **ban** di Better Auth (campo `banned`) invece
  blocca il login e revoca le sessioni.

## Obiettivo

1. Una **sezione admin-only `/utenti`** per creare e gestire gli account (agenti/admin):
   crea, elenca, cambia ruolo, attiva/disattiva (con revoca reale), reset password, modifica,
   elimina.
2. Poter creare account con **username + password** oltre che email + password, **incluso il
   caso di account senza email** (alcuni agenti non ne hanno).

## Decisioni approvate

- **(a) Username = Approccio A**: plugin `username` di Better Auth + email-segnaposto per gli
  account senza email vera.
- **(b) `delete`**: elimina **solo** se l'utente non ha record collegati; altrimenti l'azione
  rimanda a «disattiva» (nessuna perdita di dati storici).
- **(c) Due fasi** in un'unica spec: **Fase A** (sezione admin, rilasciabile da sola) →
  **Fase B** (username / account senza email).

## Perimetro & RBAC

- Pagina **`/utenti`** admin-only (stesso gate di `/impostazioni`: `role === "ADMIN"`, altrimenti
  redirect). Link in navigazione **visibile solo agli admin**.
- **Tutte** le operazioni via `adminProcedure` (ADMIN forzato lato server, non solo in UI).
- **Paletti anti-lockout** (verificati lato server, in ogni mutation pertinente): un admin **non**
  può **disattivare / eliminare / declassare sé stesso** né **l'ultimo ADMIN attivo** rimasto.
- Nota: tutto è dentro la sezione admin (nessun self-service agente in questo perimetro; un
  eventuale «cambia la tua password» self-service è fuori scope, da valutare a parte).

## Fase A — Sezione admin «Gestione utenti» (rilasciabile da sola)

Lavora sugli account **email-based** esistenti (nessun plugin username ancora).

### Backend (`userRouter`, estensioni — tutte `adminProcedure`)
Le operazioni delegano al **plugin admin di Better Auth** dove possibile (mantiene coerenti
account/hashing/sessioni). Nomi API da confermare in planning (roughly: `setRole`, `banUser`,
`unbanUser`, `setUserPassword`, `removeUser`, `updateUser`).

- `create` (esiste) — invariato in Fase A.
- `list` (esiste) — invariato in Fase A (aggiunge `username` in Fase B).
- **`setRole`** (nuovo) — `{ id, role: "AGENT"|"ADMIN" }` → `auth.api.setRole`. **Guardia**:
  se si declassa un ADMIN, verificare che resti ≥1 ADMIN attivo e che `id != self`.
- **`setActive`** (nuovo) — `{ id, active: boolean }` → `banUser`/`unbanUser`. **Sostituisce**
  `setStatus` per l'enforcement: `active:false` ⇒ `banned:true` (blocca login + revoca sessioni);
  `active:true` ⇒ unban. **Guardia**: `id != self` e non l'ultimo ADMIN attivo. (Il vecchio
  `setStatus`/campo `status` diventa vestigiale: lo «stato» in UI si deriva da `banned`.)
- **`resetPassword`** (nuovo) — `{ id, password: string≥8 }` → `auth.api.setUserPassword`.
- **`update`** (nuovo) — `{ id, firstName?, lastName? }` (in Fase A solo nome/cognome, via
  `ctx.db.user.update` + `name` ricomposto). Email/username: Fase B (richiedono controllo unicità
  e coerenza col record account Better Auth — da verificare in planning).
- **`delete`** (nuovo) — `{ id }` → **precondizione**: 0 `kitRequests`, 0 `conversations` **e
  0 `settings`** (query di conteggio). *Nota (corretta in impl. A2): `Settings.updatedBy` è una
  FK `ON DELETE RESTRICT` non-null, quindi va conteggiata anch'essa — la stesura iniziale la
  ometteva.* Se un conteggio >0 → `TRPCError` (code `CONFLICT`) «utente con record collegati:
  disattivalo invece di eliminarlo». Altrimenti `auth.api.removeUser`. **Guardia**:
  `id != self` e non l'ultimo ADMIN.

### UI (`/utenti`)
- Server component `page.tsx` (gate ADMIN, come `/impostazioni`) → client `utenti-client.tsx`.
- **Tabella** utenti: nome, email, ruolo, **stato** (Attivo/Disattivato da `!banned`), creato il.
  Azioni per riga (con conferma dove distruttive): cambia ruolo, attiva/disattiva, reset password,
  modifica (nome), elimina.
- Bottone **«Nuovo utente»** → form (nome, cognome, ruolo, email, password). Errori in italiano.
- Stile coerente con `impostazioni-client.tsx`. Voce di nav «Utenti» (solo admin).

### Test (Fase A)
- `user.test.ts`: ogni nuova mutation; guardie anti-lockout (self, ultimo-admin) → errore;
  `delete` bloccato con record collegati; `setActive` mappa su ban/unban.
- Test UI (jsdom) su `utenti-client`: tabella, azioni, form nuovo utente, conferme.

## Fase B — Username / account senza email

### Auth & dati
- Aggiungere il plugin `username` in `config.ts` (`plugins: [admin(...), username(), nextCookies()]`)
  e `usernameClient()` in `auth-client.ts`.
- **Migrazione**: `username` (nullable, unique) + `displayUsername` (nullable) su `User`
  (schema del plugin username). `@@index([username])`.
- **Email-segnaposto**: se il `create` non riceve un'email vera ma uno username, genero
  un'email interna deterministica e unica, es. `"<username>@no-email.ufptrade.local"` (dominio
  riservato, mai usata per invii; formato valido per `z.string().email()`). In UI mostro
  «nessuna email» quando l'email è segnaposto (riconosciuta dal dominio riservato).
- **Regola credenziale** nel `create`/`update`: almeno uno tra *email vera* e *username*
  (entrambi ammessi). `username` unique; email (vera o segnaposto) unique.

### Backend (estensioni Fase B)
- `create` — input: `email?`, `username?`, `firstName`, `lastName`, `password`, `role`;
  validazione «almeno uno»; se `email` assente → sintetizza da `username`; passa `username`/
  `displayUsername` a `createUser` (o update successivo). 
- `list` / `update` — includono/permettono `username` (con controllo unicità).
- `userSelect` — aggiunge `username`, `displayUsername`.

### Login (email o username)
- `src/app/(auth)/login` — il campo credenziale accetta **email o username**: se contiene «@»
  → `authClient.signIn.email(...)`; altrimenti → `authClient.signIn.username(...)`. Messaggi
  d'errore in italiano invariati.

### UI (Fase B)
- Form «Nuovo utente»: email **opzionale** + campo **username**; hint «lascia vuota l'email se
  l'agente non ne ha — userà lo username per accedere». Validazione «almeno uno».
- Tabella: colonna mostra email vera **o** `@username` (con «nessuna email» per i segnaposto).
- `update`: consente modifica email/username (con unicità).

### Test (Fase B)
- Sintesi email-segnaposto (deterministica, unica); regola «almeno uno»; login con username;
  unicità username; UI form con email opzionale.

## Non-goals
- Self-service agente (cambio password/profilo dal proprio account) — fuori scope.
- Recupero password via email (reset è admin-driven; senza email non c'è self-reset).
- Nuovi ruoli oltre AGENT/ADMIN.
- Invio email reali / verifica email.
- Import massivo utenti.

## Assunzioni aperte (da verificare in planning)
1. Nomi esatti delle API admin-plugin Better Auth (`setRole`/`banUser`/`unbanUser`/
   `setUserPassword`/`removeUser`/`updateUser`) e loro firma con `headers: ctx.headers`.
2. Coerenza del cambio **email** con il record `account` di Better Auth (se il credential
   e-mail va aggiornato oltre a `user.email`). In Fase A l'`update` si limita al nome per non
   rischiare desync; email/username in Fase B con verifica.
3. Comportamento `removeUser` sulle relazioni (cascade vs vincolo) — comunque protetto dalla
   precondizione «0 record collegati».
4. Il campo legacy `status`/route `setStatus`: deprecato a favore di `setActive` (ban). Decidere
   in planning se rimuovere la route/colonna o lasciarle inerti (nessun consumatore dopo la UI nuova).
