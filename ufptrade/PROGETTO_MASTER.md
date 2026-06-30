# Utensilferramenta WebApp — Documento Master per Sviluppo

> Questo documento e' il punto di ingresso per lo sviluppo con Claude Code Opus 4.8.
> Contiene il riepilogo completo del progetto, i riferimenti a tutti i documenti
> di progettazione, e le istruzioni per configurare l'ambiente di sviluppo.

---

## Indice Documenti

| Documento | Percorso | Contenuto |
|-----------|----------|-----------|
| ** questo file ** | `PROGETTO_MASTER.md` | Riepilogo, decisioni, piano sviluppo |
| Architettura completa | `ARCHITETTURA_COMPLETA.md` | DB schema, API, AI, security, deploy (~5000 righe) |
| Wireframe UI/UX | `wireframe-utensilferramenta.md` | 8 schermate con layout ASCII, componenti, stati |
| Design System | `ufptrade-design/DESIGN.md` | Colori, tipografia, spacing, componenti |
| Product Context | `ufptrade-design/PRODUCT.md` | Utenti, purpose, principi |
| Skills Claude | `CLADE_SKILLS_REPORT.md` | 30+ skill raccomandate, CLAUDE.md template |
| PDF per superiori | `Progetto_WebApp_Utensilferramenta.pdf` | Documento presentazione direzione |
| Council Verdict | *(in questa conversazione)* | Decisioni architetturali validate |

---

## Riassunto Decisioni Architetturali (Verdict LLM Council)

### Stack Tecnologico
- **Frontend:** Next.js 15 + React 19 + TypeScript
- **Backend:** tRPC + Prisma ORM
- **Database:** PostgreSQL + pgvector (Neon managed)
- **Cache/Queue:** Redis via Upstash (BullMQ)
- **AI:** Single-agent con tool-use (non multi-agent)
- **AI Providers:** Google Gemini (primario) + Moonshot Kimi K2.6 (kit gen + fallback)
- **Auth:** NextAuth.js con credenziali, RBAC 3 ruoli
- **Deployment:** Vercel + Neon + Upstash (managed, non VPS)

### Pattern AI
- **Kit Generation:** Engine DETERMINISTICO in TypeScript, NON LLM reasoning
- **LLM si occupa solo di:** intent parsing, traduzione NL → structured query
- **3 Tool:** `search_products` (hybrid RAG), `generate_kit` (deterministic), `chat` (conversazionale)
- **Queue:** BullMQ con rate limiting per-provider + circuit breaker

### Database
- Single PostgreSQL, NO vector DB separato
- JSONB per specs prodotto, pgvector per embeddings
- Hybrid search: tsvector (40%) + vector similarity (60%)
- 20.000 righe = PostgreSQL gestisce senza problemi

### Sicurezza
- RBAC: `public` → `agent` → `admin`
- Admin crea tutti gli account (no self-registration per agenti)
- GDPR compliance per azienda UE
- Rate limiting AI per utente

---

## Piano di Sviluppo Phased

### FASE 1 — MVP Gestionale (6 settimane)

**Goal:** Dashboard agente con chat AI, ricerca catalogo, e kit engine funzionante.
Testato da 2-3 agenti beta.

#### Settimana 1-2: Fondamenta
- [ ] Setup progetto Next.js 15 + tRPC + Prisma + TypeScript
- [ ] Configurare database PostgreSQL (local dev + Neon prod)
- [ ] Implementare autenticazione NextAuth (Credentials provider)
- [ ] Creare schema DB completo (migrazione Prisma)
- [ ] Implementare RBAC middleware
- [ ] Layout dashboard (sidebar, topbar, content area)

**File da creare:**
- `prisma/schema.prisma` — tutti i 12 modelli
- `src/lib/auth.ts` — NextAuth config
- `src/lib/db.ts` — Prisma client singleton
- `src/middleware.ts` — route protection
- `src/app/(dashboard)/layout.tsx` — dashboard shell

#### Settimana 3-4: Catalogo + Chat AI Base
- [ ] Importare catalogo AGB nel database
- [ ] Implementare hybrid search (tsvector + pgvector)
- [ ] Creare API tRPC: `product.search`, `product.getByCode`
- [ ] Implementare chat UI (messaggi user/AI, input, quick actions)
- [ ] Integrare Google Gemini API
- [ ] Implementare tool `search_products`
- [ ] Test ricerca semantica su catalogo

**File da creare:**
- `src/server/routers/product.ts` — router prodotti
- `src/lib/ai/client.ts` — AI client (Gemini)
- `src/lib/ai/tools/searchProducts.ts` — tool ricerca
- `src/app/(dashboard)/chat/page.tsx` — chat UI
- `src/components/chat/MessageList.tsx` — componenti chat

#### Settimana 5-6: Kit Engine + Deploy
- [ ] Implementare Kit Deterministic Engine (regole AGB)
- [ ] Implementare tool `generate_kit`
- [ ] Creare Kit Builder UI (form strutturato 4 step)
- [ ] Implementare gestione richieste kit (tabella, workflow stato)
- [ ] Aggiungere Moonshot Kimi fallback
- [ ] Configurare BullMQ queues
- [ ] Deploy su Vercel + Neon + Upstash
- [ ] Test end-to-end con 2-3 agenti

**File da creare:**
- `src/lib/kit/engine.ts` — deterministic kit engine
- `src/lib/kit/rules.ts` — regole AGB codificate
- `src/lib/ai/tools/generateKit.ts` — tool kit generation
- `src/app/(dashboard)/kit/page.tsx` — kit builder
- `src/app/(dashboard)/requests/page.tsx` — gestione richieste
- `src/lib/queue.ts` — BullMQ setup

**Criteri di accettazione Fase 1:**
- Agente puo' cercare un prodotto per descrizione e trovare il codice in < 5 secondi
- Agente puo' generare un kit da specifiche e ottenere lista componenti corretta
- Chat AI risponde correttamente a parsing email
- 2-3 agenti usano il sistema senza errori per 1 settimana

---

### FASE 2 — Sito Pubblico + Admin + Ottimizzazioni (3-4 settimane)

- [ ] Homepage pubblica (hero, prodotti in evidenza, form kit)
- [ ] Pagina catalogo pubblico con filtri
- [ ] Pagina prodotto dettaglio
- [ ] Admin panel: gestione utenti, analytics, settings AI
- [ ] Ottimizzazione AI prompts e RAG
- [ ] Analytics dashboard (attivita' agenti, ricerche, kit generati)
- [ ] Richiesta kit via form pubblico

---

### FASE 3 — E-Commerce + Integrazione DB (futuro, post-approvazione)

- [ ] Carrello e checkout
- [ ] Integrazione database aziendale (quando accessibile)
- [ ] Customer portal B2B
- [ ] Ordini e tracciamento
- [ ] Pagamenti

---

## Struttura Directory Progetto

```
ufptrade/
├── .claude/                    # Claude Code config
│   ├── skills/                 # Skill progetto
│   └── CLAUDE.md              # Contesto progetto
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (public)/          # Sito pubblico
│   │   │   ├── page.tsx       # Homepage
│   │   │   ├── prodotti/
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/       # Area agenti/admin
│   │   │   ├── dashboard/
│   │   │   ├── chat/
│   │   │   ├── archivio/
│   │   │   ├── kit/
│   │   │   ├── richieste/
│   │   │   ├── admin/
│   │   │   └── layout.tsx
│   │   ├── api/               # API routes (auth, webhooks)
│   │   └── layout.tsx
│   ├── components/            # Componenti React
│   │   ├── ui/               # Componenti base (button, input, card)
│   │   ├── chat/             # Componenti chat AI
│   │   ├── kit/              # Componenti kit builder
│   │   ├── layout/           # Sidebar, topbar, etc.
│   │   └── product/          # Card prodotto, tabelle, filtri
│   ├── lib/                  # Librerie e utility
│   │   ├── ai/               # AI integration
│   │   │   ├── client.ts     # Client AI (Gemini/Kimi)
│   │   │   ├── rag.ts        # RAG engine
│   │   │   └── tools/        # Tool definitions
│   │   ├── kit/              # Kit engine
│   │   │   ├── engine.ts     # Logica deterministica
│   │   │   └── rules.ts      # Regole AGB
│   │   ├── auth/             # Auth utilities
│   │   ├── db.ts             # Prisma client
│   │   └── queue.ts          # BullMQ
│   ├── server/               # Backend tRPC
│   │   ├── routers/          # API routers
│   │   │   ├── auth.ts
│   │   │   ├── user.ts
│   │   │   ├── product.ts
│   │   │   ├── kit.ts
│   │   │   ├── conversation.ts
│   │   │   ├── analytics.ts
│   │   │   └── settings.ts
│   │   ├── trpc.ts           # tRPC setup
│   │   └── context.ts        # Context builder
│   └── types/                # TypeScript types
├── public/                    # Asset statici
├── docker-compose.yml         # Dev environment
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## CLAUDE.md Template (da mettere in `.claude/CLAUDE.md`)

```markdown
# UFPtrade WebApp

## WHAT
WebApp multifunzione per Utensilferramenta Pistoiese S.p.A.:
- Sito pubblico (futuro e-commerce)
- Gestionale agenti vendita con AI assistant
- Catalogo 20.000+ prodotti AGB
- Kit generation engine deterministico

## STACK
Next.js 15 + React 19 + TypeScript + tRPC + Prisma + PostgreSQL(pgvector) + Redis(BullMQ) + NextAuth

## ARCHITECTURE DECISIONS
- Single-agent AI with tool-use (NOT multi-agent)
- Kit generation = deterministic engine, NOT LLM reasoning
- Dual AI provider: Gemini (primary) + Kimi (kit gen + fallback)
- Managed services: Vercel + Neon + Upstash
- RBAC: public → agent → admin
- Admin creates all accounts (no self-registration for agents)

## KEY RULES
- Always use TypeScript strict mode
- All API calls go through tRPC (never fetch directly)
- All DB queries go through Prisma (never raw SQL except migrations)
- Kit engine must never use LLM for calculations (deterministic only)
- All AI calls go through BullMQ queue with rate limiting
- Product codes always use monospace font
- Italian language for all UI text

## TESTING
- Run `pnpm test` before committing
- Run `pnpm typecheck` after schema changes
- Run `pnpm lint` before PR

## IMPORTANT FILES
- `prisma/schema.prisma` — Database schema (source of truth)
- `src/lib/kit/engine.ts` — Kit deterministic engine
- `src/lib/ai/client.ts` — AI client configuration
- `src/server/trpc.ts` — tRPC setup and middleware
```

---

## Skill Claude Consigliate (Top 10)

Installa queste skill nel progetto:

| # | Skill | Installazione | Percorso |
|---|-------|--------------|----------|
| 1 | ai-sdk | `npx skills add vercel-ai-sdk` | `.claude/skills/ai-sdk/SKILL.md` |
| 2 | react-best-practices | `npx skills add vercel-react-best-practices` | `.claude/skills/react-bp/SKILL.md` |
| 3 | postgres-optimization | Copia manuale | `.claude/skills/postgres-opt/SKILL.md` |
| 4 | security-hardening | Copia manuale | `.claude/skills/security/SKILL.md` |
| 5 | testing-strategies | Copia manuale | `.claude/skills/testing/SKILL.md` |
| 6 | nextjs-mastery | Copia manuale | `.claude/skills/nextjs/SKILL.md` |
| 7 | database-optimization | Copia manuale | `.claude/skills/db-opt/SKILL.md` |
| 8 | authentication-patterns | Copia manuale | `.claude/skills/auth/SKILL.md` |
| 9 | gdpr-data-handling | Copia manuale | `.claude/skills/gdpr/SKILL.md` |
| 10 | docker-best-practices | Copia manuale | `.claude/skills/docker/SKILL.md` |

Vedi `CLADE_SKILLS_REPORT.md` per i contenuti completi delle skill.

---

## Comandi Rapidi

```bash
# Setup iniziale
npx create-next-app@latest ufptrade --typescript --tailwind --app --no-src-dir
cd ufptrade
pnpm add @trpc/server @trpc/client @trpc/react-query @tanstack/react-query prisma @prisma/client next-auth bullmq ioredis pg @neondatabase/serverless ai @google/genai

# Database
pnpm prisma init
pnpm prisma migrate dev --name init
pnpm prisma generate
pnpm prisma studio  # GUI database

# Dev
pnpm dev          # localhost:3000
pnpm build        # production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript check

# Docker (local dev)
docker-compose up -d  # PostgreSQL + Redis
```

---

## Checklist Pre-Sviluppo

- [ ] Approvazione direzione ricevuta
- [ ] Account API Gemini creato (Google AI Studio, gratuito)
- [ ] Account API Moonshot AI creato
- [ ] Neon database creato
- [ ] Upstash Redis creato
- [ ] 2-3 agenti beta-tester identificati
- [ ] File listino AGB 2026 pronto per import
- [ ] Repo GitHub creato

---

## Note Importanti

1. **Kit Engine e' sacro.** Mai usare LLM per calcolare componenti kit. Solo regole deterministiche TypeScript.
2. **AI e' un wrapper.** L'LLM parsa l'intento, traduce in query strutturate, l'engine fa il lavoro.
3. **10 agenti max.** Il sistema e' progettato per 10 utenti concorrenti. Non serve Kubernetes, load balancing, o microservices.
4. **Managed > VPS.** Non gestire server. Vercel + Neon + Upstash fanno tutto loro.
5. **Testa con agenti reali.** Il successo dipende dall'adozione, non dalla tecnologia. Coinvolgi gli agenti fin dal giorno 1.
