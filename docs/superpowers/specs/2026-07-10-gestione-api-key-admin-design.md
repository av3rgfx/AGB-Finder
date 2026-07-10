# Design — Gestione in-app delle API key AI (ADMIN)

**Data:** 2026-07-10
**Stato:** approvato (brainstorming) — pronto per writing-plans
**Fase:** trasversale (sicurezza/ops) · precede il completamento e2e Fase 1c

## Contesto e problema

Le API key dei provider AI (`GEMINI_API_KEY`, `KIMI_API_KEY`) sono oggi leggibili
**solo** da variabili d'ambiente (`src/env.ts` → `process.env`) e usate dal
singleton di modulo `getAIGateway()` (`src/server/ai/gateway.ts`). Ruotare una
key richiede quindi un accesso alla dashboard Vercel e un redeploy gestito da uno
sviluppatore.

**Requisito operativo confermato dall'utente:** alcuni **ADMIN aziendali
non-tecnici**, senza accesso a Vercel, devono poter **aggiornare/ruotare
periodicamente** la key aziendale dell'AI in autonomia, dall'interno dell'app.

**Verdetto LLM Council (giro focalizzato, 2026-07-10):** procedere con un
override cifrato minimale su DB con fallback su env. Le alternative esterne
(Vercel Env API, secret manager) non eliminano il vincolo — lo spostano peggio
(token Vercel critico + redeploy comunque necessario) o lo sovraccaricano di
complessità non giustificata per due sole key a rotazione manuale (viola YAGNI).

**Cosa si ottiene davvero (senza vendere fumo):** non si eliminano i segreti da
env, ma si passa da *2 key che ruotano spesso* a *1 master key
(`SETTINGS_ENCRYPTION_KEY`) che non ruota quasi mai*. Chi ha accesso a Vercel
oggi legge le key AI in chiaro; dopo, quell'accesso da solo non basta più.

## Decisioni fissate (brainstorming)

1. **Chi gestisce:** riservato ad **ADMIN** → riuso diretto di `adminProcedure`.
   Nessun nuovo ruolo/permission (no estensione access-control Better Auth).
2. **Master key:** **opzionale** in env. Se assente: dev/CI girano usando le key
   da env; la feature "key da DB" è disattiva e un tentativo di salvataggio
   restituisce un errore chiaro.
3. **Audit:** solo in-app (`ActivityLog` → `SETTINGS_CHANGED`). Nessuna notifica
   email (rimandabile a dopo se emergerà l'esigenza).
4. **Salvataggio:** **test-connection obbligatorio** prima del salvataggio
   (rete di sicurezza contro il lockout dell'AI).
5. **Scope:** esattamente due key — **Gemini** (alimenta chat *ed* embedding,
   stessa key) e **Kimi**. Nessun'altra key (auth/DB restano solo in env).

## Stato del codice verificato (fonte di verità)

- `prisma/schema.prisma`: modello `Settings` **già presente** con
  `@@unique([category, key])`, `category: SettingCategory` (`API_KEYS`,
  `AI_PROVIDER`, …), `value: Json`, `isEncrypted Boolean`, `updatedBy` (FK a
  `User`, **obbligatorio**). Enum `ActivityType.SETTINGS_CHANGED` presente.
  → **Nessuna migrazione di schema del modello** necessaria.
- `src/env.ts`: `GEMINI_API_KEY` / `KIMI_API_KEY` sono `z.string().optional()`.
  `SETTINGS_ENCRYPTION_KEY` **non esiste** → va aggiunta.
- `src/server/ai/gateway.ts`: `getAIGateway()` è **sincrono**, costruisce un
  `singleton` di modulo dalle env (`env.GEMINI_API_KEY`, `env.KIMI_API_KEY`) e
  crea anche `GeminiEmbeddingService` dalla stessa key Gemini.
- `src/server/api/routers/`: esistono `auth, product, health, chat, kit, user,
  dashboard`. **Non esiste** `settings`. `adminProcedure` esiste in
  `src/server/api/trpc.ts`.
- `src/app/(dashboard)/`: **non esiste** una pagina `impostazioni`.

## Architettura

### §1 — Cifratura · `src/server/settings/crypto.ts` (`server-only`)

AES-256-GCM via `node:crypto`.

- `encrypt(plaintext: string): string` → `base64(iv[12] | authTag[16] | ciphertext)`.
  IV random per ogni chiamata (`crypto.randomBytes(12)`).
- `decrypt(payload: string): string` → inverso; verifica dell'auth tag (un
  ciphertext manomesso lancia).
- Master key: derivata da `SETTINGS_ENCRYPTION_KEY` (32 byte; accettare base64 o
  hex e validare la lunghezza a 32 byte all'uso).
- Se la master key **manca**: `encrypt`/`decrypt` lanciano un errore tipizzato
  `SettingsCryptoUnavailableError` (mai crash silenzioso, mai fallback a
  cifratura debole).

### §2 — Env · `src/env.ts`

Aggiungere `SETTINGS_ENCRYPTION_KEY: z.string().optional()` allo schema server.
Opzionale → dev/CI girano senza. Le key AI restano `optional`.

**Vincolo operativo (documentare, non codice):** `SETTINGS_ENCRYPTION_KEY`
distinta per ambiente (dev/preview/prod), mai loggata, backuppata a parte (es.
password manager aziendale). È l'unico vero single-point-of-failure: perderla
rende irrecuperabili i valori cifrati in `Settings`.

### §3 — Service · `src/server/settings/service.ts` (`server-only`)

Costante di mappatura provider→key in `Settings` (categoria `API_KEYS`, key
`GEMINI_API_KEY` / `KIMI_API_KEY`).

- `resolveApiKey(provider): Promise<string | undefined>` — **DB prima**
  (riga `Settings` decifrata), **fallback su env**, altrimenti `undefined`. Se la
  master key è assente, salta il DB e usa direttamente env.
- `setApiKey(provider, plaintext, adminUserId): Promise<void>` — cifra (richiede
  master key, altrimenti `SettingsCryptoUnavailableError`), `prisma.settings.upsert`
  su `@@unique([category, key])` con `isEncrypted = true` e `updatedBy`, scrive
  `ActivityLog` `SETTINGS_CHANGED` con **solo** `{ provider, maskedSuffix }`
  (mai plaintext), poi `INCR` del version-stamp su Redis.
- `getStatus(provider): Promise<StatusDTO>` — `{ configured, source:
  'db'|'env'|'none', maskedSuffix, updatedAt?, updatedBy? }`. **Mai** il plaintext.

### §4 — Invalidazione singleton · `src/server/ai/gateway.ts`

`getAIGateway()` diventa **async**:

- risolve le key via `resolveApiKey` (DB→env) per i provider chat **e** per
  `GeminiEmbeddingService` (stessa key Gemini);
- version-stamp Redis `settings:ai-keys:version`: il processo tiene in cache
  `{ version, checkedAt }` e rilegge la versione solo ogni ~30–60s; se cambiata,
  **ricostruisce** il singleton (provider + embedding);
- disallineamento massimo tra istanze serverless = quell'intervallo — accettabile
  per una rotazione manuale non urgente.

**Impatto sui chiamanti:** tutti i call-site di `getAIGateway()` (es. chat
service, script embed) vanno resi `await`. Da mappare puntualmente nel piano.

### §5 — Router tRPC · `src/server/api/routers/settings.ts`

`settingsRouter`, tutte le procedure sotto `adminProcedure`. Montato nel root
router (`src/server/api/root.ts`).

- `aiKeys.status` (query) → `getStatus` per ciascun provider (mascherato).
- `aiKeys.testConnection` (mutation, `{ provider, apiKey?: string }`) → istanzia
  un provider **temporaneo** con la key indicata (o quella risolta se `apiKey`
  assente) — il costruttore dei provider accetta già `apiKey` — ed esegue una
  chat minima con timeout corto, **senza persistere**. Ritorna
  `{ ok, latencyMs?, error? }`. L'endpoint è hardcoded verso Gemini/Kimi (nessun
  URL arbitrario dal client → non è un vettore SSRF generico).
- `aiKeys.set` (mutation, `{ provider, apiKey: string }`) → **ri-valida
  server-side** con la stessa verifica di `testConnection` (non fidarsi del solo
  esito client), poi `setApiKey`. Ritorna lo stato mascherato aggiornato.

### §6 — UI · `src/app/(dashboard)/impostazioni/page.tsx`

Pagina **admin-only** (guardia coerente con le pagine admin esistenti; verificare
il pattern in `user`/layout dashboard). Una card per provider:

- stato: `configurata (DB)` / `configurata (env)` / `mancante`, `••••1234` in
  **monospace** (JetBrains Mono), "ultima modifica: {data} da {admin}";
- campo key **write-only** (sempre vuoto al load — non si rilegge mai il valore);
- pulsante **"Testa connessione"**;
- pulsante **"Salva"** abilitato **solo dopo** un test riuscito.

Tutto in **italiano**. Chiamate solo via tRPC (mai `fetch` diretto).

## Sicurezza — rischi e mitigazioni

- **Master key resta in env** — accettato e dichiarato: obiettivo è ridurre la
  frequenza di rotazione dei segreti esposti, non azzerarli. Miglioramento del
  threat model, non pareggio.
- **Neon branching/backup DB** — valori a riposo cifrati AES-256-GCM; sicuri
  **a patto** che `SETTINGS_ENCRYPTION_KEY` sia distinta per ambiente e mai
  loggata.
- **Account admin compromesso** — può leggere solo il masked value ma può
  scrivere una key arbitraria. Mitigazioni: audit `SETTINGS_CHANGED` sempre;
  test-connection obbligatorio riduce salvataggi accidentali; possibile rate
  limit sul `set` (riuso del `RateLimiter` esistente) — opzionale nel piano.
- **Log accidentali** — verificare che gli errori HTTP dei provider non logghino
  mai header/URL con la key in chiaro.
- **Finestra multi-istanza** — bounded dall'intervallo di rilettura versione
  (~30–60s), accettata.

## Testing (TDD)

- **crypto:** roundtrip encrypt/decrypt; ciphertext manomesso → throw; master key
  assente → `SettingsCryptoUnavailableError`.
- **service:** `resolveApiKey` DB-prima con fallback env; master key assente →
  usa env; `setApiKey` scrive audit **senza plaintext** e bumpa la versione;
  `getStatus` non espone mai il plaintext.
- **router:** `adminProcedure` nega un non-ADMIN; `set` ri-valida server-side
  prima di persistere.
- **gateway:** ricostruzione del singleton al cambio di version-stamp;
  fallback env quando il DB non ha la key.

## Fuori scope (YAGNI)

- Notifiche email di rotazione (rimandabile).
- Permesso RBAC dedicato "solo-key" (si usa ADMIN).
- Gestione in-app di key diverse da Gemini/Kimi (auth/DB restano in env).
- Secret manager esterno / Vercel Env API / QStash / job schedulati.

## File coinvolti

**Nuovi:** `src/server/settings/crypto.ts`, `src/server/settings/service.ts`,
`src/server/api/routers/settings.ts`, `src/app/(dashboard)/impostazioni/page.tsx`
(+ eventuali componenti UI), relativi file di test.

**Modificati:** `src/env.ts` (master key), `src/server/ai/gateway.ts`
(`getAIGateway` async + invalidazione) e i suoi call-site, `src/server/api/root.ts`
(montaggio router).

**Invariati:** `prisma/schema.prisma` (il modello `Settings` è già adeguato).
