# Report Completo: Claude Code Skills, MCP Servers & Best Practices
## Per Utensilferramenta Pistoiese S.p.A. — B2B Webapp Large-Scale

**Progetto:** Sito pubblico + Catalogo 20.000+ prodotti + Dashboard Agenti con AI + Kit Generation Engine  
**Stack:** Next.js 15 + React 19 + TypeScript + tRPC + Prisma + PostgreSQL (pgvector) + Redis (BullMQ) + NextAuth  
**Target:** Max 10 agenti concorrenti  
**Generato:** Luglio 2025

---

## Indice

1. [Skills Raccomandate](#1-skills-raccomandate)
   - 1.1 [React / Next.js Development](#11-react--nextjs-development)
   - 1.2 [TypeScript](#12-typescript)
   - 1.3 [tRPC + Prisma Fullstack](#13-trpc--prisma-fullstack)
   - 1.4 [PostgreSQL + pgvector](#14-postgresql--pgvector)
   - 1.5 [AI Integration](#15-ai-integration)
   - 1.6 [Testing](#16-testing)
   - 1.7 [Deployment & DevOps](#17-deployment--devops)
   - 1.8 [Sicurezza, Auth & GDPR](#18-sicurezza-auth--gdpr)
   - 1.9 [UI/UX & Accessibility](#19-uiux--accessibility)
2. [Skill Utility Cross-Funzionali](#2-skill-utility-cross-funzionali)
3. [CLAUDE.md Template Ottimale](#3-claudemd-template-ottimale)
4. [Hooks Consigliati](#4-hooks-consigliati)
5. [MCP Servers](#5-mcp-servers)
6. [Plugin Consigliati](#6-plugin-consigliati)
7. [Struttura Directory](#7-struttura-directory)
8. [Checklist Installazione Rapida](#8-checklist-installazione-rapida)

---

## 1. Skills Raccomandate

Per installare skill in Claude Code, usa il comando:
```bash
npx skills add <owner/repo> --skill <skill-name>
```

Oppure per skill globali (tutti i progetti):
```bash
npx skills add -g <owner/repo> --skill <skill-name>
```

---

### 1.1 React / Next.js Development

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **vercel-react-best-practices** | `vercel-labs/agent-skills` | `npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices` | **ALTA** |
| 2 | **next-best-practices** | `vercel-labs/agent-skills` | `npx skills add vercel-labs/agent-skills --skill next-best-practices` | **ALTA** |
| 3 | **vercel-composition-patterns** | `vercel-labs/agent-skills` | `npx skills add vercel-labs/agent-skills --skill vercel-composition-patterns` | **ALTA** |
| 4 | **next-cache-components** | `vercel-labs/agent-skills` | `npx skills add vercel-labs/agent-skills --skill next-cache-components` | **MEDIA** |

#### Dettaglio

**vercel-react-best-practices** — Skill ufficiale Vercel con 57+ regole di performance React/Next.js suddivise in 8 categorie (waterfall elimination, bundle size, SSR, data fetching, re-renders, rendering, JS performance, advanced patterns). Ordinate per impatto reale. È la skill piu installata dell'ecosistema (176k+ installs).  
*Per il progetto:* Essenziale per ottimizzare il catalogo 20k+ prodotti, eliminare waterfall, usare Suspense boundaries, `next/dynamic`, e CSS `content-visibility` per liste lunghe.

**next-best-practices** — Best practices specifiche per Next.js 15 App Router: Server Components, convenzioni file, data patterns, middleware, ISR. Copia le convenzioni ufficiali Next.js.  
*Per il progetto:* Critica per usare correttamente React Server Components, Server Actions, e le nuove convenzioni di Next.js 15.

**vercel-composition-patterns** — Pattern di composizione React che scalano: compound components, context providers, varianti esplicite invece di boolean props. Copre pattern React 19 come `use()` al posto di `useContext()`.  
*Per il progetto:* Fondamentale per il design system del catalogo e delle dashboard agenti — evita la proliferazione di boolean props sui componenti condivisi.

**next-cache-components** — Cache Components e PPR (Partial Prerendering) di Next.js 16 per mescolare contenuto statico, cached e dinamico.  
*Per il progetto:* Utile per il catalogo pubblico dove la maggior parte dei prodotti è statico ma prezzi e disponibilità sono dinamici.

---

### 1.2 TypeScript

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **typescript-advanced** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill typescript-advanced` | **ALTA** |
| 2 | **improve-codebase-architecture** | `mattpocock/skills` | `npx skills add mattpocock/skills/improve-codebase-architecture` | **MEDIA** |

#### Dettaglio

**typescript-advanced** — Generics, conditional types, mapped types, discriminated unions, type narrowing, type guards, branded types. Pattern avanzati per type safety massima.  
*Per il progetto:* Critica per il type safety end-to-end tra tRPC, Prisma e il frontend. Fondamentale per i tipi del Kit Generation Engine deterministico.

**improve-codebase-architecture** — Esplora la codebase per opportunità di miglioramento architetturale, identifica hotspot e propone 2-3 strategie di refactor con risk/effort/impact.  
*Per il progetto:* Da eseguire mensilmente per mantenere la qualità architetturale del progetto large-scale.

---

### 1.3 tRPC + Prisma Fullstack

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **nextjs-mastery** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill nextjs-mastery` | **ALTA** |
| 2 | **database-optimization** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill database-optimization` | **ALTA** |

#### Dettaglio

**nextjs-mastery** — App Router, RSC, ISR, Server Actions, middleware, routing patterns, data fetching. Include pattern di integrazione API layer con Next.js.  
*Per il progetto:* Fondamentale per strutturare correttamente i router tRPC con Next.js 15 App Router e Server Actions.

**database-optimization** — Query planning, indexing, N+1 prevention, connection pooling, query batching. Include pattern specifici per ORM.  
*Per il progetto:* Essenziale per ottimizzare le query Prisma con 20.000+ prodotti, prevenire N+1 nelle liste catalogo, e ottimizzare il connection pooling per 10 agenti concorrenti.

---

### 1.4 PostgreSQL + pgvector

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **postgres-optimization** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill postgres-optimization` | **ALTA** |
| 2 | **redis-patterns** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill redis-patterns` | **MEDIA** |

#### Dettaglio

**postgres-optimization** — EXPLAIN ANALYZE, index types (B-tree, GiST, GIN), partitioning, JSONB queries, query optimization, vacuum tuning, connection tuning.  
*Per il progetto:* Critica per ottimizzare le query del catalogo prodotti, implementare full-text search con GIN indexes, e configurare pgvector per l'AI assistant (embedding search). Da combinare con il MCP server PostgreSQL per accesso live al database.

**redis-patterns** — Caching strategies (cache-aside, write-through, write-behind), rate limiting con sliding window, pub/sub, Redis Streams, Lua scripts, distributed locking.  
*Per il progetto:* Essenziale per BullMQ (code di processamento kit generation), session caching, e rate limiting per l'AI assistant.

---

### 1.5 AI Integration

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **ai-sdk** | `vercel-labs/agent-skills` | `npx skills add vercel-labs/agent-skills --skill ai-sdk` | **ALTA** |
| 2 | **llm-integration** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill llm-integration` | **ALTA** |
| 3 | **prompt-engineering** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill prompt-engineering` | **MEDIA** |

#### Dettaglio

**ai-sdk** — Vercel AI SDK: streaming, function calling, tool use, RAG implementation, multi-provider support (OpenAI, Anthropic, Google, Mistral, ecc.), chatbot e agenti AI.  
*Per il progetto:* **FONDAMENTALE.** L'AI assistant per gli agenti vendita si basa su Vercel AI SDK. Include pattern per tool-use, multi-step agents, e streaming UI.

**llm-integration** — Pattern avanzati di integrazione LLM: streaming, function calling, RAG, cost optimization, multi-provider fallback, structured outputs, tool chaining.  
*Per il progetto:* Complementare a ai-sdk — fornisce pattern architetturali per il Kit Generation Engine deterministico e l'orchestrazione multi-step dell'AI assistant.

**prompt-engineering** — Chain-of-thought, few-shot prompting, structured outputs, prompt versioning, A/B testing di prompt.  
*Per il progetto:* Utile per ottimizzare i prompt del Kit Generation Engine e dell'AI assistant vendite.

---

### 1.6 Testing

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **tdd-mastery** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill tdd-mastery` | **ALTA** |
| 2 | **testing-strategies** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill testing-strategies` | **ALTA** |
| 3 | **spartan-ai-toolkit** | `spartan-stratos/spartan-ai-toolkit` | `npx @c0x12c/ai-toolkit@latest --local` | **ALTA** |

#### Dettaglio

**tdd-mastery** — Red-green-refactor, test-first design, coverage targets, unit testing patterns, mocking, stubbing, test isolation.  
*Per il progetto:* Essenziale per garantire qualità del Kit Generation Engine deterministico — ogni regola di generazione kit deve avere test associati.

**testing-strategies** — Contract testing, snapshot testing, property-based testing, integration testing, E2E testing, test pyramid.  
*Per il progetto:* Fondamentale per definire la strategia di testing completa: unit (Vitest), integration (tRPC routers + test DB), E2E (Playwright).

**spartan-ai-toolkit** — Quality gates complete: typecheck → lint → test → review in sequenza. 73 slash commands, 34 skills, 5 quality gates.  
*Per il progetto:* **STRAMENTO CRITICO.** Impedisce a Claude di saltare test o modificare test per farli passare. Workflow: `/spartan:build "feature"` → spec → design → plan → TDD → review → PR.

---

### 1.7 Deployment & DevOps

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **docker-best-practices** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill docker-best-practices` | **MEDIA** |
| 2 | **ci-cd-pipelines** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill ci-cd-pipelines` | **MEDIA** |
| 3 | **devops-automation** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill devops-automation` | **MEDIA** |

#### Dettaglio

**docker-best-practices** — Multi-stage builds, image optimization, compose, security scanning, distroless images.  
*Per il progetto:* Utile per containerizzare l'app Next.js per deployment consistente su Vercel/self-hosted.

**ci-cd-pipelines** — GitHub Actions, matrix builds, caching, deployment strategies (blue-green, canary), semantic versioning.  
*Per il progetto:* Fondamentale per automatizzare test, build e deployment con GitHub Actions.

**devops-automation** — Infrastructure as Code, GitOps, monitoring, incident response, logging.  
*Per il progetto:* Da considerare per la fase di scaling post-lancio.

---

### 1.8 Sicurezza, Auth & GDPR

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **security-hardening** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill security-hardening` | **ALTA** |
| 2 | **authentication-patterns** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill authentication-patterns` | **ALTA** |
| 3 | **gdpr-data-handling** | `sickn33/antigravity-awesome-skills` | `npx skills add sickn33/antigravity-awesome-skills --skill gdpr-data-handling` | **ALTA** |

#### Dettaglio

**security-hardening** — Input validation, auth patterns, secrets management, CSP headers, SQL injection prevention, XSS mitigation, dependency scanning.  
*Per il progetto:* Critica per proteggere il catalogo B2B, le API tRPC, e i dati degli agenti vendita. Include pattern per RBAC e row-level security con PostgreSQL.

**authentication-patterns** — JWT, OAuth2 PKCE, RBAC, session management, NextAuth.js patterns, refresh token rotation, secure cookie configuration.  
*Per il progetto:* Fondamentale per l'implementazione NextAuth con ruoli (admin, agente, pubblico) e RBAC sulle router tRPC.

**gdpr-data-handling** — Consent management, data subject requests (access, deletion, portability), privacy-first architecture, DPA (Data Processing Agreement).  
*Per il progetto:* Essenziale — l'azienda opera in UE. Copre flussi di consenso, gestione richieste DSR, e pattern privacy-by-design per i dati degli agenti vendita.

---

### 1.9 UI/UX & Accessibility

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **frontend-design** | `anthropics/skills` (built-in) | Gia incluso in Claude Code | **ALTA** |
| 2 | **web-design-guidelines** | `vercel-labs/agent-skills` | `npx skills add vercel-labs/agent-skills --skill web-design-guidelines` | **ALTA** |
| 3 | **building-components** | `vercel-labs/agent-skills` | `npx skills add vercel-labs/agent-skills --skill building-components` | **MEDIA** |
| 4 | **accessibility-wcag** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill accessibility-wcag` | **MEDIA** |

#### Dettaglio

**frontend-design** — Skill ufficiale Anthropic (built-in, 124k+ installs). Evita che Claude generi sempre la stessa UI generica (Inter font, purple gradient, grid cards).  
*Per il progetto:* Fondamentale per la dashboard agenti e il catalogo — produce UI che sembra progettata, non generica.

**web-design-guidelines** — 100+ regole di accessibilità, focus handling, form behavior, animation, typography, immagini, performance, navigation, dark mode, touch interaction, i18n. Mantenuta da Vercel Engineering.  
*Per il progetto:* Critica per il catalogo pubblico — verifica ARIA attributes, focus states, label associations, lazy loading immagini prodotti, keyboard navigation.

**building-components** — Guida per costruire UI component con accessibilità, API componibili, theming, pattern a11y.  
*Per il progetto:* Utile per il design system interno del catalogo e delle dashboard.

**accessibility-wcag** — ARIA patterns, keyboard navigation, color contrast, screen reader support, WCAG 2.1 AA compliance.  
*Per il progetto:* Essenziale per garantire l'accessibilità del catalogo pubblico e compliance normativa.

---

## 2. Skill Utility Cross-Funzionali

| # | Skill | Repo | Install | Priorita |
|---|-------|------|---------|----------|
| 1 | **performance-optimization** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill performance-optimization` | **MEDIA** |
| 2 | **monitoring-observability** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill monitoring-observability` | **MEDIA** |
| 3 | **continuous-learning** | `VoltAgent/awesome-agent-skills` | `npx skills add VoltAgent/awesome-agent-skills --skill continuous-learning` | **BASSA** |

**performance-optimization** — Code splitting, image optimization, Core Web Vitals, bundle analysis, lazy loading, font optimization.  
*Per il progetto:* Critica per il catalogo 20k+ prodotti — ottimizzare LCP, CLS, INP con molte immagini prodotto.

**monitoring-observability** — OpenTelemetry, Prometheus, structured logging, health checks, alerting.  
*Per il progetto:* Da attivare in produzione per monitorare le performance dell'AI assistant e del Kit Generation Engine.

---

## 3. CLAUDE.md Template Ottimale

Il file `CLAUDE.md` va nella root del progetto. Claude lo legge automaticamente all'inizio di ogni sessione. Segui i principi: istruzioni imperative, regole testabili, priorita in alto, separa regole stabili da contesto temporaneo.

### Template consigliato

```markdown
# CLAUDE.md — Utensilferramenta Pistoiese B2B Webapp

## WHAT — Descrizione progetto
Applicazione B2B large-scale per Utensilferramenta Pistoiese S.p.A. (29 dipendenti, EUR 9.5M fatturato).
Include: sito pubblico con catalogo 20.000+ prodotti, dashboard agenti vendita con AI assistant,
Kit Generation Engine deterministico. Max 10 agenti concorrenti.

## STACK — Tecnologie
- Next.js 15 (App Router) + React 19 + TypeScript 5.7+
- tRPC 11 + Zod (validation)
- Prisma ORM + PostgreSQL 16 (pgvector extension)
- Redis (BullMQ code)
- NextAuth.js v5 (auth)
- Vercel AI SDK (AI assistant)
- Tailwind CSS + shadcn/ui
- Vitest + Playwright (testing)

## ARCHITECTURE — Pattern fondamentali

### Struttura moduli
- Sito pubblico: /src/app/(public)/ — Server Components default, dynamic per catalogo
- Dashboard agenti: /src/app/(dashboard)/ — Client Components con streaming AI
- API tRPC: /src/server/api/ — router pattern con Prisma context
- Kit Engine: /src/lib/kit-engine/ — logica deterministica, puro TypeScript
- AI Assistant: /src/lib/ai/ — Vercel AI SDK + tool definitions

### Pattern obbligatori
- USA Server Components di default, Client Components SOLO quando necessario (interattività, hooks)
- Ogni router tRPC deve avere Zod input validation
- Ogni query Prisma potenzialmente lenta (>100ms) DEVE avere caching Redis
- Il Kit Generation Engine NON usa LLM — è logica deterministica basata su regole business
- L'AI Assistant usa tool-use con streaming per le dashboard agenti

### Database
- Usa Prisma per TUTTE le query (niente SQL raw tranne migration e seed)
- pgvector per embedding search sui prodotti (AI assistant RAG)
- Implementa Row Level Security (RLS) per dati agenti
- Indici GIN per full-text search su nome prodotto e descrizione

### Auth & RBAC
- Ruoli: PUBLIC (sito catalogo), AGENTE (dashboard), ADMIN (configurazione)
- NextAuth con JWT session, refresh token rotation
- Middleware Next.js per route protection
- tRPC context con user e ruolo per ogni richiesta

## HOW — Convenzioni codice

### TypeScript
- Strict mode ON — nessun `any` implicito
- Usa `satisfies` invece di `as` per type narrowing
- Tipi condivisi in /src/types/ — NO tipi inline duplicati
- Usa Prisma generated types per tutti i modelli DB

### tRPC
- Nomenclatura router: domain-based (productRouter, kitRouter, agentRouter)
- Error handling: usa TRPCError con codici standardizzati
- Input validation: Zod schema per Ogni procedure, anche query semplici
- Middleware: auth middleware su router protetti, logging middleware globale

### React / Next.js
- Server Actions solo per form submission — non per data fetching
- Data fetching: tRPC useQuery/useMutation nelle CC, tRPC caller nelle SC
- Loading states: Suspense boundaries con skeleton components
- Error handling: error.tsx per route segments, Error Boundary per componenti
- Immagini: next/image SEMPRE, con blur placeholder e priority su LCP

### Prisma
- Relations: sempre includere select/explicit include — NO return oggetti nested enormi
- Query prodotti: sempre paginare (cursor-based per >1000 risultati)
- N+1 prevention: usa include strategici o DataLoader pattern
- Migration: generate + deploy manuali, mai reset in produzione

## SECURITY — Regole non negoziabili
- MAI loggare token, password, o dati personali
- MAI esporre chiavi API lato client
- Input sanitization su TUTTI gli endpoint (Zod + Prisma prepared statements)
- CSP headers configurati in next.config.js
- CORS: whitelist domain-specific, mai wildcard in produzione
- GDPR: anonimize IP in analytics, cookie consent banner, DSR endpoint /api/gdpr

## PERFORMANCE — Target
- LCP < 2.5s (pagina prodotto)
- CLS < 0.1 (catalogo con filtri)
- INP < 200ms (dashboard agenti)
- TTFB < 600ms (Server Components)
- Bundle size: < 200KB initial JS

## TESTING — Strategia
- Unit: Vitest per utilità, Kit Engine, hooks — target 80% coverage
- Integration: tRPC router + test database — target 70% coverage  
- E2E: Playwright per flussi critici (ricerca prodotto, generazione kit, login)
- Test data: factory pattern in /src/test/factories/
- Database test: PostgreSQL container con schema isolato per test suite

## TEMPORARY — Contesto corrente
<!-- Aggiorna questa sezione ad ogni sprint -->
- Sprint attuale: [data]
- Feature in sviluppo: [descrizione]
- Note tecniche: [decisioni temporanee]
```

### CLAUDE.local.md
Per contesto temporaneo per-sviluppatore (non committato):
```markdown
# Preferenze personali sviluppatore
- Theme: dark mode per UI mockups
- Stile preferito: composition patterns over HOC
- Region: it-IT per date e numeri
```

---

## 4. Hooks Consigliati

Gli hooks sono script che si attivano a punti specifici del ciclo di vita di Claude Code. Vanno configurati in `.claude/settings.json` o `.claude/hooks/`.

### 4.1 Hook: Auto-format su file write (QUALITY)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_TOOL_INPUT_FILE_PATH\""
          },
          {
            "type": "command", 
            "command": "npx eslint --fix \"$CLAUDE_TOOL_INPUT_FILE_PATH\""
          }
        ]
      }
    ]
  }
}
```
*Per il progetto:* Mantiene il codice formattato consistentemente con le regole del progetto dopo ogni modifica.

### 4.2 Hook: Type check post-edit (QUALITY GATE)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && npx tsc --noEmit --pretty"
          }
        ]
      }
    ]
  }
}
```
*Per il progetto:* Impedisce che codice con errori TypeScript venga lasciato nel progetto.

### 4.3 Hook: Blocca comandi pericolosi (SECURITY)

Crea `.claude/hooks/block-dangerous.sh`:
```bash
#!/bin/bash
COMMAND=$(jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE 'rm -rf|DROP TABLE|DELETE FROM.*WHERE|kubectl delete.*--all'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Comando potenzialmente distruttivo bloccato dall hook di sicurezza"
    }
  }'
else
  exit 0
fi
```

Registra in `.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": ".claude/hooks/block-dangerous.sh" }]
      }
    ]
  }
}
```

### 4.4 Hook: Blocca scrittura file sensibili (SECURITY)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && .claude/hooks/protect-sensitive.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/protect-sensitive.sh`:
```bash
#!/bin/bash
FILE=$(jq -r '.tool_input.file_path // .tool_input.path // empty')
if echo "$FILE" | grep -qE '\.env|secrets|\.ssh|id_rsa|\.pgpass|kubeconfig'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason": "Scrittura file sensibile bloccata"
    }
  }'
else
  exit 0
fi
```

### 4.5 Hook: Quality Gate su Stop (TEST)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Verifica che: 1) I test passino (npm test), 2) TypeScript compili (npx tsc --noEmit), 3) Lint sia pulito (npm run lint). Se qualcosa fallisce, NON fermarti — correggi prima. Rispondi con {\"ok\": false, \"reason\": \"descrizione problema\"} se ci sono problemi."
          }
        ]
      }
    ]
  }
}
```

### 4.6 Hook: Session Start — Context Load

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && echo \"Branch: $(git branch --show-current) | Ultimo commit: $(git log -1 --format=%s) | Stato: $(git status --short | wc -l) file modificati\""
          }
        ]
      }
    ]
  }
}
```

---

## 5. MCP Servers

I MCP (Model Context Protocol) servers danno a Claude accesso a tool esterni. Si configurano in `~/.claude/mcp.json` o `.mcp.json` nel progetto.

### 5.1 PostgreSQL MCP Server (ESSENZIALE)

Permette a Claude di interrogare il database PostgreSQL in tempo reale, eseguire EXPLAIN ANALYZE, esplorare lo schema, e ottimizzare query.

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_URL": "postgresql://user:pass@localhost:5432/utensilferramenta"
      }
    }
  }
}
```

**Tool esposti:** `list_schemas`, `list_objects`, `get_object_details`, `execute_sql`, `explain_query`, `get_top_queries`, `analyze_db_health`

*Per il progetto:* Claude può analizzare lo schema prodotti, ottimizzare query lente, e suggerire indici. Fondamentale per il tuning con 20k+ prodotti.

### 5.2 GitHub MCP Server

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}
```
*Per il progetto:* Automazione PR, gestione issue, code review, collegamento tra codice e task tracker.

### 5.3 Context7 MCP Server

Semantic code search — hybrid BM25 + dense vector search. Riduce il token usage del ~40%.

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-context7"]
    }
  }
}
```
*Per il progetto:* Claude può cercare semanticamente nella codebase per trovare pattern esistenti, riducendo il context window usage.

### 5.4 Playwright MCP Server (per E2E testing)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    }
  }
}
```
*Per il progetto:* Claude può scrivere e debuggare test E2E verificando visivamente le pagine.

### Configurazione completa MCP

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_URL": "postgresql://user:pass@localhost:5432/utensilferramenta"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-context7"]
    }
  }
}
```

---

## 6. Plugin Consigliati

I plugin si installano con `/plugin marketplace add <url>` e poi `/plugin install <nome>`.

| # | Plugin | Install | Scopo |
|---|--------|---------|-------|
| 1 | **spartan-ai-toolkit** | `npx @c0x12c/ai-toolkit@latest --local` | Quality gates, TDD enforcement, workflow completo spec→PR |
| 2 | **security-guidance** | `/plugin marketplace add trailofbits/skills` | Security audit con CodeQL/Semgrep, vulnerability detection |
| 3 | **a11y-audit** | Cercare in marketplace | Full accessibility audit con WCAG compliance |
| 4 | **skills-janitor** | Marketplace | Audit, deduplica, traccia uso delle skill installate |

**Plugin essenziali per questo progetto:**

**Spartan AI Toolkit** — Il piu importante. Quality gates tra ogni step: typecheck → lint → test → review. Impedisce a Claude di scrivere codice senza test, di modificare test per farli passare, o di saltare step del workflow. Comandi principali: `/spartan:build`, `/spartan:debug`, `/spartan:onboard`.

**Security Guidance** — Audit di sicurezza con analisi statica CodeQL e Semgrep. Pattern di rilevamento vulnerabilità comuni. Utile per audit periodici del modulo auth e delle API.

---

## 7. Struttura Directory

### Raccomandazione: Non-monorepo (per iniziare)

Per un team di ~10 sviluppatori e un'unica applicazione coesa, si consiglia un **non-monorepo** con struttura feature-based. Il monorepo (Turborepo) diventa rilevante solo se si separano in pacchetti indipendenti: catalogo pubblico, dashboard agenti, e kit engine come servizi separati.

```
├── .claude/                          # Claude Code configuration
│   ├── hooks/                        # Hook scripts
│   │   ├── block-dangerous.sh
│   │   ├── protect-sensitive.sh
│   │   └── check-quality.sh
│   ├── skills/                       # Skill locali (se create custom)
│   └── settings.json                 # Configurazione hooks e preferenze
├── CLAUDE.md                         # Contesto progetto (read automatically)
├── .mcp.json                         # MCP servers configuration
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (public)/                 # Route group: sito pubblico
│   │   │   ├── page.tsx              # Homepage
│   │   │   ├── catalogo/
│   │   │   │   ├── page.tsx          # Lista prodotti
│   │   │   │   ├── [slug]/
│   │   │   │   │   └── page.tsx      # Dettaglio prodotto
│   │   │   │   └── layout.tsx
│   │   │   ├── categoria/
│   │   │   │   └── [slug]/page.tsx
│   │   │   └── layout.tsx            # Layout pubblico (header/footer)
│   │   ├── (dashboard)/              # Route group: dashboard agenti
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx          # Dashboard overview
│   │   │   │   ├── clienti/
│   │   │   │   ├── kit/
│   │   │   │   │   ├── page.tsx      # Lista kit generati
│   │   │   │   │   ├── nuovo/
│   │   │   │   │   │   └── page.tsx  # Wizard generazione kit
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx  # Dettaglio kit
│   │   │   │   └── ai-assistant/
│   │   │   │       └── page.tsx      # Chat AI assistant
│   │   │   └── layout.tsx            # Layout dashboard (sidebar)
│   │   ├── api/                      # API routes (webhooks, upload)
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css
│   ├── components/                   # Componenti condivisi
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── layout/                   # Header, Footer, Sidebar, Navbar
│   │   ├── product/                  # Card prodotto, Gallery, Specs
│   │   ├── kit/                      # Kit builder UI, Kit viewer
│   │   ├── ai/                       # Chat bubble, Message, Tool calls
│   │   └── forms/                    # Form riutilizzabili
│   ├── server/                       # Backend code
│   │   ├── api/                      # tRPC routers
│   │   │   ├── root.ts               # App router composizione
│   │   │   └── routers/
│   │   │       ├── product.ts        # CRUD prodotti, search
│   │   │       ├── category.ts       # Categorie
│   │   │       ├── kit.ts            # Kit generation engine API
│   │   │       ├── agent.ts          # AI assistant endpoints
│   │   │       ├── auth.ts           # Auth helpers, session
│   │   │       └── analytics.ts      # Dashboard data
│   │   ├── db.ts                     # Prisma client (singleton)
│   │   └── context.ts                # tRPC context builder
│   ├── lib/                          # Librerie e utilità
│   │   ├── ai/                       # AI integration
│   │   │   ├── sdk.ts                # Vercel AI SDK config
│   │   │   ├── tools/                # Tool definitions per AI
│   │   │   ├── prompts/              # Prompt templates
│   │   │   └── rag.ts                # RAG implementation (pgvector)
│   │   ├── kit-engine/               # Kit Generation Engine
│   │   │   ├── rules.ts              # Regole deterministiche
│   │   │   ├── calculator.ts         # Logica calcolo
│   │   │   ├── validator.ts          # Validazione kit
│   │   │   └── types.ts              # Tipi engine
│   │   ├── redis/                    # Redis client e helpers
│   │   ├── auth/                     # NextAuth config, RBAC
│   │   └── utils/                    # Utility generiche
│   ├── hooks/                        # React custom hooks
│   │   ├── use-products.ts           # tRPC product queries
│   │   ├── use-kit.ts                # Kit generation hook
│   │   ├── use-ai-chat.ts            # AI chat streaming
│   │   └── use-auth.ts               # Auth state
│   ├── types/                        # TypeScript shared types
│   │   ├── product.ts
│   │   ├── kit.ts
│   │   ├── agent.ts
│   │   └── index.ts
│   ├── test/                         # Test utilities
│   │   ├── factories/                # Test data factories
│   │   ├── setup.ts                  # Test setup (Vitest)
│   │   └── fixtures/                 # Dati di test
│   └── styles/                       # Stili globali, Tailwind config
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── migrations/                   # Migration files
│   └── seed.ts                       # Seed script
├── public/                           # Assets statici
├── scripts/                          # Script utility
├── docker-compose.yml                # PostgreSQL + Redis locali
├── docker-compose.test.yml           # Stack per test
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

### Quando passare a Monorepo (Turborepo)

Considerare Turborepo quando:
- Il Kit Generation Engine diventa un servizio indipendente
- Si aggiunge un'app mobile (React Native) che condivide i tipi
- Il catalogo pubblico e la dashboard hanno cicli di deploy diversi
- Il team cresce oltre 15 sviluppatori

---

## 8. Checklist Installazione Rapida

### Step 1: Installare skill essenziali (ALTA priorita)

```bash
# Aggiungere marketplace ufficiale Anthropic
/plugin marketplace add anthropics/skills

# Skill Vercel (React/Next.js)
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices -g -y
npx skills add vercel-labs/agent-skills --skill next-best-practices -g -y
npx skills add vercel-labs/agent-skills --skill vercel-composition-patterns -g -y
npx skills add vercel-labs/agent-skills --skill web-design-guidelines -g -y

# Skill AI
npx skills add vercel-labs/agent-skills --skill ai-sdk -g -y
npx skills add vercel-labs/agent-skills --skill building-components -g -y

# Skill TypeScript / Database
npx skills add mattpocock/skills/improve-codebase-architecture -g -y

# Skill testing e qualità
npx skills add VoltAgent/awesome-agent-skills --skill tdd-mastery -g -y
npx skills add VoltAgent/awesome-agent-skills --skill testing-strategies -g -y

# Skill sicurezza e GDPR
npx skills add sickn33/antigravity-awesome-skills --skill gdpr-data-handling -g -y
```

### Step 2: Installare plugin

```bash
# Spartan AI Toolkit (quality gates)
npx @c0x12c/ai-toolkit@latest --local

# Security guidance
/plugin marketplace add trailofbits/skills
/plugin install trailofbits-skills
```

### Step 3: Configurare MCP servers

Creare `~/.claude/mcp.json` con la configurazione PostgreSQL + GitHub + Context7 (vedi sezione 5).

### Step 4: Configurare hooks

```bash
mkdir -p .claude/hooks
# Copiare gli script hook (vedi sezione 4)
chmod +x .claude/hooks/*.sh
```

### Step 5: Creare CLAUDE.md

Copiare il template della sezione 3 nella root del progetto e personalizzarlo.

### Step 6: Verifica installazione

```bash
# Lista skill installate
npx skills list

# Lista plugin
/plugin list

# Lista MCP servers (in Claude Code)
/mcp

# Test hook
claude --debug
```

---

## Riepilogo Priorita

| Categoria | Skill/Tool | Priorita | Motivazione |
|-----------|-----------|----------|-------------|
| React/Next.js | vercel-react-best-practices | **ALTA** | Performance catalogo 20k+ prodotti |
| React/Next.js | next-best-practices | **ALTA** | App Router + RSC corretti |
| AI | ai-sdk | **ALTA** | Core dell'AI assistant vendite |
| AI | llm-integration | **ALTA** | Kit Engine + RAG patterns |
| Testing | spartan-ai-toolkit | **ALTA** | Quality gates, TDD enforcement |
| Testing | tdd-mastery | **ALTA** | Qualità Kit Generation Engine |
| Sicurezza | security-hardening | **ALTA** | Protezione dati B2B |
| Sicurezza | authentication-patterns | **ALTA** | NextAuth + RBAC |
| Sicurezza | gdpr-data-handling | **ALTA** | Compliance UE |
| UI/UX | web-design-guidelines | **ALTA** | Accessibilità catalogo pubblico |
| UI/UX | frontend-design | **ALTA** | UI non generica (built-in) |
| DB | postgres-optimization | **ALTA** | Query 20k+ prodotti |
| DB | MCP PostgreSQL | **ALTA** | Accesso live DB per Claude |
| TypeScript | typescript-advanced | **MEDIA** | Type safety end-to-end |
| React | composition-patterns | **MEDIA** | Design system scalabile |
| DevOps | docker-best-practices | **MEDIA** | Containerizzazione |
| DevOps | ci-cd-pipelines | **MEDIA** | GitHub Actions |
| UI | building-components | **MEDIA** | Component library |
| UI | accessibility-wcag | **MEDIA** | A11y compliance |
| Cache | redis-patterns | **MEDIA** | BullMQ + caching |
| Performance | performance-optimization | **MEDIA** | Core Web Vitals |
| Prompt | prompt-engineering | **BASSA** | Ottimizzazione prompt |

---

*Report generato per Utensilferramenta Pistoiese S.p.A. — Stack: Next.js 15 + React 19 + TypeScript + tRPC + Prisma + PostgreSQL (pgvector) + Redis + NextAuth + Vercel AI SDK*
