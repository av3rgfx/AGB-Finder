# Prompt di Avvio per Claude Code — Progetto UFPtrade

> Copia e incolla questo prompt in Claude Code Opus 4.8 (modalita ultracode).
> Prima di incollare, posizionati nella directory del progetto che claude creera'.

---

## ISTRUZIONI PER TE (Claude)

Stai per iniziare lo sviluppo della webapp **UFPtrade** per Utensilferramenta Pistoiese S.p.A. — un'azienda B2B di ferramenta a Pistoia. Questo e' un progetto Next.js 15 + React 19 + TypeScript + tRPC + Prisma + PostgreSQL(pgvector) + Redis.

### REGOLE ASSOLUTE (non negoziabili)

1. **Kit Generation = Engine DETERMINISTICO TypeScript.** MAI usare LLM per calcolare componenti kit. L'LLM parsa solo l'intento dell'utente e traduce in query strutturate.
2. **Single-agent AI con tool-use.** NON fare un sistema multi-agent.
3. **Dual AI provider:** Google Gemini (primario, chat e ricerca) + Moonshot Kimi K2.6 (kit generation complessi + fallback automatico).
4. **Ogni chiamata AI passa attraverso BullMQ** con rate limiting e circuit breaker.
5. **TypeScript strict mode sempre.**
6. **Tutte le API vanno attraverso tRPC.** Mai chiamate fetch dirette.
7. **Tutte le query DB vanno attraverso Prisma.** Mai raw SQL (tranne migrazioni).
8. **Lingua italiana per tutta l'UI.**
9. **Admin crea tutti gli account agenti.** Nessuna self-registration per agenti.
10. **Product codes in font monospace.**

### FASE DA SVILUPPARE

Inizia dalla **FASE 1 — MVP Gestionale (settimane 1-2: Fondamenta)**:

1. Setup progetto Next.js 15 con TypeScript, Tailwind, tRPC, Prisma
2. Configura database PostgreSQL (local: Docker, prod: Neon)
3. Implementa NextAuth.js con provider Credentials (email/password)
4. Crea lo schema Prisma completo (12 modelli)
5. Implementa RBAC middleware (3 ruoli: public, agent, admin)
6. Crea il layout dashboard (sidebar scura, topbar, content area)
7. Implementa login page (split layout brand + form)

### PRIMA DI INIZIARE A SCRIVERE CODICE

1. **Leggi attentamente** i seguenti file di progettazione che ti fornisco:
   - `PROGETTO_MASTER.md` — Contesto completo, decisioni, piano phased
   - `ARCHITETTURA_COMPLETA.md` — Schema DB, API, AI integration, security, deploy
   - `ufptrade-design/DESIGN.md` — Design system (colori, tipografia, componenti)
   - `ufptrade-design/PRODUCT.md` — Utenti, purpose, principi
   - `wireframe-utensilferramenta.md` — 8 schermate wireframed con layout ASCII

2. **Fai un piano dettagliato** dei file che creerai, in ordine.

3. **Chiedimi conferma** del piano prima di iniziare a scrivere codice.

### FILE HANDOFF

Subito dopo aver letto tutti i documenti e confermato il piano con me, **crea un file `handoff.md`** nella root del progetto con questa struttura esatta:

```markdown
# Handoff — UFPtrade WebApp

## Sessione attuale
- **Data/ora inizio:** [timestamp]
- **Fase in corso:** Fase 1 — MVP (Fondamenta, settimane 1-2)
- **File creati/modificati:** [lista file con status]
- **Task completati:** [lista task done]
- **Task in corso:** [cosa si sta facendo ora]
- **Task pendenti:** [cosa manca da fare]

## Contesto tecnico
- **Branch:** [nome branch git]
- **Database:** [schema migrato: si/no, seed: si/no]
- **Variabili env configurate:** [quali .env sono pronti]
- **Dipendenze installate:** [lista pacchetti]

## Note importanti
- [Decisioni prese durante la sessione]
- [Problemi riscontrati e workaround]
- [Domande aperte per la prossima sessione]

## Prossima sessione
- **Prima cosa da fare:** [task specifico]
- **File da leggere all'avvio:** [quali file rileggere]
- **Dipendenze bloccanti:** [se ci sono]
```

Aggiorna il file `handoff.md` alla fine di OGNI sessione di lavoro.

### ORDINE DI LAVORO

Segui questo ordine stretto. NON saltare step:

1. Setup progetto (scaffold Next.js, install dipendenze)
2. Docker Compose per dev (PostgreSQL pgvector + Redis)
3. Schema Prisma completo + migrazione iniziale
4. NextAuth config (Credentials provider)
5. RBAC middleware
6. Layout dashboard (shell UI)
7. Login page
8. Seed database con campioni catalogo AGB
9. Test completo del flusso auth + routing
10. Aggiorna handoff.md

### DIPENDENZE DA INSTALLARE

```bash
# Core
next react react-dom typescript @types/react @types/react-dom

# Styling
tailwindcss postcss autoprefixer

# tRPC
@trpc/server @trpc/client @trpc/react-query @trpc/next @tanstack/react-query

# Prisma + DB
prisma @prisma/client @neondatabase/serverless ws @types/ws

# Auth
next-auth bcryptjs @types/bcryptjs

# AI
ai @ai-sdk/google @google/genai

# Queue
bullmq ioredis

# UI (shadcn — installa via CLI)
# pnpm dlx shadcn-ui@latest init

# Dev
eslint @typescript-eslint/parser @typescript-eslint/plugin
@types/node tsx dotenv
```

### VARIABILI D'AMBIENTE (.env.local)

```env
# Database (Neon per prod, local Docker per dev)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ufptrade?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/ufptrade?schema=public"

# Redis (Upstash per prod, local per dev)
REDIS_URL="redis://localhost:6379"
REDIS_TOKEN=""

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[genera con openssl rand -base64 32]"

# AI Providers
GOOGLE_GENERATIVE_AI_API_KEY="[Google AI Studio API Key]"
MOONSHOT_API_KEY="[Moonshot AI API Key]"
MOONSHOT_API_URL="https://api.moonshot.cn/v1"

# App
APP_URL="http://localhost:3000"
```

### OUTPUT ATTESO

Alla fine della sessione di setup devo avere:
- [ ] Progetto Next.js funzionante con `pnpm dev`
- [ ] Docker Compose con PostgreSQL (pgvector) e Redis avviati
- [ ] Schema Prisma creato, migrato, e generato
- [ ] NextAuth funzionante con login/logout
- [ ] Layout dashboard con sidebar e topbar
- [ ] Login page con split layout
- [ ] RBAC middleware che protegge le route
- [ ] Seed script con dati di esempio
- [ ] File `handoff.md` aggiornato
- [ ] README.md con istruzioni per avviare il progetto

### COME LAVORARE

- Scrivi codice pulito, commentato in italiano dove necessario
- Crea i file uno alla volta, in ordine logico
- Testa ogni componente prima di passare al prossimo
- Se incontri un problema, fermati, descrivilo, chiedimi consiglio
- Alla fine della sessione, aggiorna handoff.md

---

## FILE DI PROGETTAZIONE (da leggere prima di iniziare)

Ecco i file che devi leggere integralmente prima di scrivere qualsiasi riga di codice:

1. `/mnt/agents/output/PROGETTO_MASTER.md` — Contesto e piano completo
2. `/mnt/agents/output/ARCHITETTURA_COMPLETA.md` — Schema DB, API, AI, security (capitoli 1-7 per ora)
3. `/mnt/agents/output/ufptrade-design/DESIGN.md` — Design system
4. `/mnt/agents/output/ufptrade-design/PRODUCT.md` — Contesto prodotto
5. `/mnt/agents/output/wireframe-utensilferramenta.md` — Wireframe schermate (Login, Dashboard per ora)

Leggi questi file con il tool read, poi presentami il tuo piano di implementazione dettagliato.
