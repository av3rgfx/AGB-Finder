# Architettura Tecnica Completa — Utensilferramenta Pistoiese S.p.A.

**Progetto**: WebApp Multifunzione B2B Ferramenta
**Stack**: Next.js 15 + React 19 + TypeScript + tRPC + Prisma + PostgreSQL + Redis (BullMQ)
**AI**: Single-agent con tool-use (Gemini primario, Kimi K2.6 secondario)
**Versione**: 1.0
**Data**: 2025

---

## 0. Aggiornamenti implementativi (2026-07-01) — AUTORITATIVI

> Queste decisioni, prese durante l'implementazione della Fase 1, **prevalgono
> sui capitoli seguenti dove divergono**. I code block originali (es. §6.3
> NextAuth, §2.1 `vector(1536)`) sono storici: la fonte di verità è il codice +
> `CLAUDE.md` + `handoff.md`.

| Tema | Design originale | **Implementato** | Motivo |
|------|------------------|------------------|--------|
| Auth (§1.4, §6.3) | NextAuth v4 (Credentials+JWT, PrismaAdapter) | **Better Auth** (email/password, sessioni DB 8h, plugin admin, `disableSignUp`, tipi inferiti) | LLM Council: Auth.js v5 in sola manutenzione; Better Auth è il successore attivo. Sessioni DB → revoca immediata. |
| Schema User (§2.1) | `passwordHash` su User; enum role/status | User Better Auth (name/emailVerified/`role`,`status` testo/ban) + tabelle **Session/Account/Verification**; password in `Account` | Adapter Better Auth |
| Embedding (§2.1, §4.2) | `vector(1536)` "Gemini" | **`vector(768)`** — `gemini-embedding-001`, `outputDimensionality:768`, L2-normalizzato | 1536 è OpenAI; Gemini = 768 |
| Struttura (§7.5) | mista | **layout T3**: server-only sotto `src/server/`, client tRPC `src/trpc/`, `src/env.ts` (zod) | boundary RSC + scalabilità |
| Raw SQL | "mai tranne migrazioni" | consentito **solo per pgvector**, incapsulato in `RAGEngine` | hybrid search richiede `$queryRaw` |
| Catalogo (Fase 1b) | ~20.000 prodotti | **~6.300** codici reali (listino AGB 2026, parser deterministico) | conteggio effettivo del PDF |

**Istruzioni permanenti di workflow (utente):** usare sempre `/using-superpowers`
(sviluppo), `/llm-council` (dubbi/incongruenze), `/impeccable` (UI/UX); aggiornare
tutti i `.md` a fine di ogni sessione.

**Stato:** Fase 1a ✅ + migrazione Better Auth ✅ · Fase 1b in progettazione.

---

## Indice

1. [System Architecture](#1-system-architecture)
2. [Database Schema (Prisma)](#2-database-schema-prisma)
3. [tRPC API Design](#3-trpc-api-design)
4. [AI Integration Architecture](#4-ai-integration-architecture)
5. [Kit Deterministic Engine](#5-kit-deterministic-engine)
6. [Security & Auth](#6-security--auth)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Piano di Sviluppo Sequenziale](#8-piano-di-sviluppo-sequenziale)

---

## 1. System Architecture

### 1.1 Diagramma Architetturale Completo

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      CLIENT LAYER                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐                 │
│  │   Sito Pubblico     │  │   Dashboard Agente  │  │   Pannello Admin    │                 │
│  │   (Next.js pages)   │  │   (Next.js app)     │  │   (Next.js app)     │                 │
│  │   / - /prodotti     │  │   /dashboard/*      │  │   /admin/*          │                 │
│  │   /chi-siamo        │  │   /kit/*            │  │   /admin/users      │                 │
│  │   /contatti         │  │   /conversations/*  │  │   /admin/settings   │                 │
│  └──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘                 │
│             │                        │                        │                            │
│             └────────────────────────┼────────────────────────┘                            │
│                                      │                                                       │
└──────────────────────────────────────┼───────────────────────────────────────────────────────┘
                                       │ HTTPS / JSON
┌──────────────────────────────────────┼───────────────────────────────────────────────────────┐
│                         NEXT.JS 15 APPLICATION (Vercel)                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐     │
│  │                              SERVER LAYER                                            │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │     │
│  │  │  tRPC       │  │  NextAuth   │  │  BullMQ     │  │  AI Service │  │  RAG     │ │     │
│  │  │  Router     │  │  Handler    │  │  Queue      │  │  Orchestrator│  │  Engine  │ │     │
│  │  │             │  │             │  │             │  │             │  │          │ │     │
│  │  │ • auth      │  │ • Credentials│  │ • kit-gen  │  │ • Tool-use  │  │ • Embed  │ │     │
│  │  │ • user      │  │   (email/pw) │  │ • ai-chat  │  │ • Routing   │  │ • Retrieve│ │    │
│  │  │ • product   │  │ • RBAC      │  │ • export   │  │ • Fallback  │  │ • Hybrid │ │     │
│  │  │ • kit       │  │ • Session   │  │ • fallback │  │ • Streaming │  │ • Rerank │ │     │
│  │  │ • conversation│  │   JWT      │  │ • email    │  │             │  │          │ │     │
│  │  │ • analytics │  │             │  │             │  │             │  │          │ │     │
│  │  │ • settings  │  │             │  │             │  │             │  │          │ │     │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────┬─────┘ │     │
│  │         │                │                │                │              │       │     │
│  │         └────────────────┴────────────────┴────────────────┴──────────────┘       │     │
│  │                                          │                                         │     │
│  │  ┌───────────────────────────────────────┘                                         │     │
│  │  │                          Prisma Client (ORM)                                     │     │
│  │  │                          • Connection pooling (PgBouncer)                        │     │
│  │  │                          • Transaction management                                │     │
│  │  │                          • Raw queries for vector ops                            │     │
│  │  └───────────────────────────────────────┬─────────────────────────────────────────┘     │
│  └──────────────────────────────────────────┼──────────────────────────────────────────────┘
│                                             │ SQL / Connection Pool
└─────────────────────────────────────────────┼───────────────────────────────────────────────┘
                                              │
┌─────────────────────────────────────────────┼───────────────────────────────────────────────┐
│                         DATA & INFRASTRUCTURE LAYER                                        │
│                                             │                                               │
│  ┌────────────────────────────┐    ┌────────┴────────┐    ┌─────────────────────────────┐  │
│  │   NEON (PostgreSQL)        │    │  UPSTASH REDIS  │    │   AI PROVIDERS (External)   │  │
│  │                            │    │                 │    │                             │  │
│  │  ┌──────────────────────┐  │    │  ┌───────────┐  │    │  ┌─────────────────────┐   │  │
│  │  │  relational tables   │  │    │  │BullMQ     │  │    │  │  Google Gemini      │   │  │
│  │  │  • User              │  │    │  │• Queues   │  │    │  │  (Primary)          │   │  │
│  │  │  • Product           │  │    │  │• Workers  │  │    │  │  • chat             │   │  │
│  │  │  • ProductCategory   │  │    │  │• Schedulers│ │    │  │  • search_products  │   │  │
│  │  │  • KitRequest        │  │    │  │• Rate Limiter│ │   │  │  • embedding        │   │  │
│  │  │  • KitComponent      │  │    │  └───────────┘  │    │  └─────────────────────┘   │  │
│  │  │  • KitTemplate       │  │    │                 │    │                             │  │
│  │  │  • Customer          │  │    │  ┌───────────┐  │    │  ┌─────────────────────┐   │  │
│  │  │  • Conversation      │  │    │  │Cache      │  │    │  │  Moonshot Kimi K2.6 │   │  │
│  │  │  • Message           │  │    │  │• Sessions │  │    │  │  (Secondary)        │   │  │
│  │  │  • ActivityLog       │  │    │  │• Rate Lim │  │    │  │  • kit generation   │   │  │
│  │  │  • Settings          │  │    │  │• Pub/Sub  │  │    │  │  • fallback chat    │   │  │
│  │  └──────────────────────┘  │    │  └───────────┘  │    │  └─────────────────────┘   │  │
│  │                            │    │                 │    │                             │  │
│  │  ┌──────────────────────┐  │    └─────────────────┘    └─────────────────────────────┘  │
│  │  │  pgvector extension  │  │                                                              │
│  │  │  • Product embeddings│  │                                                              │
│  │  │  • Hybrid search     │  │                                                              │
│  │  │    (vector + tsvector)│  │                                                              │
│  │  └──────────────────────┘  │                                                              │
│  └────────────────────────────┘                                                              │
│                                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │   EXTERNAL SERVICES                                                                     │  │
│  │   • Resend (email notifications)   • AGB Catalog (product import)   • PDF Generator    │  │
│  └────────────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Flusso Dati End-to-End

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  UTENTE │────▶│  Next.js    │────▶│   tRPC      │────▶│   Prisma    │────▶│ PostgreSQL  │
│         │     │   Server    │     │   Router    │     │   Client    │     │   (Neon)    │
└─────────┘     └─────────────┘     └──────┬──────┘     └─────────────┘     └─────────────┘
     ▲                                      │
     │                               ┌──────┴──────┐
     │                               │             │
     │                         ┌─────▼─────┐ ┌─────▼─────┐
     │                         │  BullMQ   │ │  AI Svc   │
     │                         │  Queue    │ │  Gemini/  │
     │                         │           │ │  Kimi     │
     │                         └─────┬─────┘ └─────┬─────┘
     │                               │             │
     │                         ┌─────▼─────────────▼─────┐
     │                         │       Upstash Redis      │
     │                         └──────────────────────────┘
     │
     └────────────────────────────────────────────────────────────────────
                                  (Response)
```

### 1.3 Separazione Route per Ruolo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS ROUTE STRUCTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PUBLIC ROUTES (no auth)          AGENT ROUTES (auth + agent role)          │
│  ───────────────────────          ────────────────────────────────          │
│  /                                /dashboard                                 │
│  /prodotti                        /dashboard/conversations                   │
│  /prodotti/[slug]                 /dashboard/conversations/[id]              │
│  /chi-siamo                       /dashboard/kit                             │
│  /contatti                        /dashboard/kit/nuovo                       │
│  /login                           /dashboard/kit/[id]                        │
│                                   /dashboard/kit/[id]/pdf                    │
│                                   /dashboard/catalogo                        │
│                                   /dashboard/catalogo/[id]                   │
│                                   /dashboard/clienti                         │
│                                   /dashboard/profilo                         │
│                                                                              │
│  ADMIN ROUTES (auth + admin role)                                            │
│  ─────────────────────────────────                                           │
│  /admin                                                                      │
│  /admin/users                             (gestione utenti)                  │
│  /admin/users/nuovo                       (crea agente)                      │
│  /admin/settings                          (impostazioni AI)                  │
│  /admin/settings/ai                       (provider, prompt, model)          │
│  /admin/settings/api-keys                 (API key Gemini/Kimi)              │
│  /admin/analytics                         (statistiche)                      │
│  /admin/analytics/activity                (log attivita)                     │
│  /admin/analytics/conversations           (analisi chat)                     │
│  /admin/kit-templates                     (template kit)                     │
│  /admin/import                            (import prodotti)                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Flusso Autenticazione

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│  Login   │────▶│ NextAuth.js  │────▶│  Credentials │────▶│   Prisma     │────▶│  User    │
│  Page    │     │  Handler     │     │  Provider    │     │   Query      │     │  Record  │
└──────────┘     └──────────────┘     └──────┬───────┘     └──────────────┘     └────┬─────┘
                                             │                                         │
                                             │    ┌────────────────────────────────────┘
                                             │    │
                                             │    ▼
                                             │ ┌──────────────┐     ┌──────────────┐
                                             └▶│  Bcrypt      │────▶│  JWT Token   │
                                               │  Compare     │     │  (session)   │
                                               └──────────────┘     └──────┬───────┘
                                                                           │
┌──────────────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────────────────────┐
│  tRPC        │────▶│  Middleware  │────▶│  Context Builder                             │
│  Request     │     │  (authCheck) │     │  • Verify JWT                                │
│              │     │              │     │  • Load user with role                       │
│              │     │              │     │  • Attach to ctx.user                        │
│              │     │              │     │  • Enforce RBAC                              │
└──────────────┘     └──────────────┘     └──────────────────────────────────────────────┘
```

### 1.5 Flusso AI Chat con Tool-Use

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────┐
│  User    │────▶│  sendMessage │────▶│  AI Service  │────▶│  Gemini (Primary)            │
│  Message │     │  tRPC mut.   │     │  Orchestrator│     │  • system prompt             │
│          │     │              │     │              │     │  • available tools           │
└──────────┘     └──────────────┘     └──────┬───────┘     │  • streaming                 │
                                             │              └──────────────────────────────┘
                                             │                            │
                                             │                    (tool call?)
                                             │                   ┌──────┴──────┐
                                             │                   │             │
                                             │              YES ▼        NO ▼
                                             │         ┌──────────┐   ┌──────────┐
                                             │         │ Execute  │   │ Stream   │
                                             │         │ Tool     │   │ Response │
                                             │         └────┬─────┘   └────┬─────┘
                                             │              │              │
                                             │              └──────┬───────┘
                                             │                     │
                                             │              ┌──────▼──────┐
                                             └─────────────▶│  Return to  │
                                                            │  User       │
                                                            └─────────────┘

TOOL EXECUTION DETAIL:
┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ search_products│  │ generate_kit     │  │ chat             │
│                │  │                  │  │                  │
│ • Hybrid search│  │ • Validate input │  │ • Direct answer  │
│ • Return JSON  │  │ • Rule lookup    │  │ • No DB access   │
│ • Max 10 items │  │ • Comp. select   │  │ • General info   │
│ • With prices  │  │ • Quantity calc  │  │ • Greeting       │
│                │  │ • Return parts   │  │ • Clarification  │
└───────┬────────┘  └────────┬─────────┘  └──────────────────┘
        │                    │
        └────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  BullMQ (if needed) │
        │  • Long-running kit │
        │  • Fallback queue   │
        │  • Export PDF       │
        └─────────────────────┘
```

### 1.6 Layer Middleware Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         tRPC MIDDLEWARE STACK                                │
│                                                                              │
│  Every Request:                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ logger  │───▶│ rateLim │───▶│ context │───▶│  auth   │───▶│  role   │  │
│  │         │    │         │    │ builder │    │ check   │    │ check   │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                                              │
│  Public API (auth, login):              logger → rateLim → context          │
│  Authenticated API (product, kit):      logger → rateLim → context → auth   │
│  Admin API (user, settings):   logger → rateLim → context → auth → adminRole│
│                                                                              │
│  AI Chat API: logger → rateLim(ai) → context → auth → streamingTimeout      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema (Prisma)

### 2.1 Schema Completo

```prisma
// schema.prisma — Utensilferramenta Pistoiese S.p.A.
// Database: PostgreSQL 16+ with pgvector extension

generator client {
  provider      = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [pgvector(map: "vector")]
}

// ═══════════════════════════════════════════════════════════════
// 1. USER & AUTH
// ═══════════════════════════════════════════════════════════════

enum UserRole {
  PUBLIC    // non-authenticated (sito pubblico)
  AGENT     // agente commerciale (dashboard)
  ADMIN     // amministratore (gestione completa)
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

model User {
  id            String     @id @default(cuid())
  email         String     @unique
  passwordHash  String     @map("password_hash")
  firstName     String     @map("first_name")
  lastName      String     @map("last_name")
  role          UserRole   @default(AGENT)
  status        UserStatus @default(ACTIVE)
  
  // Relations
  conversations Conversation[]
  kitRequests   KitRequest[]   @relation("KitRequestAgent")
  activityLogs  ActivityLog[]
  settings      Settings[]
  
  // Timestamps
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")
  
  // Indexes
  @@index([email])
  @@index([role])
  @@index([status])
  @@map("users")
}

// ═══════════════════════════════════════════════════════════════
// 2. PRODUCT CATALOG
// ═══════════════════════════════════════════════════════════════

model ProductCategory {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?   @db.Text
  imageUrl    String?   @map("image_url")
  
  // Self-referential hierarchy
  parentId    String?   @map("parent_id")
  parent      ProductCategory?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children    ProductCategory[] @relation("CategoryHierarchy")
  
  // Relations
  products    Product[]
  kitTemplates KitTemplate[]
  
  // Timestamps
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  @@index([slug])
  @@index([parentId])
  @@map("product_categories")
}

model Product {
  id              String   @id @default(cuid())
  agbCode         String   @unique @map("agb_code")        // Codice AGB originale
  sku             String   @unique                             // SKU interno
  name            String
  description     String?  @db.Text
  shortDescription String? @map("short_description") @db.Text
  
  // Pricing
  basePrice       Decimal  @map("base_price") @db.Decimal(12, 2)
  discountedPrice Decimal? @map("discounted_price") @db.Decimal(12, 2)
  priceUnit       String   @default("EUR") @map("price_unit")
  
  // Inventory
  stockQuantity   Int      @default(0) @map("stock_quantity")
  isAvailable     Boolean  @default(true) @map("is_available")
  
  // Category
  categoryId      String   @map("category_id")
  category        ProductCategory @relation(fields: [categoryId], references: [id])
  
  // Media
  imageUrls       String[] @map("image_urls")   // Array di URL immagini
  datasheetUrl    String?  @map("datasheet_url")
  
  // Structured specs (JSONB for flexible product attributes)
  specifications  Json?    @map("specifications")
  // Example: {"materiale": "acciaio zincato", "finitura": "argento", "serie": "ARTECH"}
  
  // Dimensions
  weightKg        Decimal? @map("weight_kg") @db.Decimal(8, 3)
  lengthMm        Int?     @map("length_mm")
  widthMm         Int?     @map("width_mm")
  heightMm        Int?     @map("height_mm")
  
  // Search & AI
  searchVector    Unsupported("tsvector")? @map("search_vector")
  embedding       Unsupported("vector(1536)")?  // Gemini embedding dimensions
  
  // Relations
  kitComponents   KitComponent[]
  conversationMessages Message[]  @relation("ReferencedProducts")
  
  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  // Indexes
  @@index([agbCode])
  @@index([sku])
  @@index([categoryId])
  @@index([isAvailable])
  @@index([searchVector], type: Gin)   // GIN index for full-text search
  @@index([embedding], type: Hnsw)     // HNSW index for vector similarity
  @@map("products")
}

// ═══════════════════════════════════════════════════════════════
// 3. KIT SYSTEM
// ═══════════════════════════════════════════════════════════════

enum KitRequestStatus {
  DRAFT
  PENDING_GENERATION
  GENERATING
  COMPLETED
  REVIEWED
  SENT_TO_CUSTOMER
  APPROVED
  REJECTED
}

enum WindowType {
  ANTA_RIBALTA
  ANTA_PROIETTANTE
  ANTA_BATTENTE
  SCORREVOLE_ALZANTE
  SCORREVOLE_TRASLANTE
  VASISTAS
  FINESTRA_TETTO
}

enum MaterialType {
  LEGNO
  PVC
  ALLUMINIO
  LEGNO_ALLUMINIO
  PVC_ALLUMINIO
}

enum HingeSide {
  DESTRA
  SINISTRA
}

enum OpeningDirection {
  TIRARE
  SPINGERE
}

model KitRequest {
  id              String           @id @default(cuid())
  requestNumber   String           @unique @map("request_number")  // KIT-2025-000001
  
  // Input parameters
  windowType      WindowType       @map("window_type")
  widthMm         Int              @map("width_mm")
  heightMm        Int              @map("height_mm")
  material        MaterialType
  airGapMm        Int              @map("air_gap_mm")         // Aria
  axisOffsetMm    Int              @map("axis_offset_mm")    // Asse
  rebateMm        Int              @map("rebate_mm")          // Battuta
  seatMm          Int              @map("seat_mm")            // Sede
  openingSide     HingeSide        @map("opening_side")       // DX / SX
  openingDir      OpeningDirection @map("opening_direction")  // Tirare / Spingere
  finish          String           // Finitura (es. Argento)
  series          String           // Serie (es. ARTECH)
  
  // Additional notes
  notes           String?          @db.Text
  customerNotes   String?          @map("customer_notes") @db.Text
  
  // Status & workflow
  status          KitRequestStatus @default(DRAFT)
  generatedKit    Json?            @map("generated_kit")     // Raw kit output JSON
  
  // Pricing summary
  totalComponents Int              @default(0) @map("total_components")
  totalPrice      Decimal?         @map("total_price") @db.Decimal(12, 2)
  
  // Relations
  agentId         String           @map("agent_id")
  agent           User             @relation("KitRequestAgent", fields: [agentId], references: [id])
  
  customerId      String?          @map("customer_id")
  customer        Customer?        @relation(fields: [customerId], references: [id])
  
  components      KitComponent[]
  
  // PDF export
  pdfUrl          String?          @map("pdf_url")
  pdfGeneratedAt  DateTime?        @map("pdf_generated_at")
  
  // Timestamps
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")
  generatedAt     DateTime?        @map("generated_at")
  
  // Indexes
  @@index([requestNumber])
  @@index([agentId])
  @@index([customerId])
  @@index([status])
  @@index([createdAt])
  @@index([windowType, material, series])
  @@map("kit_requests")
}

model KitComponent {
  id              String   @id @default(cuid())
  
  // Reference
  kitRequestId    String   @map("kit_request_id")
  kitRequest      KitRequest @relation(fields: [kitRequestId], references: [id], onDelete: Cascade)
  
  productId       String   @map("product_id")
  product         Product  @relation(fields: [productId], references: [id])
  
  // Component details
  componentCode   String   @map("component_code")     // Es. "CERNIERA_A_B_140_ARG"
  componentName   String   @map("component_name")     // Nome leggibile
  position        String?  // Posizione montaggio (es. "inferiore DX", "superiore SX")
  quantity        Int      @default(1)
  unitPrice       Decimal  @map("unit_price") @db.Decimal(12, 2)
  totalPrice      Decimal  @map("total_price") @db.Decimal(12, 2)
  
  // Rule metadata
  ruleId          String?  @map("rule_id")            // ID regola applicata
  ruleDescription String?  @map("rule_description") @db.Text
  isOptional      Boolean  @default(false) @map("is_optional")
  isAlternative   Boolean  @default(false) @map("is_alternative")
  
  // Display order
  sortOrder       Int      @default(0) @map("sort_order")
  
  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  // Indexes
  @@index([kitRequestId])
  @@index([productId])
  @@index([componentCode])
  @@index([sortOrder])
  @@unique([kitRequestId, componentCode, position])  // No duplicates per position
  @@map("kit_components")
}

// Kit Templates — regole predefinite per generazione kit
model KitTemplate {
  id              String   @id @default(cuid())
  name            String   // Es. "Anta Ribalta Standard ARTECH"
  description     String?  @db.Text
  
  // Matching criteria (usato per selezionare il template corretto)
  windowType      WindowType?      @map("window_type")
  material        MaterialType?
  series          String?
  
  // Rule definitions (JSON array di regole)
  rules           Json     // Array di regole deterministiche
  // Example: [{"if": {"widthMin": 500, "widthMax": 1000}, "then": {"productCode": "CERN_140", "qty": 2}}]
  
  // Category reference
  categoryId      String?  @map("category_id")
  category        ProductCategory? @relation(fields: [categoryId], references: [id])
  
  isActive        Boolean  @default(true) @map("is_active")
  priority        Int      @default(0)    // Per risoluzione conflitti
  
  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  // Indexes
  @@index([windowType, material, series])
  @@index([isActive])
  @@index([priority])
  @@map("kit_templates")
}

// ═══════════════════════════════════════════════════════════════
// 4. CUSTOMER (B2B)
// ═══════════════════════════════════════════════════════════════

model Customer {
  id            String   @id @default(cuid())
  companyName   String   @map("company_name")
  vatNumber     String?  @unique @map("vat_number")   // Partita IVA
  taxCode       String?  @unique @map("tax_code")     // Codice fiscale
  
  // Contact
  contactName   String?  @map("contact_name")
  contactEmail  String?  @map("contact_email")
  contactPhone  String?  @map("contact_phone")
  
  // Address
  address       String?
  city          String?
  province      String?  // PT, FI, PO, etc.
  zipCode       String?  @map("zip_code")
  country       String   @default("IT")
  
  // Commercial
  customerCode  String?  @unique @map("customer_code") // Codice cliente interno
  priceList     String?  @map("price_list")           // Listino applicato
  paymentTerms  String?  @map("payment_terms")        // Condizioni pagamento
  discount      Decimal? @db.Decimal(5, 2)            // Sconto percentuale
  
  // Relations
  kitRequests   KitRequest[]
  
  // Timestamps
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  // Indexes
  @@index([companyName])
  @@index([vatNumber])
  @@index([customerCode])
  @@map("customers")
}

// ═══════════════════════════════════════════════════════════════
// 5. CONVERSATION SYSTEM (AI Chat)
// ═══════════════════════════════════════════════════════════════

enum ConversationStatus {
  ACTIVE
  ARCHIVED
  DELETED
}

model Conversation {
  id          String             @id @default(cuid())
  title       String             @default("Nuova Conversazione")
  status      ConversationStatus @default(ACTIVE)
  
  // Context for AI
  contextJson Json?              @map("context_json")  // Dati contestuali persistenti
  
  // Relations
  agentId     String             @map("agent_id")
  agent       User               @relation(fields: [agentId], references: [id])
  
  messages    Message[]
  
  // Timestamps
  createdAt   DateTime           @default(now()) @map("created_at")
  updatedAt   DateTime           @updatedAt @map("updated_at")
  
  // Indexes
  @@index([agentId])
  @@index([status])
  @@index([createdAt])
  @@map("conversations")
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
  TOOL
}

enum MessageStatus {
  PENDING
  SENT
  ERROR
  STREAMING
}

model Message {
  id              String        @id @default(cuid())
  
  // Conversation
  conversationId  String        @map("conversation_id")
  conversation    Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  // Message content
  role            MessageRole
  content         String        @db.Text             // Testo markdown
  contentHtml     String?       @map("content_html") @db.Text  // Cached HTML render
  
  // Tool use
  toolName        String?       @map("tool_name")    // Es. "search_products", "generate_kit"
  toolInput       Json?         @map("tool_input")   // Input JSON del tool
  toolOutput      Json?         @map("tool_output")  // Output JSON del tool
  
  // AI metadata
  modelUsed       String?       @map("model_used")   // "gemini-2.5-flash", "kimi-k2.6"
  tokensUsed      Int?          @map("tokens_used")
  latencyMs       Int?          @map("latency_ms")
  
  // Referenced products (from tool search_products)
  referencedProductIds String[] @map("referenced_product_ids")
  referencedProducts   Product[] @relation("ReferencedProducts")
  
  // Status
  status          MessageStatus @default(SENT)
  errorMessage    String?       @map("error_message")
  
  // Timestamps
  createdAt       DateTime      @default(now()) @map("created_at")
  
  // Indexes
  @@index([conversationId])
  @@index([role])
  @@index([createdAt])
  @@index([toolName])
  @@map("messages")
}

// ═══════════════════════════════════════════════════════════════
// 6. ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════

enum ActivityType {
  LOGIN
  LOGOUT
  CONVERSATION_CREATED
  CONVERSATION_MESSAGE
  KIT_REQUEST_CREATED
  KIT_GENERATED
  KIT_EXPORTED_PDF
  PRODUCT_SEARCHED
  CUSTOMER_VIEWED
  SETTINGS_CHANGED
  USER_CREATED
  USER_UPDATED
  IMPORT_EXECUTED
}

model ActivityLog {
  id          String       @id @default(cuid())
  
  // Actor
  userId      String?      @map("user_id")
  user        User?        @relation(fields: [userId], references: [id])
  
  // Activity
  type        ActivityType
  description String       @db.Text
  metadata    Json?        // Dati aggiuntivi strutturati
  
  // IP & device tracking (GDPR — hash IP)
  ipHash      String?      @map("ip_hash")       // SHA-256 hashed IP
  userAgent   String?      @map("user_agent") @db.Text
  
  // Resource reference (polymorphic)
  resourceType String?     @map("resource_type") // "kit_request", "conversation", etc.
  resourceId   String?     @map("resource_id")
  
  // Timestamp
  createdAt   DateTime     @default(now()) @map("created_at")
  
  // Indexes
  @@index([userId])
  @@index([type])
  @@index([createdAt])
  @@index([resourceType, resourceId])
  @@map("activity_logs")
}

// ═══════════════════════════════════════════════════════════════
// 7. SETTINGS
// ═══════════════════════════════════════════════════════════════

enum SettingCategory {
  AI_PROVIDER
  API_KEYS
  COMPANY_INFO
  EMAIL
  RATE_LIMITS
  FEATURE_FLAGS
}

model Settings {
  id          String          @id @default(cuid())
  category    SettingCategory
  key         String
  value       Json            // Valore strutturato
  description String?         @db.Text
  isEncrypted Boolean         @default(false) @map("is_encrypted")  // Per API keys
  
  // Audit
  updatedBy   String          @map("updated_by")
  updater     User            @relation(fields: [updatedBy], references: [id])
  
  // Timestamps
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")
  
  // Indexes
  @@unique([category, key])
  @@index([category])
  @@map("settings")
}

// ═══════════════════════════════════════════════════════════════
// 8. SYNC LOG (for external integrations)
// ═══════════════════════════════════════════════════════════════

enum SyncStatus {
  PENDING
  RUNNING
  SUCCESS
  PARTIAL
  FAILED
}

model SyncLog {
  id          String     @id @default(cuid())
  syncType    String     @map("sync_type")     // "agb_catalog", "customer_db", etc.
  status      SyncStatus @default(PENDING)
  
  // Details
  recordsProcessed Int   @default(0) @map("records_processed")
  recordsInserted  Int   @default(0) @map("records_inserted")
  recordsUpdated   Int   @default(0) @map("records_updated")
  recordsFailed    Int   @default(0) @map("records_failed")
  
  // Error info
  errorMessage String?   @map("error_message") @db.Text
  errorDetails Json?     @map("error_details")
  
  // Timing
  startedAt   DateTime   @map("started_at")
  completedAt DateTime?  @map("completed_at")
  durationMs  Int?       @map("duration_ms")
  
  // Timestamps
  createdAt   DateTime   @default(now()) @map("created_at")
  
  // Indexes
  @@index([syncType])
  @@index([status])
  @@index([createdAt])
  @@map("sync_logs")
}
```

### 2.2 Indici e Ottimizzazioni

```sql
-- Indici aggiuntivi per performance

-- Hybrid search: combina full-text e vector
CREATE INDEX idx_product_hybrid_search ON products USING GIN(search_vector);
CREATE INDEX idx_product_embedding_hnsw ON products USING hnsw(embedding vector_cosine_ops);

-- Indice per ricerca kit per parametri
CREATE INDEX idx_kit_params ON kit_requests(window_type, material, series, width_mm, height_mm);

-- Indice per conversazioni recenti per agente
CREATE INDEX idx_conversation_agent_recent ON conversations(agent_id, created_at DESC);

-- Indice per messaggi per conversazione
CREATE INDEX idx_message_conversation ON messages(conversation_id, created_at);

-- Indice per activity log per utente e data
CREATE INDEX idx_activity_user_date ON activity_logs(user_id, created_at DESC);

-- Trigger per aggiornare search_vector automaticamente
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('italian', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('italian', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('italian', COALESCE(NEW.short_description, '')), 'C') ||
    setweight(to_tsvector('italian', COALESCE(NEW.agb_code, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_search_vector_update
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_search_vector();
```

### 2.3 Migration Initiale

```prisma
// migrations/20250101000000_init/migration.sql

-- Estensione pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable Italian text search
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS italian (COPY = pg_catalog.italian);

-- Tutti i CREATE TABLE sono gestiti da Prisma migrate
-- Gli indici speciali (GIN, HNSW) sono definiti nello schema Prisma
```



---

## 3. tRPC API Design

### 3.1 Struttura Router

```
src/
└── server/
    └── api/
        ├── routers/
        │   ├── _app.ts              # Root router — aggregation
        │   ├── auth.ts              # Auth router (public)
        │   ├── user.ts              # User CRUD (admin only)
        │   ├── product.ts           # Product search & catalog
        │   ├── kit.ts               # Kit generation & management
        │   ├── conversation.ts      # AI chat conversations
        │   ├── analytics.ts         # Dashboard stats
        │   └── settings.ts          # App settings (admin)
        ├── middleware/
        │   ├── auth.ts              # Authentication middleware
        │   ├── rbac.ts              # Role-based access control
        │   ├── rateLimit.ts         # Rate limiting
        │   └── logger.ts            # Request logging
        └── procedures/
            ├── public.ts            # No auth required
            ├── authed.ts            # Auth required (any role)
            ├── agent.ts             # Auth + AGENT role
            └── admin.ts             # Auth + ADMIN role
```

### 3.2 Base Procedures

```typescript
// src/server/api/procedures/public.ts
import { publicProcedure } from "../trpc";

export const publicProcedure = t.procedure
  .use(loggerMiddleware)
  .use(rateLimitMiddleware({ max: 100, windowMs: 60000 }));

// src/server/api/procedures/authed.ts
import { authedProcedure } from "../trpc";

export const authedProcedure = t.procedure
  .use(loggerMiddleware)
  .use(rateLimitMiddleware({ max: 200, windowMs: 60000 }))
  .use(authMiddleware)        // Verifica JWT session
  .use(enforceAuth);          // Richiede utente autenticato

// src/server/api/procedures/agent.ts
export const agentProcedure = authedProcedure
  .use(enforceRole(["AGENT", "ADMIN"]));  // AGENT o ADMIN

// src/server/api/procedures/admin.ts
export const adminProcedure = authedProcedure
  .use(enforceRole(["ADMIN"]));           // Solo ADMIN
```

### 3.3 Auth Router

```typescript
// src/server/api/routers/auth.ts
import { z } from "zod";
import { publicProcedure, authedProcedure } from "../procedures";
import { createRouter } from "../trpc";

export const authRouter = createRouter({
  // ─── LOGIN ─────────────────────────────────────────────────
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("Email non valida"),
        password: z.string().min(1, "Password obbligatoria"),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        user: z.object({
          id: z.string(),
          email: z.string(),
          firstName: z.string(),
          lastName: z.string(),
          role: z.enum(["PUBLIC", "AGENT", "ADMIN"]),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Trova utente per email
      // 2. Verifica password con bcrypt
      // 3. Crea sessione JWT
      // 4. Log activity
      return { success: true, user };
    }),

  // ─── LOGOUT ────────────────────────────────────────────────
  logout: authedProcedure
    .mutation(async ({ ctx }) => {
      // Invalida sessione
      await ctx.session.destroy();
      return { success: true };
    }),

  // ─── GET SESSION (me) ──────────────────────────────────────
  me: publicProcedure
    .output(
      z.object({
        user: z.object({
          id: z.string(),
          email: z.string(),
          firstName: z.string(),
          lastName: z.string(),
          role: z.enum(["PUBLIC", "AGENT", "ADMIN"]),
          status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
        }).nullable(),
      })
    )
    .query(async ({ ctx }) => {
      if (!ctx.session?.user) return { user: null };
      return {
        user: {
          id: ctx.session.user.id,
          email: ctx.session.user.email,
          firstName: ctx.session.user.firstName,
          lastName: ctx.session.user.lastName,
          role: ctx.session.user.role,
          status: ctx.session.user.status,
        },
      };
    }),
});
```

### 3.4 User Router (Admin Only)

```typescript
// src/server/api/routers/user.ts
import { z } from "zod";
import { adminProcedure, authedProcedure } from "../procedures";

export const userRouter = createRouter({
  // ─── LIST USERS ────────────────────────────────────────────
  list: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        role: z.enum(["AGENT", "ADMIN"]).optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
        search: z.string().optional(),
      }).optional()
    )
    .output(
      z.object({
        users: z.array(z.object({
          id: z.string(),
          email: z.string(),
          firstName: z.string(),
          lastName: z.string(),
          role: z.enum(["AGENT", "ADMIN"]),
          status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
          createdAt: z.date(),
          _count: z.object({
            conversations: z.number(),
            kitRequests: z.number(),
          }),
        })),
        total: z.number(),
        page: z.number(),
        totalPages: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page = 1, limit = 20, role, status, search } = input ?? {};
      const where = {
        ...(role && { role }),
        ...(status && { status }),
        ...(search && {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ],
        }),
      };
      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { conversations: true, kitRequests: true } } },
        }),
        ctx.db.user.count({ where }),
      ]);
      return { users, total, page, totalPages: Math.ceil(total / limit) };
    }),

  // ─── CREATE USER ───────────────────────────────────────────
  create: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8, "Minimo 8 caratteri"),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.enum(["AGENT", "ADMIN"]).default("AGENT"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await bcrypt.hash(input.password, 12);
      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          passwordHash: hashedPassword,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          status: "ACTIVE",
        },
      });
      await ctx.logActivity("USER_CREATED", `Creato utente ${user.email}`, { userId: user.id });
      return user;
    }),

  // ─── UPDATE USER ───────────────────────────────────────────
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.enum(["AGENT", "ADMIN"]).optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const user = await ctx.db.user.update({ where: { id }, data });
      await ctx.logActivity("USER_UPDATED", `Aggiornato utente ${user.email}`, { userId: user.id });
      return user;
    }),

  // ─── DELETE USER ───────────────────────────────────────────
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete: set status to INACTIVE
      const user = await ctx.db.user.update({
        where: { id: input.id },
        data: { status: "INACTIVE" },
      });
      return user;
    }),
});
```

### 3.5 Product Router

```typescript
// src/server/api/routers/product.ts
import { z } from "zod";
import { agentProcedure, publicProcedure } from "../procedures";

export const productRouter = createRouter({
  // ─── SEARCH PRODUCTS (Hybrid) ──────────────────────────────
  search: agentProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        categoryId: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
        offset: z.number().min(0).default(0),
        filters: z.object({
          minPrice: z.number().optional(),
          maxPrice: z.number().optional(),
          inStock: z.boolean().optional(),
          material: z.string().optional(),
          series: z.string().optional(),
        }).optional(),
      })
    )
    .output(
      z.object({
        products: z.array(z.object({
          id: z.string(),
          agbCode: z.string(),
          sku: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          basePrice: z.number(),
          discountedPrice: z.number().nullable(),
          stockQuantity: z.number(),
          isAvailable: z.boolean(),
          imageUrls: z.array(z.string()),
          category: z.object({ name: z.string(), slug: z.string() }),
          specifications: z.record(z.string()).nullable(),
          // Relevance scores
          textScore: z.number(),
          vectorScore: z.number().optional(),
        })),
        total: z.number(),
        queryTimeMs: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const start = Date.now();
      
      // 1. Generate embedding for query
      const embedding = await ctx.ai.generateEmbedding(input.query);
      
      // 2. Hybrid search: tsvector + vector similarity
      const products = await ctx.db.$queryRaw`
        SELECT 
          p.id, p.agb_code, p.sku, p.name, p.description,
          p.base_price, p.discounted_price, p.stock_quantity,
          p.is_available, p.image_urls, p.specifications,
          jsonb_build_object('name', c.name, 'slug', c.slug) as category,
          ts_rank(p.search_vector, plainto_tsquery('italian', ${input.query})) as text_score,
          1 - (p.embedding <=> ${embedding}::vector) as vector_score
        FROM products p
        JOIN product_categories c ON p.category_id = c.id
        WHERE 
          p.search_vector @@ plainto_tsquery('italian', ${input.query})
          OR p.embedding <=> ${embedding}::vector < 0.3
        ORDER BY (ts_rank(p.search_vector, plainto_tsquery('italian', ${input.query})) * 0.4 
                + (1 - (p.embedding <=> ${embedding}::vector)) * 0.6) DESC
        LIMIT ${input.limit} OFFSET ${input.offset}
      `;
      
      const total = await ctx.db.product.count({
        where: { isAvailable: true },
      });
      
      return {
        products,
        total,
        queryTimeMs: Date.now() - start,
      };
    }),

  // ─── GET PRODUCT BY ID ─────────────────────────────────────
  getById: agentProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.product.findUnique({
        where: { id: input.id },
        include: { category: true },
      });
    }),

  // ─── GET PRODUCT BY AGB CODE ───────────────────────────────
  getByCode: agentProcedure
    .input(z.object({ agbCode: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.product.findUnique({
        where: { agbCode: input.agbCode },
        include: { category: true },
      });
    }),

  // ─── LIST CATEGORIES ───────────────────────────────────────
  listCategories: publicProcedure
    .input(
      z.object({
        parentId: z.string().nullable().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.productCategory.findMany({
        where: { parentId: input?.parentId ?? null },
        include: {
          children: true,
          _count: { select: { products: true } },
        },
        orderBy: { name: "asc" },
      });
    }),

  // ─── GET RELATED PRODUCTS ──────────────────────────────────
  getRelated: agentProcedure
    .input(
      z.object({
        productId: z.string(),
        limit: z.number().max(10).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findUnique({
        where: { id: input.productId },
      });
      if (!product) return [];
      
      // Vector similarity search
      return ctx.db.$queryRaw`
        SELECT id, agb_code, name, base_price, image_urls
        FROM products
        WHERE id != ${input.productId} AND category_id = ${product.categoryId}
        ORDER BY embedding <=> (
          SELECT embedding FROM products WHERE id = ${input.productId}
        )
        LIMIT ${input.limit}
      `;
    }),
});
```

### 3.6 Kit Router

```typescript
// src/server/api/routers/kit.ts
import { z } from "zod";
import { agentProcedure, adminProcedure } from "../procedures";
import { WindowType, MaterialType, HingeSide, OpeningDirection } from "@prisma/client";

export const kitRouter = createRouter({
  // ─── CREATE KIT REQUEST ────────────────────────────────────
  createRequest: agentProcedure
    .input(
      z.object({
        windowType: z.nativeEnum(WindowType),
        widthMm: z.number().min(300).max(3000),
        heightMm: z.number().min(300).max(3000),
        material: z.nativeEnum(MaterialType),
        airGapMm: z.number().min(4).max(20),
        axisOffsetMm: z.number().min(9).max(20),
        rebateMm: z.number().min(15).max(30),
        seatMm: z.number().min(12).max(22),
        openingSide: z.nativeEnum(HingeSide),
        openingDir: z.nativeEnum(OpeningDirection),
        finish: z.string().min(1),
        series: z.string().min(1),
        notes: z.string().optional(),
        customerId: z.string().optional(),
      })
    )
    .output(z.object({ id: z.string(), requestNumber: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const requestNumber = await generateRequestNumber(ctx.db);
      const kitRequest = await ctx.db.kitRequest.create({
        data: {
          requestNumber,
          ...input,
          agentId: ctx.session.user.id,
          status: "DRAFT",
        },
      });
      return { id: kitRequest.id, requestNumber: kitRequest.requestNumber };
    }),

  // ─── GENERATE KIT (Deterministic Engine) ───────────────────
  generateKit: agentProcedure
    .input(z.object({ id: z.string() }))
    .output(
      z.object({
        success: z.boolean(),
        components: z.array(z.object({
          id: z.string(),
          componentCode: z.string(),
          componentName: z.string(),
          productId: z.string(),
          productName: z.string(),
          position: z.string().nullable(),
          quantity: z.number(),
          unitPrice: z.number(),
          totalPrice: z.number(),
          ruleId: z.string().nullable(),
          isOptional: z.boolean(),
        })),
        totalPrice: z.number(),
        generationTimeMs: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const start = Date.now();
      
      // 1. Fetch kit request
      const kitRequest = await ctx.db.kitRequest.findUnique({
        where: { id: input.id },
      });
      if (!kitRequest) throw new TRPCError({ code: "NOT_FOUND" });
      
      // 2. Update status
      await ctx.db.kitRequest.update({
        where: { id: input.id },
        data: { status: "GENERATING" },
      });
      
      // 3. Run deterministic engine
      const engine = new KitDeterministicEngine(ctx.db);
      const result = await engine.generate(kitRequest);
      
      // 4. Save components
      await ctx.db.kitComponent.createMany({
        data: result.components.map((c, i) => ({
          kitRequestId: input.id,
          productId: c.productId,
          componentCode: c.code,
          componentName: c.name,
          position: c.position,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          totalPrice: c.totalPrice,
          ruleId: c.ruleId,
          ruleDescription: c.ruleDescription,
          isOptional: c.isOptional,
          sortOrder: i,
        })),
      });
      
      // 5. Update kit request
      const totalPrice = result.components.reduce((sum, c) => sum + c.totalPrice, 0);
      await ctx.db.kitRequest.update({
        where: { id: input.id },
        data: {
          status: "COMPLETED",
          totalComponents: result.components.length,
          totalPrice,
          generatedAt: new Date(),
          generatedKit: result as unknown as JsonValue,
        },
      });
      
      // 6. Log activity
      await ctx.logActivity("KIT_GENERATED", `Generato kit ${kitRequest.requestNumber}`, {
        resourceType: "kit_request",
        resourceId: kitRequest.id,
      });
      
      // 7. Return enriched data
      const savedComponents = await ctx.db.kitComponent.findMany({
        where: { kitRequestId: input.id },
        include: { product: true },
        orderBy: { sortOrder: "asc" },
      });
      
      return {
        success: true,
        components: savedComponents,
        totalPrice,
        generationTimeMs: Date.now() - start,
      };
    }),

  // ─── GET KIT REQUESTS ──────────────────────────────────────
  getRequests: agentProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        status: z.nativeEnum(KitRequestStatus).optional(),
        search: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { page = 1, limit = 20, status, search, dateFrom, dateTo } = input ?? {};
      const where = {
        agentId: ctx.session.user.role === "ADMIN" ? undefined : ctx.session.user.id,
        ...(status && { status }),
        ...(search && {
          OR: [
            { requestNumber: { contains: search, mode: "insensitive" } },
            { notes: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(dateFrom && { createdAt: { gte: dateFrom } }),
        ...(dateTo && { createdAt: { lte: dateTo } }),
      };
      
      const [requests, total] = await Promise.all([
        ctx.db.kitRequest.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            agent: { select: { firstName: true, lastName: true } },
            customer: true,
            _count: { select: { components: true } },
          },
        }),
        ctx.db.kitRequest.count({ where }),
      ]);
      
      return { requests, total, page, totalPages: Math.ceil(total / limit) };
    }),

  // ─── GET KIT BY ID ─────────────────────────────────────────
  getById: agentProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.kitRequest.findUnique({
        where: { id: input.id },
        include: {
          components: {
            include: { product: true },
            orderBy: { sortOrder: "asc" },
          },
          agent: { select: { firstName: true, lastName: true } },
          customer: true,
        },
      });
    }),

  // ─── UPDATE KIT STATUS ─────────────────────────────────────
  updateStatus: agentProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(KitRequestStatus),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const kit = await ctx.db.kitRequest.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.notes && { notes: input.notes }),
        },
      });
      return kit;
    }),

  // ─── EXPORT KIT PDF ────────────────────────────────────────
  exportPDF: agentProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Add to BullMQ queue for async PDF generation
      const job = await ctx.queues.pdf.add("generate-kit-pdf", {
        kitRequestId: input.id,
        agentId: ctx.session.user.id,
      }, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });
      return { jobId: job.id };
    }),

  // ─── DELETE KIT REQUEST ────────────────────────────────────
  delete: agentProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.kitRequest.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

### 3.7 Conversation Router (AI Chat)

```typescript
// src/server/api/routers/conversation.ts
import { z } from "zod";
import { agentProcedure } from "../procedures";

export const conversationRouter = createRouter({
  // ─── CREATE CONVERSATION ───────────────────────────────────
  create: agentProcedure
    .input(
      z.object({
        title: z.string().max(200).optional(),
        initialMessage: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await ctx.db.conversation.create({
        data: {
          title: input.title || "Nuova Conversazione",
          agentId: ctx.session.user.id,
        },
      });
      
      // Save user message
      await ctx.db.message.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content: input.initialMessage,
          status: "SENT",
        },
      });
      
      return conversation;
    }),

  // ─── LIST CONVERSATIONS ────────────────────────────────────
  list: agentProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { page = 1, limit = 20, status = "ACTIVE" } = input ?? {};
      return ctx.db.conversation.findMany({
        where: {
          agentId: ctx.session.user.id,
          status,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, createdAt: true, role: true },
          },
        },
      });
    }),

  // ─── GET MESSAGES ──────────────────────────────────────────
  getMessages: agentProcedure
    .input(
      z.object({
        conversationId: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const messages = await ctx.db.message.findMany({
        where: { conversationId: input.conversationId },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "asc" },
        include: {
          referencedProducts: {
            select: { id: true, name: true, agbCode: true, basePrice: true, imageUrls: true },
          },
        },
      });
      return messages;
    }),

  // ─── SEND MESSAGE (AI Integration) ─────────────────────────
  sendMessage: agentProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string().min(1).max(4000),
      })
    )
    .output(
      z.object({
        messageId: z.string(),
        content: z.string(),
        toolUsed: z.string().nullable(),
        referencedProducts: z.array(z.object({
          id: z.string(),
          name: z.string(),
          agbCode: z.string(),
        })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const start = Date.now();
      
      // 1. Save user message
      await ctx.db.message.create({
        data: {
          conversationId: input.conversationId,
          role: "USER",
          content: input.content,
          status: "SENT",
        },
      });
      
      // 2. Get conversation history
      const history = await ctx.db.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "asc" },
        take: 20, // Last 20 messages for context
      });
      
      // 3. Call AI Service
      const aiService = new AIService(ctx.db, ctx.redis);
      const response = await aiService.chat({
        messages: history.map(m => ({ role: m.role, content: m.content })),
        tools: ["search_products", "generate_kit", "chat"],
        userId: ctx.session.user.id,
      });
      
      // 4. Save AI response
      const message = await ctx.db.message.create({
        data: {
          conversationId: input.conversationId,
          role: "ASSISTANT",
          content: response.content,
          toolName: response.toolUsed,
          toolInput: response.toolInput,
          toolOutput: response.toolOutput,
          modelUsed: response.modelUsed,
          tokensUsed: response.tokensUsed,
          latencyMs: Date.now() - start,
          status: "SENT",
        },
        include: {
          referencedProducts: true,
        },
      });
      
      // 5. Update conversation timestamp
      await ctx.db.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });
      
      return {
        messageId: message.id,
        content: message.content,
        toolUsed: message.toolName,
        referencedProducts: message.referencedProducts,
      };
    }),

  // ─── ARCHIVE CONVERSATION ──────────────────────────────────
  archive: agentProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.conversation.update({
        where: { id: input.id },
        data: { status: "ARCHIVED" },
      });
    }),

  // ─── DELETE CONVERSATION ───────────────────────────────────
  delete: agentProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.conversation.update({
        where: { id: input.id },
        data: { status: "DELETED" },
      });
    }),
});
```

### 3.8 Analytics Router

```typescript
// src/server/api/routers/analytics.ts
import { z } from "zod";
import { adminProcedure, agentProcedure } from "../procedures";

export const analyticsRouter = createRouter({
  // ─── DASHBOARD STATS ───────────────────────────────────────
  dashboard: adminProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const [
        totalConversations,
        totalKitRequests,
        totalAgents,
        recentActivity,
        kitByStatus,
        conversationsByDay,
      ] = await Promise.all([
        ctx.db.conversation.count(),
        ctx.db.kitRequest.count(),
        ctx.db.user.count({ where: { role: "AGENT" } }),
        ctx.db.activityLog.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { firstName: true, lastName: true } } },
        }),
        ctx.db.kitRequest.groupBy({
          by: ["status"],
          _count: { id: true },
        }),
        ctx.db.$queryRaw`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM conversations
          WHERE created_at >= ${thirtyDaysAgo}
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `,
      ]);
      
      return {
        totalConversations,
        totalKitRequests,
        totalAgents,
        recentActivity,
        kitByStatus,
        conversationsByDay,
      };
    }),

  // ─── ACTIVITY LOG ──────────────────────────────────────────
  activityLog: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        userId: z.string().optional(),
        type: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { page = 1, limit = 50, userId, type, dateFrom, dateTo } = input ?? {};
      const where = {
        ...(userId && { userId }),
        ...(type && { type }),
        ...(dateFrom && { createdAt: { gte: dateFrom } }),
        ...(dateTo && { createdAt: { lte: dateTo } }),
      };
      
      const [logs, total] = await Promise.all([
        ctx.db.activityLog.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        }),
        ctx.db.activityLog.count({ where }),
      ]);
      
      return { logs, total, page, totalPages: Math.ceil(total / limit) };
    }),

  // ─── CONVERSATION ANALYTICS ────────────────────────────────
  conversations: adminProcedure
    .input(
      z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const dateFrom = input?.dateFrom ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = input?.dateTo ?? new Date();
      
      return ctx.db.$queryRaw`
        SELECT 
          u.first_name || ' ' || u.last_name as agent_name,
          COUNT(c.id) as conversation_count,
          COUNT(m.id) as message_count,
          AVG(m.tokens_used) as avg_tokens,
          AVG(m.latency_ms) as avg_latency
        FROM users u
        LEFT JOIN conversations c ON c.agent_id = u.id 
          AND c.created_at BETWEEN ${dateFrom} AND ${dateTo}
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE u.role = 'AGENT'
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY conversation_count DESC
      `;
    }),

  // ─── KIT ANALYTICS ─────────────────────────────────────────
  kits: adminProcedure
    .query(async ({ ctx }) => {
      const stats = await ctx.db.$queryRaw`
        SELECT 
          window_type,
          material,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (generated_at - created_at))) as avg_generation_seconds
        FROM kit_requests
        WHERE generated_at IS NOT NULL
        GROUP BY window_type, material
        ORDER BY count DESC
      `;
      return stats;
    }),
});
```

### 3.9 Settings Router (Admin Only)

```typescript
// src/server/api/routers/settings.ts
import { z } from "zod";
import { adminProcedure } from "../procedures";

export const settingsRouter = createRouter({
  // ─── GET SETTINGS BY CATEGORY ──────────────────────────────
  getByCategory: adminProcedure
    .input(z.object({ category: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.settings.findMany({
        where: { category: input.category as SettingCategory },
        orderBy: { key: "asc" },
      });
    }),

  // ─── GET SINGLE SETTING ────────────────────────────────────
  get: adminProcedure
    .input(z.object({ category: z.string(), key: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.settings.findUnique({
        where: {
          category_key: {
            category: input.category as SettingCategory,
            key: input.key,
          },
        },
      });
    }),

  // ─── UPDATE SETTING ────────────────────────────────────────
  update: adminProcedure
    .input(
      z.object({
        category: z.string(),
        key: z.string(),
        value: z.any(),  // JSON value
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const setting = await ctx.db.settings.upsert({
        where: {
          category_key: {
            category: input.category as SettingCategory,
            key: input.key,
          },
        },
        create: {
          category: input.category as SettingCategory,
          key: input.key,
          value: input.value,
          description: input.description,
          updatedBy: ctx.session.user.id,
        },
        update: {
          value: input.value,
          description: input.description,
          updatedBy: ctx.session.user.id,
        },
      });
      
      await ctx.logActivity("SETTINGS_CHANGED", 
        `Aggiornata impostazione ${input.category}.${input.key}`, {
        resourceType: "settings",
        resourceId: setting.id,
      });
      
      return setting;
    }),

  // ─── BULK UPDATE ───────────────────────────────────────────
  bulkUpdate: adminProcedure
    .input(
      z.array(z.object({
        category: z.string(),
        key: z.string(),
        value: z.any(),
      }))
    )
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.all(
        input.map(s =>
          ctx.db.settings.upsert({
            where: {
              category_key: {
                category: s.category as SettingCategory,
                key: s.key,
              },
            },
            create: {
              category: s.category as SettingCategory,
              key: s.key,
              value: s.value,
              updatedBy: ctx.session.user.id,
            },
            update: {
              value: s.value,
              updatedBy: ctx.session.user.id,
            },
          })
        )
      );
      return results;
    }),
});
```

### 3.10 Root Router Aggregation

```typescript
// src/server/api/routers/_app.ts
import { router } from "../trpc";
import { authRouter } from "./auth";
import { userRouter } from "./user";
import { productRouter } from "./product";
import { kitRouter } from "./kit";
import { conversationRouter } from "./conversation";
import { analyticsRouter } from "./analytics";
import { settingsRouter } from "./settings";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  product: productRouter,
  kit: kitRouter,
  conversation: conversationRouter,
  analytics: analyticsRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
```

---

## 4. AI Integration Architecture

### 4.1 Diagramma Flusso Chat AI Completo

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              AI CHAT FLOW                                                    │
│                                                                                              │
│   ┌──────────┐                                                                              │
│   │  User    │─── "Cerca cerniere per anta ribalta ARTECH"                                  │
│   │  Input   │                                                                              │
│   └────┬─────┘                                                                              │
│        │                                                                                     │
│        ▼                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────┐           │
│   │                        AI SERVICE ORCHESTRATOR                               │           │
│   │                                                                              │           │
│   │  Step 1: Build System Prompt                                                  │           │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐ │           │
│   │  │ Sei l'assistente AI di Utensilferramenta Pistoiese.                    │ │           │
│   │  │ Tools disponibili: search_products, generate_kit, chat                │ │           │
│   │  │ Contesto: catalogo AGB, prezzi in EUR, lingua italiana               │ │           │           │
│   │  │ Istruzioni: usa tool quando necessario, altrimenti rispondi          │ │           │
│   │  │ in modo conversazionale e professionale.                             │ │           │
│   │  └─────────────────────────────────────────────────────────────────────────┘ │           │
│   │                                                                              │           │
│   │  Step 2: Build Message History (last 20)                                    │           │
│   │  Step 3: Detect tool-use intent                                             │           │
│   │                                                                              │           │
│   │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │           │
│   │  │  Intent     │───▶│  Tool       │───▶│  Execute    │                    │           │
│   │  │  Detection  │    │  Selection  │    │  Tool       │                    │           │
│   │  │             │    │             │    │             │                    │           │
│   │  │ "cerca"     │    │ search_     │    │ DB Query /  │                    │           │
│   │  │ "trova"     │    │ products    │    │ Engine      │                    │           │
│   │  │ "kit"       │───▶│ generate_kit│───▶│ Determin.   │                    │           │
│   │  │ "elenco"    │    │             │    │             │                    │           │
│   │  │ "prezzo"    │    │ chat        │    │             │                    │           │
│   │  │ "genera"    │    │ (default)   │    │             │                    │           │
│   │  └─────────────┘    └─────────────┘    └─────────────┘                    │           │
│   │                                                                              │           │
│   │  Step 4: Call AI Provider (Gemini Primary)                                  │           │
│   │                                                                              │           │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐ │           │
│   │  │  Gemini API:                                                            │ │           │
│   │  │    model: gemini-2.5-flash                                              │ │           │
│   │  │    temperature: 0.3                                                     │ │           │
│   │  │    maxOutputTokens: 2048                                                │ │           │
│   │  │    tools: [search_products_schema, generate_kit_schema]                │ │           │
│   │  │    functionCallingConfig: AUTO                                        │ │           │
│   │  └─────────────────────────────────────────────────────────────────────────┘ │           │
│   │                                                                              │           │
│   │  Step 5: Handle Tool Call (if any)                                          │           │
│   │  Step 6: Stream/Return Response                                             │           │
│   │                                                                              │           │
│   └─────────────────────────────────────────────────────────────────────────────┘           │
│                                         │                                                    │
│                                         ▼                                                    │
│   ┌─────────────────────────────────────────────────────────────────────────────┐           │
│   │                         TOOL EXECUTION DETAIL                                │           │
│   │                                                                              │           │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐ │           │
│   │  │  search_products Tool                                                   │ │           │
│   │  │  ─────────────────                                                      │ │           │
│   │  │  Input: {query: "cerniere anta ribalta ARTECH", limit: 10}              │ │           │
│   │  │  ↓                                                                      │ │           │
│   │  │  Hybrid Search:                                                         │ │           │
│   │  │    1. Generate embedding(query)                                         │ │           │
│   │  │    2. tsvector @@ plainto_tsquery('italian', query)                     │ │           │
│   │  │    3. vector similarity < 0.3                                           │ │           │
│   │  │    4. Combine scores (text 40% + vector 60%)                            │ │           │
│   │  │    5. Return top 10 products with prices                                │ │           │
│   │  │  ↓                                                                      │ │           │
│   │  │  Format: JSON array {id, agbCode, name, price, stock, specs}            │ │           │
│   │  └─────────────────────────────────────────────────────────────────────────┘ │           │
│   │                                                                              │           │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐ │           │
│   │  │  generate_kit Tool                                                      │ │           │
│   │  │  ──────────────                                                         │ │           │
│   │  │  Input: {windowType, widthMm, heightMm, material, airGap, ...}          │ │           │
│   │  │  ↓                                                                      │ │           │
│   │  │  Validation: check dimensions, material compatibility                    │ │           │
│   │  │  ↓                                                                      │ │           │
│   │  │  Rule Engine: lookup matching template → apply rules → select parts      │ │           │
│   │  │  ↓                                                                      │ │           │
│   │  │  Quantity Calculation: based on dimensions                               │ │           │
│   │  │  ↓                                                                      │ │           │
│   │  │  Output: JSON {components: [...], totalPrice, ruleIds}                   │ │           │
│   │  └─────────────────────────────────────────────────────────────────────────┘ │           │
│   │                                                                              │           │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐ │           │
│   │  │  chat Tool (default)                                                    │ │           │
│   │  │  ─────────────────                                                      │ │           │
│   │  │  Direct response, no DB access                                          │ │           │
│   │  │  General info, greetings, clarifications                                │ │           │
│   │  └─────────────────────────────────────────────────────────────────────────┘ │           │
│   │                                                                              │           │
│   └─────────────────────────────────────────────────────────────────────────────┘           │
│                                         │                                                    │
│                                         ▼                                                    │
│   ┌─────────────────────────────────────────────────────────────────────────────┐           │
│   │                              FALLBACK SYSTEM                                 │           │
│   │                                                                              │           │
│   │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │           │
│   │  │  Gemini     │───▶│  Error?     │───▶│  Kimi K2.6  │───▶│  Error?     │  │           │
│   │  │  (Primary)  │    │  (detect)   │    │  (Secondary)│    │  Queue      │  │           │
│   │  │             │    │             │    │             │    │  Retry      │  │           │
│   │  │  Timeout    │    │  429/500    │    │  Timeout    │    │  BullMQ     │  │           │
│   │  │  15s        │    │  Key exp.   │    │  20s        │    │  Delay 30s  │  │           │
│   │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │           │
│   │                                                                              │           │
│   └─────────────────────────────────────────────────────────────────────────────┘           │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 RAG Implementation

```typescript
// src/server/ai/rag.ts

import { PrismaClient } from "@prisma/client";

interface RAGConfig {
  topK: number;
  similarityThreshold: number;
  textWeight: number;
  vectorWeight: number;
}

const DEFAULT_RAG_CONFIG: RAGConfig = {
  topK: 10,
  similarityThreshold: 0.3,
  textWeight: 0.4,
  vectorWeight: 0.6,
};

export class RAGEngine {
  constructor(
    private db: PrismaClient,
    private embeddingService: EmbeddingService,
    private config: RAGConfig = DEFAULT_RAG_CONFIG
  ) {}

  /**
   * Hybrid Search: combina full-text search (tsvector) e vector similarity
   * 
   * Algoritmo:
   * 1. Genera embedding della query
   * 2. Cerca con tsvector (full-text italiano)
   * 3. Cerca con vector similarity (cosine distance)
   * 4. Combina i risultati con weighted score
   * 5. Rerank e ritorna top-K
   */
  async search(query: string, filters?: ProductFilters): Promise<RAGResult[]> {
    const embedding = await this.embeddingService.generate(query);
    
    const results = await this.db.$queryRaw<RAGResult[]>`
      WITH text_search AS (
        SELECT 
          p.id,
          ts_rank(p.search_vector, plainto_tsquery('italian', ${query})) as text_score,
          0::real as vector_score
        FROM products p
        WHERE p.search_vector @@ plainto_tsquery('italian', ${query})
      ),
      vector_search AS (
        SELECT 
          p.id,
          0::real as text_score,
          1 - (p.embedding <=> ${embedding}::vector) as vector_score
        FROM products p
        WHERE p.embedding <=> ${embedding}::vector < ${this.config.similarityThreshold}
      ),
      combined AS (
        SELECT 
          COALESCE(t.id, v.id) as id,
          COALESCE(MAX(t.text_score), 0) * ${this.config.textWeight} +
          COALESCE(MAX(v.vector_score), 0) * ${this.config.vectorWeight} as score
        FROM text_search t
        FULL OUTER JOIN vector_search v ON t.id = v.id
        GROUP BY COALESCE(t.id, v.id)
        HAVING COALESCE(MAX(t.text_score), 0) * ${this.config.textWeight} +
               COALESCE(MAX(v.vector_score), 0) * ${this.config.vectorWeight} > 0.1
      )
      SELECT 
        p.id,
        p.agb_code as "agbCode",
        p.sku,
        p.name,
        p.description,
        p.base_price as "basePrice",
        p.discounted_price as "discountedPrice",
        p.stock_quantity as "stockQuantity",
        p.is_available as "isAvailable",
        p.image_urls as "imageUrls",
        p.specifications,
        jsonb_build_object('name', c.name, 'slug', c.slug) as category,
        c.score
      FROM products p
      JOIN combined c ON p.id = c.id
      JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.is_available = true
      ORDER BY c.score DESC
      LIMIT ${this.config.topK}
    `;
    
    return results;
  }

  /**
   * Genera embedding per un prodotto (usato durante import)
   */
  async indexProduct(productId: string): Promise<void> {
    const product = await this.db.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    
    if (!product) return;
    
    const text = `${product.name}. ${product.description || ""}. ${product.shortDescription || ""}. 
                  Categoria: ${product.category?.name || ""}. 
                  Specifiche: ${JSON.stringify(product.specifications || {})}`;
    
    const embedding = await this.embeddingService.generate(text);
    
    await this.db.$executeRaw`
      UPDATE products 
      SET embedding = ${embedding}::vector 
      WHERE id = ${productId}
    `;
  }
}

// Embedding Service — wrapper Gemini Embedding
export class EmbeddingService {
  async generate(text: string): Promise<number[]> {
    // Usa Gemini Embedding API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: text.slice(0, 8000) }] },
          taskType: "RETRIEVAL_QUERY",
        }),
      }
    );
    
    const data = await response.json();
    return data.embedding.values;
  }
}
```

### 4.3 Tool-Use Schema

```typescript
// src/server/ai/tools.ts

import { z } from "zod";

/**
 * Tool 1: search_products
 * Cerca prodotti nel catalogo AGB usando hybrid search
 */
export const searchProductsSchema = {
  name: "search_products",
  description: `Cerca prodotti nel catalogo AGB di Utensilferramenta Pistoiese.
  Usa questo tool quando l'utente cerca prodotti, chiede prezzi, disponibilita,
  o informazioni su articoli specifici.
  Esempi: "cerniere AGB", "prezzo cerniera 140kg", "cosa avete per anta ribalta?"`,
  parameters: z.object({
    query: z.string().describe("Query di ricerca in italiano"),
    category: z.string().optional().describe("Filtra per categoria (es. 'cerniere', 'maniglie')"),
    limit: z.number().min(1).max(20).default(10).describe("Numero massimo risultati"),
  }),
  execute: async (args: { query: string; category?: string; limit?: number }, ctx: ToolContext) => {
    const rag = new RAGEngine(ctx.db, ctx.embeddingService);
    const results = await rag.search(args.query, {
      category: args.category,
      limit: args.limit ?? 10,
    });
    return {
      products: results.map(r => ({
        codice: r.agbCode,
        nome: r.name,
        prezzo: r.discountedPrice ?? r.basePrice,
        disponibilita: r.stockQuantity > 0 ? "disponibile" : "non disponibile",
        descrizione: r.description,
      })),
      total: results.length,
    };
  },
};

/**
 * Tool 2: generate_kit
 * Genera un kit completo per una finestra usando il deterministic engine
 */
export const generateKitSchema = {
  name: "generate_kit",
  description: `Genera un kit completo di ferramenta per una finestra o porta finestra.
  Richiede tutti i parametri della finestra per selezionare i componenti corretti.
  Esempi: "genera kit per anta ribalta 1000x1600 legno aria 12 asse 13", 
  "kit per finestra scorrevole 1200x1400 alluminio"`,
  parameters: z.object({
    windowType: z.enum([
      "ANTA_RIBALTA", "ANTA_PROIETTANTE", "ANTA_BATTENTE",
      "SCORREVOLE_ALZANTE", "SCORREVOLE_TRASLANTE", "VASISTAS", "FINESTRA_TETTO"
    ]).describe("Tipo di apertura della finestra"),
    widthMm: z.number().min(300).max(3000).describe("Larghezza anta in mm"),
    heightMm: z.number().min(300).max(3000).describe("Altezza anta in mm"),
    material: z.enum(["LEGNO", "PVC", "ALLUMINIO", "LEGNO_ALLUMINIO", "PVC_ALLUMINIO"])
      .describe("Materiale del telaio e anta"),
    airGapMm: z.number().min(4).max(20).describe("Aria (distanza tra telaio e anta) in mm"),
    axisOffsetMm: z.number().min(9).max(20).describe("Asse (distanza dal bordo) in mm"),
    rebateMm: z.number().min(15).max(30).describe("Battuta (profondita dello sconto) in mm"),
    seatMm: z.number().min(12).max(22).describe("Sede (profondita alloggio cerniera) in mm"),
    openingSide: z.enum(["DESTRA", "SINISTRA"]).describe("Lato apertura (battente)"),
    openingDir: z.enum(["TIRARE", "SPINGERE"]).describe("Direzione apertura"),
    finish: z.string().describe("Finitura (es. Argento, Bronzo, Bianco)"),
    series: z.string().describe("Serie prodotto AGB (es. ARTECH, ECLIPSE, HERCULES)"),
    notes: z.string().optional().describe("Note aggiuntive"),
  }),
  execute: async (args: KitInput, ctx: ToolContext) => {
    const engine = new KitDeterministicEngine(ctx.db);
    const result = await engine.generate(args);
    return {
      kit: {
        tipoFinestra: args.windowType,
        dimensioni: `${args.widthMm}x${args.heightMm}`,
        materiale: args.material,
        componenti: result.components.map(c => ({
          codice: c.code,
          nome: c.name,
          quantita: c.quantity,
          prezzoUnitario: c.unitPrice,
          prezzoTotale: c.totalPrice,
          posizione: c.position,
          obbligatorio: !c.isOptional,
        })),
        prezzoTotale: result.totalPrice,
        numeroComponenti: result.components.length,
      },
      nota: "I prezzi sono indicativi. Verificare disponibilita e listino applicato.",
    };
  },
};

/**
 * Tool 3: chat
 * Risposta conversazionale diretta, senza accesso al database
 */
export const chatSchema = {
  name: "chat",
  description: `Usa questo tool per rispondere a domande generali, saluti,
  richieste di chiarimento, o quando nessun altro tool e necessario.
  Esempi: "Ciao", "Come funziona?", "Quali sono gli orari?"`,
  parameters: z.object({
    response: z.string().describe("Risposta da restituire all'utente"),
  }),
  execute: async (args: { response: string }) => {
    return { message: args.response };
  },
};

// Registry di tutti i tool
export const AI_TOOLS = [
  searchProductsSchema,
  generateKitSchema,
  chatSchema,
] as const;

export type ToolName = typeof AI_TOOLS[number]["name"];
```

### 4.4 AI Service Orchestrator

```typescript
// src/server/ai/service.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "ioredis";
import { Queue } from "bullmq";

interface AIServiceConfig {
  geminiApiKey: string;
  kimiApiKey: string;
  geminiModel: string;
  kimiModel: string;
  timeoutMs: number;
  fallbackEnabled: boolean;
}

export class AIService {
  private gemini: GoogleGenerativeAI;
  private kimiClient: KimiClient;
  private queue: Queue;
  
  constructor(
    private db: PrismaClient,
    private redis: Redis,
    private config: AIServiceConfig
  ) {
    this.gemini = new GoogleGenerativeAI(config.geminiApiKey);
    this.kimiClient = new KimiClient(config.kimiApiKey);
    this.queue = new Queue("ai-fallback", { connection: redis });
  }

  /**
   * Chat principale: gestisce tool-use, streaming, fallback
   */
  async chat(params: {
    messages: Array<{ role: string; content: string }>;
    tools: ToolName[];
    userId: string;
  }): Promise<AIResponse> {
    const startTime = Date.now();
    
    // Rate limiting check
    const rateLimitKey = `ai:ratelimit:${params.userId}`;
    const currentCount = await this.redis.incr(rateLimitKey);
    if (currentCount === 1) {
      await this.redis.expire(rateLimitKey, 60); // 1 minute window
    }
    if (currentCount > 30) { // 30 requests/minute per user
      throw new AIRateLimitError("Troppo richieste. Attendi un minuto.");
    }

    try {
      // Primary: Gemini
      return await this.callGemini(params, startTime);
    } catch (error) {
      console.error("Gemini error:", error);
      
      if (!this.config.fallbackEnabled) {
        throw error;
      }
      
      // Fallback: Kimi K2.6
      try {
        return await this.callKimi(params, startTime);
      } catch (kimiError) {
        console.error("Kimi error:", kimiError);
        
        // Queue for retry
        await this.queue.add("ai-retry", {
          params,
          originalErrors: [error.message, kimiError.message],
        }, {
          delay: 30000,
          attempts: 3,
        });
        
        throw new AIServiceError("Servizio AI momentaneamente non disponibile. Riprova tra poco.");
      }
    }
  }

  private async callGemini(params: ChatParams, startTime: number): Promise<AIResponse> {
    const model = this.gemini.getGenerativeModel({
      model: this.config.geminiModel,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
      tools: this.buildGeminiTools(params.tools),
    });

    const chat = model.startChat({
      history: params.messages.slice(0, -1).map(m => ({
        role: m.role === "USER" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = params.messages[params.messages.length - 1];
    
    const result = await Promise.race([
      chat.sendMessage(lastMessage.content),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), this.config.timeoutMs)
      ),
    ]);

    // Handle tool calls
    const functionCalls = result.response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const toolResults = await Promise.all(
        functionCalls.map(async (fc) => {
          const tool = AI_TOOLS.find(t => t.name === fc.name);
          if (!tool) return null;
          return {
            functionResponse: {
              name: fc.name,
              response: await tool.execute(fc.args, { db: this.db }),
            },
          };
        })
      );
      
      // Send tool results back to model
      const finalResult = await chat.sendMessage(
        toolResults.filter(Boolean).map(tr => ({
          functionResponse: tr.functionResponse,
        }))
      );
      
      return {
        content: finalResult.response.text(),
        toolUsed: functionCalls[0].name,
        toolInput: functionCalls[0].args,
        modelUsed: this.config.geminiModel,
        tokensUsed: result.response.usageMetadata?.totalTokenCount,
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      content: result.response.text(),
      toolUsed: null,
      modelUsed: this.config.geminiModel,
      tokensUsed: result.response.usageMetadata?.totalTokenCount,
      latencyMs: Date.now() - startTime,
    };
  }

  private async callKimi(params: ChatParams, startTime: number): Promise<AIResponse> {
    // Implementation per Kimi K2.6 API
    const response = await this.kimiClient.chat.completions.create({
      model: this.config.kimiModel,
      messages: params.messages.map(m => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      tools: this.buildKimiTools(params.tools),
      temperature: 0.3,
      max_tokens: 2048,
    });

    const message = response.choices[0].message;
    
    if (message.tool_calls) {
      const toolCall = message.tool_calls[0];
      const tool = AI_TOOLS.find(t => t.name === toolCall.function.name);
      const toolResult = tool ? await tool.execute(
        JSON.parse(toolCall.function.arguments),
        { db: this.db }
      ) : null;

      // Send tool result back
      const finalResponse = await this.kimiClient.chat.completions.create({
        model: this.config.kimiModel,
        messages: [
          ...params.messages.map(m => ({
            role: m.role.toLowerCase(),
            content: m.content,
          })),
          message,
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          },
        ],
      });

      return {
        content: finalResponse.choices[0].message.content,
        toolUsed: toolCall.function.name,
        toolInput: JSON.parse(toolCall.function.arguments),
        modelUsed: this.config.kimiModel,
        tokensUsed: response.usage.total_tokens,
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      content: message.content,
      toolUsed: null,
      modelUsed: this.config.kimiModel,
      tokensUsed: response.usage.total_tokens,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Genera embedding per RAG
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const model = this.gemini.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent(text.slice(0, 8000));
    return result.embedding.values;
  }
}
```

### 4.5 BullMQ Queue Configuration

```typescript
// src/server/queues/index.ts

import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

// ─── AI Fallback Queue ───────────────────────────────────────
export const aiFallbackQueue = new Queue("ai-fallback", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// ─── PDF Generation Queue ────────────────────────────────────
export const pdfQueue = new Queue("pdf-generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});

// ─── Kit Generation Queue (for complex kits) ─────────────────
export const kitGenerationQueue = new Queue("kit-generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: 200,
    removeOnFail: 50,
  },
});

// ─── Email Notification Queue ────────────────────────────────
export const emailQueue = new Queue("email-notifications", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 60000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// ─── Workers ─────────────────────────────────────────────────

// PDF Worker
const pdfWorker = new Worker("pdf-generation", async (job) => {
  const { kitRequestId } = job.data;
  const pdfGenerator = new KitPDFGenerator();
  const pdfUrl = await pdfGenerator.generate(kitRequestId);
  await prisma.kitRequest.update({
    where: { id: kitRequestId },
    data: { pdfUrl, pdfGeneratedAt: new Date() },
  });
  return { pdfUrl };
}, { connection: redis });

// AI Fallback Worker
const aiFallbackWorker = new Worker("ai-fallback", async (job) => {
  const { params } = job.data;
  const aiService = new AIService(db, redis, config);
  // Retry with Kimi
  return aiService.callKimi(params, Date.now());
}, { connection: redis });
```



---

## 5. Kit Deterministic Engine

### 5.1 Architettura del Motore

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                         KIT DETERMINISTIC ENGINE                                             │
│                                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  INPUT   │───▶│ VALIDATE │───▶│  SELECT  │───▶│  APPLY   │───▶│  OUTPUT  │              │
│  │          │    │          │    │ TEMPLATE │    │  RULES   │    │          │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                                                                              │
│  Input Schema:        Validation Rules:         Template Selection:    Output Format:       │
│  ────────────         ────────────────          ─────────────────      ────────────        │
│  • windowType         • widthMm 300-3000        • Match windowType     • Component list    │
│  • widthMm            • heightMm 300-3000       • Match material       • Quantities        │
│  • heightMm           • airGapMm 4-20           • Match series         • Prices            │
│  • material           • axisOffsetMm 9-20       • Priority scoring     • Positions         │
│  • airGapMm           • rebateMm 15-30          • Fallback template    • Rule IDs          │
│  • axisOffsetMm       • seatMm 12-22                                                      │
│  • rebateMm           • Cross-parameter                                                   │
│  • seatMm               compatibility                                                     │
│  • openingSide                                                                            │
│  • openingDir                                                                             │
│  • finish                                                                                 │
│  • series                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Input Schema Completo

```typescript
// src/server/kit/types.ts

import { z } from "zod";

export const KitInputSchema = z.object({
  // Tipo finestra — determina la famiglia di prodotti
  windowType: z.enum([
    "ANTA_RIBALTA",         // Top-hung / hopper window
    "ANTA_PROIETTANTE",     // Projecting / casement
    "ANTA_BATTENTE",        // Side-hung casement
    "SCORREVOLE_ALZANTE",   // Tilt-and-slide
    "SCORREVOLE_TRASLANTE", // Sliding
    "VASISTAS",             // Pivot / vasistas
    "FINESTRA_TETTO",       // Roof window
  ]),

  // Dimensioni anta in mm
  widthMm: z.number().int().min(300).max(3000)
    .describe("Larghezza anta in mm (fino a 3000mm)"),
  heightMm: z.number().int().min(300).max(3000)
    .describe("Altezza anta in mm (fino a 3000mm)"),

  // Materiale
  material: z.enum([
    "LEGNO",           // Legno massello
    "PVC",             // PVC
    "ALLUMINIO",       // Alluminio
    "LEGNO_ALLUMINIO", // Legno-alluminio
    "PVC_ALLUMINIO",   // PVC-alluminio
  ]),

  // Parametri tecnici (tutti in mm)
  airGapMm: z.number().int().min(4).max(20)
    .describe("Aria — distanza tra telaio e anta (4-20mm)"),
  axisOffsetMm: z.number().int().min(9).max(20)
    .describe("Asse — distanza asse di rotazione dal bordo (9-20mm)"),
  rebateMm: z.number().int().min(15).max(30)
    .describe("Battuta — profondita dello sconto telaio (15-30mm)"),
  seatMm: z.number().int().min(12).max(22)
    .describe("Sede — profondita alloggio cerniera nel telaio (12-22mm)"),

  // Lato e direzione apertura
  openingSide: z.enum(["DESTRA", "SINISTRA"])
    .describe("Lato del battente (DX/SX visto dall'esterno)"),
  openingDir: z.enum(["TIRARE", "SPINGERE"])
    .describe("Direzione apertura: TIRARE (verso interno) / SPINGERE (verso esterno)"),

  // Finitura e serie
  finish: z.string().min(1)
    .describe("Finitura superficiale: Argento, Bronzo, Bianco, Nero, Inox, etc."),
  series: z.string().min(1)
    .describe("Serie AGB: ARTECH, ECLIPSE, HERCULES, AERO, etc."),

  // Note opzionali
  notes: z.string().max(2000).optional(),
});

export type KitInput = z.infer<typeof KitInputSchema>;

// Output del motore deterministico
export interface KitComponent {
  code: string;           // Codice prodotto AGB (es. "CERN_A_B_140_ARG")
  name: string;           // Nome leggibile (es. "Cerniera A-B-140 Argento")
  productId: string;      // ID nel DB
  position: string;       // Posizione montaggio (es. "inferiore DX")
  quantity: number;       // Quantita calcolata
  unitPrice: number;      // Prezzo unitario EUR
  totalPrice: number;     // Prezzo totale
  ruleId: string;         // ID regola applicata
  ruleDescription: string; // Descrizione regola
  isOptional: boolean;    // Componente opzionale
  isAlternative: boolean; // Alternativa disponibile
  dependsOn?: string[];   // Codici componenti dipendenti
}

export interface KitOutput {
  components: KitComponent[];
  totalPrice: number;
  totalComponents: number;
  appliedRules: string[];
  warnings: string[];
  metadata: {
    templateId: string;
    templateName: string;
    engineVersion: string;
    generatedAt: Date;
    inputHash: string;    // Per caching
  };
}
```

### 5.3 Logic Flow Completo

```typescript
// src/server/kit/engine.ts

import { PrismaClient } from "@prisma/client";
import { KitInput, KitOutput, KitComponent } from "./types";
import { KitRulesRegistry } from "./rules";
import { QuantityCalculator } from "./calculator";

export class KitDeterministicEngine {
  private rules: KitRulesRegistry;
  private calculator: QuantityCalculator;

  constructor(private db: PrismaClient) {
    this.rules = new KitRulesRegistry();
    this.calculator = new QuantityCalculator();
  }

  /**
   * Flusso principale di generazione kit
   */
  async generate(input: KitInput): Promise<KitOutput> {
    const warnings: string[] = [];

    // STEP 1: VALIDAZIONE INPUT
    this.validateInput(input, warnings);

    // STEP 2: SELEZIONE TEMPLATE
    const template = await this.selectTemplate(input);
    if (!template) {
      throw new KitGenerationError(
        `Nessun template trovato per: ${input.windowType} / ${input.material} / ${input.series}`
      );
    }

    // STEP 3: APPLICAZIONE REGOLE
    const matchedRules = this.rules.evaluateAll(input, template.rules);

    // STEP 4: SELEZIONE COMPONENTI
    const componentSelections = this.selectComponents(matchedRules, input);

    // STEP 5: CALCOLO QUANTITA
    const componentsWithQty = this.calculator.calculate(
      componentSelections,
      input
    );

    // STEP 6: RISOLUZIONE DIPENDENZE E CONFLITTI
    const resolvedComponents = this.resolveDependencies(componentsWithQty);

    // STEP 7: RECUPERO PREZZI DAL DB
    const pricedComponents = await this.enrichWithPrices(resolvedComponents);

    // STEP 8: ASSEMBLAGGIO OUTPUT
    const totalPrice = pricedComponents.reduce(
      (sum, c) => sum + c.totalPrice,
      0
    );

    return {
      components: pricedComponents,
      totalPrice,
      totalComponents: pricedComponents.length,
      appliedRules: matchedRules.map((r) => r.ruleId),
      warnings,
      metadata: {
        templateId: template.id,
        templateName: template.name,
        engineVersion: "1.0.0",
        generatedAt: new Date(),
        inputHash: this.hashInput(input),
      },
    };
  }

  /**
   * STEP 1: Validazione input con regole di compatibilita
   */
  private validateInput(input: KitInput, warnings: string[]): void {
    // Validazione dimensioni minime in base al tipo
    const minDimensions: Record<string, { w: number; h: number }> = {
      ANTA_RIBALTA: { w: 400, h: 400 },
      ANTA_PROIETTANTE: { w: 350, h: 350 },
      ANTA_BATTENTE: { w: 300, h: 400 },
      SCORREVOLE_ALZANTE: { w: 600, h: 600 },
      SCORREVOLE_TRASLANTE: { w: 500, h: 400 },
      VASISTAS: { w: 400, h: 500 },
      FINESTRA_TETTO: { w: 450, h: 450 },
    };

    const min = minDimensions[input.windowType];
    if (input.widthMm < min.w || input.heightMm < min.h) {
      warnings.push(
        `Dimensioni inferiori al minimo consigliato per ${input.windowType} (${min.w}x${min.h}mm)`
      );
    }

    // Validazione compatibilita materiale / serie
    const seriesMaterialCompat: Record<string, string[]> = {
      ARTECH: ["LEGNO", "PVC", "ALLUMINIO"],
      ECLIPSE: ["ALLUMINIO", "LEGNO_ALLUMINIO", "PVC_ALLUMINIO"],
      HERCULES: ["LEGNO", "LEGNO_ALLUMINIO"],
      AERO: ["PVC", "PVC_ALLUMINIO"],
    };

    const compatMaterials = seriesMaterialCompat[input.series];
    if (compatMaterials && !compatMaterials.includes(input.material)) {
      warnings.push(
        `Serie ${input.series} tipicamente usata con ${compatMaterials.join(", ")}. Verificare compatibilita.`
      );
    }

    // Validazione finitura
    const validFinishes = ["ARGENTO", "BRONZO", "BIANCO", "NERO", "INOX", "ORO"];
    if (!validFinishes.includes(input.finish.toUpperCase())) {
      warnings.push(`Finitura "${input.finish}" non standard. Verificare disponibilita.`);
    }
  }

  /**
   * STEP 2: Selezione template dai dati DB
   */
  private async selectTemplate(input: KitInput) {
    // Cerca template esatto
    const exactMatch = await this.db.kitTemplate.findFirst({
      where: {
        windowType: input.windowType,
        material: input.material,
        series: input.series,
        isActive: true,
      },
      orderBy: { priority: "desc" },
    });

    if (exactMatch) return exactMatch;

    // Fallback: cerca per tipo finestra + materiale (ignora serie)
    const partialMatch = await this.db.kitTemplate.findFirst({
      where: {
        windowType: input.windowType,
        material: input.material,
        isActive: true,
      },
      orderBy: { priority: "desc" },
    });

    if (partialMatch) return partialMatch;

    // Fallback: solo per tipo finestra
    return this.db.kitTemplate.findFirst({
      where: {
        windowType: input.windowType,
        isActive: true,
      },
      orderBy: { priority: "desc" },
    });
  }

  /**
   * STEP 6: Risoluzione dipendenze tra componenti
   */
  private resolveDependencies(components: KitComponent[]): KitComponent[] {
    const codeSet = new Set(components.map((c) => c.code));
    const toRemove = new Set<string>();

    for (const comp of components) {
      // Se un componente dipende da altri non presenti, marca per rimozione
      if (comp.dependsOn) {
        const allDepsPresent = comp.dependsOn.every((dep) => codeSet.has(dep));
        if (!allDepsPresent) {
          toRemove.add(comp.code);
        }
      }
    }

    return components.filter((c) => !toRemove.has(c.code));
  }

  /**
   * STEP 7: Arricchimento prezzi dal database
   */
  private async enrichWithPrices(
    components: KitComponent[]
  ): Promise<KitComponent[]> {
    const productCodes = components.map((c) => c.code);

    const products = await this.db.product.findMany({
      where: {
        agbCode: { in: productCodes },
      },
      select: {
        id: true,
        agbCode: true,
        name: true,
        basePrice: true,
        discountedPrice: true,
        isAvailable: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.agbCode, p]));

    return components.map((c) => {
      const product = productMap.get(c.code);
      if (!product) {
        return { ...c, unitPrice: 0, totalPrice: 0 };
      }
      const unitPrice = Number(product.discountedPrice ?? product.basePrice);
      return {
        ...c,
        productId: product.id,
        name: product.name,
        unitPrice,
        totalPrice: unitPrice * c.quantity,
      };
    });
  }

  private hashInput(input: KitInput): string {
    const str = JSON.stringify(input);
    // Simple hash for caching purposes
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}
```

### 5.4 Regole AGB Codificate in TypeScript

```typescript
// src/server/kit/rules.ts

import { KitInput } from "./types";

/**
 * Interfaccia per una singola regola di selezione componente
 */
interface KitRule {
  ruleId: string;
  description: string;
  priority: number; // 1-100, piu alto = piu specifico

  // Condizioni di matching
  conditions: {
    windowTypes?: string[];
    materials?: string[];
    series?: string[];
    widthMm?: { min?: number; max?: number };
    heightMm?: { min?: number; max?: number };
    weightKg?: { min?: number; max?: number }; // Peso anta calcolato
    openingSide?: string[];
    openingDir?: string[];
    custom?: (input: KitInput) => boolean; // Funzione custom
  };

  // Componente da selezionare quando la regola matcha
  component: {
    productCodePattern: string; // Pattern con placeholder, es. "CERN_A_B_${load}_ARG"
    fallbackCode: string; // Codice fallback se il pattern non trova match
    quantity: number | ((input: KitInput) => number);
    position: string | ((input: KitInput) => string);
    isOptional: boolean;
  };
}

/**
 * REGOLE AGB — Codificate da catalogo tecnico
 * 
 * Ogni regola rappresenta una voce del catalogo AGB con le condizioni
 * di applicabilita e il componente da selezionare.
 */
export const KIT_RULES: KitRule[] = [
  // ═══════════════════════════════════════════════════════════════
  // CERNIERE (Hinges)
  // ═══════════════════════════════════════════════════════════════

  // Cerniera inferiore A-B-140 (anta ribalta standard)
  {
    ruleId: "CERN_AB140_INF",
    description: "Cerniera inferiore AGB A-B-140, portata fino a 140kg",
    priority: 80,
    conditions: {
      windowTypes: ["ANTA_RIBALTA"],
      series: ["ARTECH"],
      materials: ["LEGNO", "PVC", "ALLUMINIO"],
      widthMm: { min: 400, max: 1600 },
      heightMm: { min: 400, max: 2200 },
    },
    component: {
      productCodePattern: "CERN_A_B_140_${finish}",
      fallbackCode: "CERN_A_B_140_ARG",
      quantity: 1,
      position: (input) => `inferiore ${input.openingSide === "DESTRA" ? "SX" : "DX"}`,
      isOptional: false,
    },
  },

  // Cerniera inferiore A-B-160 (anta ribalta pesante)
  {
    ruleId: "CERN_AB160_INF",
    description: "Cerniera inferiore AGB A-B-160, portata fino a 160kg",
    priority: 85,
    conditions: {
      windowTypes: ["ANTA_RIBALTA"],
      series: ["ARTECH"],
      materials: ["LEGNO", "LEGNO_ALLUMINIO"],
      widthMm: { min: 500, max: 1400 },
      heightMm: { min: 1400, max: 2400 },
      custom: (input) => this.calculateDoorWeight(input) > 45, // >45kg
    },
    component: {
      productCodePattern: "CERN_A_B_160_${finish}",
      fallbackCode: "CERN_A_B_160_ARG",
      quantity: 1,
      position: (input) => `inferiore ${input.openingSide === "DESTRA" ? "SX" : "DX"}`,
      isOptional: false,
    },
  },

  // Cerniera superiore C1 (scorrimento)
  {
    ruleId: "CERN_C1_SUP",
    description: "Cerniera superiore C1 con scorrimento per anta ribalta",
    priority: 80,
    conditions: {
      windowTypes: ["ANTA_RIBALTA"],
      series: ["ARTECH"],
      materials: ["LEGNO", "PVC", "ALLUMINIO"],
    },
    component: {
      productCodePattern: "CERN_C1_${finish}",
      fallbackCode: "CERN_C1_ARG",
      quantity: 1,
      position: (input) => `superiore ${input.openingSide === "DESTRA" ? "DX" : "SX"}`,
      isOptional: false,
    },
  },

  // Cerniera superiore C6 (anta ribalta grande)
  {
    ruleId: "CERN_C6_SUP",
    description: "Cerniera superiore C6 per ante di grandi dimensioni",
    priority: 85,
    conditions: {
      windowTypes: ["ANTA_RIBALTA"],
      series: ["ARTECH"],
      widthMm: { min: 800, max: 1600 },
      heightMm: { min: 1400, max: 2400 },
    },
    component: {
      productCodePattern: "CERN_C6_${finish}",
      fallbackCode: "CERN_C6_ARG",
      quantity: 1,
      position: (input) => `superiore ${input.openingSide === "DESTRA" ? "DX" : "SX"}`,
      isOptional: false,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BRACCETTI (Arms / Stays)
  // ═══════════════════════════════════════════════════════════════

  // Braccio limitatore 150-300
  {
    ruleId: "BRACC_LIM_150300",
    description: "Braccio limitatore apertura 150-300mm per anta ribalta",
    priority: 75,
    conditions: {
      windowTypes: ["ANTA_RIBALTA"],
      widthMm: { min: 400, max: 1200 },
      heightMm: { min: 500, max: 1600 },
    },
    component: {
      productCodePattern: "BRACC_LIM_${airGap}_${finish}",
      fallbackCode: "BRACC_LIM_150_ARG",
      quantity: 1,
      position: "laterale superiore",
      isOptional: true,
    },
  },

  // Braccio fermavetro
  {
    ruleId: "BRACC_FV",
    description: "Braccio fermavetro per anta ribalta",
    priority: 70,
    conditions: {
      windowTypes: ["ANTA_RIBALTA"],
      heightMm: { min: 800, max: 2400 },
    },
    component: {
      productCodePattern: "BRACC_FV_${finish}",
      fallbackCode: "BRACC_FV_ARG",
      quantity: 1,
      position: (input) => `fermavetro ${input.openingSide === "DESTRA" ? "DX" : "SX"}`,
      isOptional: true,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // MANIGLIE (Handles)
  // ═══════════════════════════════════════════════════════════════

  // Maniglia cremonese
  {
    ruleId: "MAN_CREMO",
    description: "Maniglia cremonese per anta ribalta",
    priority: 75,
    conditions: {
      windowTypes: ["ANTA_RIBALTA", "ANTA_PROIETTANTE"],
      series: ["ARTECH"],
    },
    component: {
      productCodePattern: "MAN_CREMO_${series}_${finish}",
      fallbackCode: "MAN_CREMO_ARTECH_ARG",
      quantity: 1,
      position: (input) => input.openingSide === "DESTRA" ? "lato DX" : "lato SX",
      isOptional: false,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // RULLI E SCORREVOLI (Rollers / Sliders)
  // ═══════════════════════════════════════════════════════════════

  // Rullino centrale
  {
    ruleId: "RULL_CENT",
    description: "Rullino centrale per carrello anta ribalta",
    priority: 70,
    conditions: {
      windowTypes: ["ANTA_RIBALTA"],
      widthMm: { min: 400, max: 1600 },
    },
    component: {
      productCodePattern: "RULL_CENT_${finish}",
      fallbackCode: "RULL_CENT_ARG",
      quantity: 1,
      position: "centrale inferiore",
      isOptional: false,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // FERMI E BLOCCHI (Locks / Stops)
  // ═══════════════════════════════════════════════════════════════

  // Fermaposto
  {
    ruleId: "FERM_POSTO",
    description: "Fermaposto per anta ribalta",
    priority: 65,
    conditions: {
      windowTypes: ["ANTA_RIBALTA"],
    },
    component: {
      productCodePattern: "FERM_POSTO_${finish}",
      fallbackCode: "FERM_POSTO_ARG",
      quantity: 2,
      position: "angoli superiori",
      isOptional: true,
    },
  },

  // Calotta copri cerniera
  {
    ruleId: "CALOTTA_CERN",
    description: "Calotta copricerniera (coppia)",
    priority: 60,
    conditions: {
      windowTypes: ["ANTA_RIBALTA", "ANTA_PROIETTANTE"],
    },
    component: {
      productCodePattern: "CALOTTA_CERN_${finish}",
      fallbackCode: "CALOTTA_CERN_ARG",
      quantity: 2,
      position: "cerniere",
      isOptional: true,
    },
  },
];

/**
 * Registry delle regole con logica di valutazione
 */
export class KitRulesRegistry {
  private rules: KitRule[] = KIT_RULES;

  /**
   * Valuta tutte le regole e ritorna quelle che matchano l'input
   */
  evaluateAll(input: KitInput, templateRules?: JsonValue): MatchedRule[] {
    const matched: MatchedRule[] = [];

    for (const rule of this.rules) {
      if (this.matches(rule, input)) {
        matched.push({
          ruleId: rule.ruleId,
          description: rule.description,
          priority: rule.priority,
          component: rule.component,
        });
      }
    }

    // Ordina per priorita (piu specifico prima)
    matched.sort((a, b) => b.priority - a.priority);

    // Rimuovi duplicati per stesso componente (mantieni quello con priorita piu alta)
    const seen = new Set<string>();
    return matched.filter((m) => {
      if (seen.has(m.component.productCodePattern)) return false;
      seen.add(m.component.productCodePattern);
      return true;
    });
  }

  /**
   * Verifica se una regola matcha l'input
   */
  private matches(rule: KitRule, input: KitInput): boolean {
    const c = rule.conditions;

    if (c.windowTypes && !c.windowTypes.includes(input.windowType)) return false;
    if (c.materials && !c.materials.includes(input.material)) return false;
    if (c.series && !c.series.includes(input.series)) return false;
    if (c.openingSide && !c.openingSide.includes(input.openingSide)) return false;
    if (c.openingDir && !c.openingDir.includes(input.openingDir)) return false;

    if (c.widthMm) {
      if (c.widthMm.min && input.widthMm < c.widthMm.min) return false;
      if (c.widthMm.max && input.widthMm > c.widthMm.max) return false;
    }
    if (c.heightMm) {
      if (c.heightMm.min && input.heightMm < c.heightMm.min) return false;
      if (c.heightMm.max && input.heightMm > c.heightMm.max) return false;
    }

    if (c.custom && !c.custom(input)) return false;

    return true;
  }

  /**
   * Calcola peso approssimativo anta (per regole basate sul peso)
   */
  private calculateDoorWeight(input: KitInput): number {
    // Formula semplificata: volume * densita materiale
    const volumeM3 = (input.widthMm * input.heightMm * input.airGapMm) / 1e9;
    const densities: Record<string, number> = {
      LEGNO: 600,
      PVC: 1400,
      ALLUMINIO: 2700,
      LEGNO_ALLUMINIO: 800,
      PVC_ALLUMINIO: 1800,
    };
    const density = densities[input.material] || 600;
    return volumeM3 * density * 0.7; // 0.7 = fattore di riempimento (anta non piena)
  }
}

interface MatchedRule {
  ruleId: string;
  description: string;
  priority: number;
  component: {
    productCodePattern: string;
    fallbackCode: string;
    quantity: number | ((input: KitInput) => number);
    position: string | ((input: KitInput) => string);
    isOptional: boolean;
  };
}
```

### 5.5 Esempio Completo: Anta Ribalta DX

```typescript
// src/server/kit/__tests__/example-artech-ribalta.test.ts

/**
 * ESEMPIO: Anta Ribalta DX, L1000xH1600, Legno, Aria 12, Asse 13, 
 *          Battuta 25, Sede 18, Tirare, Argento, ARTECH
 */
const EXAMPLE_INPUT: KitInput = {
  windowType: "ANTA_RIBALTA",
  widthMm: 1000,
  heightMm: 1600,
  material: "LEGNO",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 25,
  seatMm: 18,
  openingSide: "DESTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
  notes: "",
};

/**
 * OUTPUT ATTESO:
 * 
 * Componenti generati:
 * ┌───┬────────────────────────┬──────────┬──────────┬────────┬───────────┬──────────┬──────┐
 * │ # │ Componente             │ Codice   │ Posizione│ Q.ty   │ Prezzo    │ Totale   │ Obl. │
 * ├───┼────────────────────────┼──────────┼──────────┼────────┼───────────┼──────────┼──────┤
 * │ 1 │ Cerniera inferiore     │CERN_AB14 │ inf. SX  │ 1      │ € 45.00   │ € 45.00  │  SI  │
 * │   │ A-B-140 Argento        │_ARG      │          │        │           │          │      │
 * ├───┼────────────────────────┼──────────┼──────────┼────────┼───────────┼──────────┼──────┤
 * │ 2 │ Cerniera superiore C1  │CERN_C1   │ sup. DX  │ 1      │ € 38.00   │ € 38.00  │  SI  │
 * │   │ Argento                │_ARG      │          │        │           │          │      │
 * ├───┼────────────────────────┼──────────┼──────────┼────────┼───────────┼──────────┼──────┤
 * │ 3 │ Maniglia cremonese     │MAN_CREMO │ lato DX  │ 1      │ € 65.00   │ € 65.00  │  SI  │
 * │   │ ARTECH Argento         │_ARTECH   │          │        │           │          │      │
 * │   │                        │_ARG      │          │        │           │          │      │
 * ├───┼────────────────────────┼──────────┼──────────┼────────┼───────────┼──────────┼──────┤
 * │ 4 │ Rullino centrale       │RULL_CENT │ cent.    │ 1      │ € 12.50   │ € 12.50  │  SI  │
 * │   │ Argento                │_ARG      │ inferiore│        │           │          │      │
 * ├───┼────────────────────────┼──────────┼──────────┼────────┼───────────┼──────────┼──────┤
 * │ 5 │ Braccio limitatore     │BRACC_LIM │ lat. sup.│ 1      │ € 28.00   │ € 28.00  │ NO   │
 * │   │ 150-300 Argento        │_150_ARG  │          │        │           │          │      │
 * ├───┼────────────────────────┼──────────┼──────────┼────────┼───────────┼──────────┼──────┤
 * │ 6 │ Braccio fermavetro     │BRACC_FV  │ FV SX    │ 1      │ € 22.00   │ € 22.00  │ NO   │
 * │   │ Argento                │_ARG      │          │        │           │          │      │
 * ├───┼────────────────────────┼──────────┼──────────┼────────┼───────────┼──────────┼──────┤
 * │ 7 │ Fermaposto (coppia)    │FERM_POSTO│ angoli   │ 2      │ € 8.50    │ € 17.00  │ NO   │
 * │   │ Argento                │_ARG      │ sup.     │        │           │          │      │
 * ├───┼────────────────────────┼──────────┼──────────┼────────┼───────────┼──────────┼──────┤
 * │ 8 │ Calotta copricerniera  │CALOTTA   │ cerniere │ 2      │ € 5.00    │ € 10.00  │ NO   │
 * │   │ (coppia) Argento       │_CERN_ARG │          │        │           │          │      │
 * ├───┼────────────────────────┴──────────┴──────────┴────────┴───────────┴──────────┴──────┤
 * │   │ TOTALE COMPONENTI: 8 (5 obbligatori + 3 opzionali)                                  │
 * │   │ TOTALE PREZZO: € 237.50                                                               │
 * └───┴─────────────────────────────────────────────────────────────────────────────────────┘
 */
```

### 5.6 Quantity Calculator

```typescript
// src/server/kit/calculator.ts

import { KitInput } from "./types";

/**
 * Calcolatore quantita basato su dimensioni e fisica dell'anta
 */
export class QuantityCalculator {
  /**
   * Calcola la quantita di un componente in base alle dimensioni dell'anta
   */
  calculate(
    selections: ComponentSelection[],
    input: KitInput
  ): KitComponent[] {
    return selections.map((sel) => ({
      ...sel,
      quantity: this.calculateQuantity(sel, input),
      position: this.resolvePosition(sel.position, input),
    }));
  }

  private calculateQuantity(
    sel: ComponentSelection,
    input: KitInput
  ): number {
    // Se la quantita e una funzione, la esegue
    if (typeof sel.rule.quantity === "function") {
      return sel.rule.quantity(input);
    }

    const baseQty = sel.rule.quantity;

    // Override per dimensioni grandi
    switch (sel.rule.ruleId) {
      case "CERN_AB140_INF":
      case "CERN_AB160_INF":
        // Per ante >1400mm di larghezza, doppia cerniera inferiore
        if (input.widthMm > 1400) return 2;
        return baseQty;

      case "FERM_POSTO":
        // Per ante >1200mm, fermaposto aggiuntivi
        if (input.widthMm > 1200) return 4;
        return baseQty;

      case "RULL_CENT":
        // Per ante >1200mm, rullino aggiuntivo
        if (input.widthMm > 1200) return 2;
        return baseQty;

      default:
        return baseQty;
    }
  }

  private resolvePosition(
    position: string | ((input: KitInput) => string),
    input: KitInput
  ): string {
    if (typeof position === "function") {
      return position(input);
    }
    return position;
  }

  /**
   * Calcola il peso dell'anta per decisioni basate sul carico
   */
  calculateWeight(input: KitInput): number {
    const area = (input.widthMm * input.heightMm) / 1_000_000; // m2
    const weightsPerM2: Record<string, number> = {
      LEGNO: 12,
      PVC: 18,
      ALLUMINIO: 8,
      LEGNO_ALLUMINIO: 14,
      PVC_ALLUMINIO: 16,
    };
    return area * (weightsPerM2[input.material] || 12);
  }
}
```

---

## 6. Security & Auth

### 6.1 RBAC — Role-Based Access Control

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              RBAC MATRIX                                                     │
│                                                                                              │
│  Resource / Action      │  PUBLIC    │  AGENT    │  ADMIN    │  Middleware                   │
│  ───────────────────────┼────────────┼───────────┼───────────┼───────────────────────────────│
│  Sito pubblico          │    R       │    R      │    R      │  none                         │
│  /prodotti (public)     │    R       │    R      │    R      │  none                         │
│  /login                 │    RW      │    -      │    -      │  none                         │
│  /dashboard             │    -       │    R      │    RW     │  authed + agent               │
│  /dashboard/kit/*       │    -       │    RW     │    RW     │  authed + agent               │
│  /dashboard/convers.*   │    -       │    RW     │    R      │  authed + agent               │
│  /dashboard/catalogo    │    -       │    R      │    R      │  authed + agent               │
│  /admin                 │    -       │    -      │    RW     │  authed + admin               │
│  /admin/users           │    -       │    -      │    CRUD   │  authed + admin               │
│  /admin/settings        │    -       │    -      │    RW     │  authed + admin               │
│  /admin/analytics       │    -       │    -      │    R      │  authed + admin               │
│  /admin/import          │    -       │    -      │    RW     │  authed + admin               │
│  tRPC auth.*            │    RW      │    R      │    R      │  none (login) / authed (me)   │
│  tRPC product.search    │    -       │    R      │    R      │  authed + agent               │
│  tRPC kit.*             │    -       │    RW     │    RW     │  authed + agent               │
│  tRPC conversation.*    │    -       │    RW     │    R      │  authed + agent               │
│  tRPC user.*            │    -       │    -      │    CRUD   │  authed + admin               │
│  tRPC analytics.*       │    -       │    -      │    R      │  authed + admin               │
│  tRPC settings.*        │    -       │    -      │    RW     │  authed + admin               │
│                                                                                              │
│  Legenda: R=Read, W=Write, RW=Read+Write, CRUD=Create+Read+Update+Delete, -=negato         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Middleware Stack

```typescript
// src/server/api/middleware/auth.ts

import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";

/**
 * Middleware: Verifica autenticazione (JWT session)
 */
export const authMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Autenticazione richiesta. Effettua il login.",
    });
  }

  // Verifica stato utente
  if (ctx.session.user.status !== "ACTIVE") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        ctx.session.user.status === "SUSPENDED"
          ? "Account sospeso. Contatta l'amministratore."
          : "Account inattivo.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});

/**
 * Middleware: Verifica ruolo
 */
export const enforceRole = (allowedRoles: string[]) =>
  middleware(async ({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Ruolo '${ctx.user.role}' non autorizzato per questa operazione.`,
      });
    }
    return next({ ctx });
  });
```

```typescript
// src/server/api/middleware/rateLimit.ts

import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";

interface RateLimitConfig {
  max: number;           // Richieste massime
  windowMs: number;      // Finestra temporale in ms
  keyPrefix?: string;    // Prefisso chiave Redis
}

/**
 * Middleware: Rate limiting via Redis
 */
export const rateLimitMiddleware = (config: RateLimitConfig) =>
  middleware(async ({ ctx, path, next }) => {
    const key = `ratelimit:${config.keyPrefix || ""}:${path}:${ctx.session?.user?.id || ctx.ip}`;
    
    const current = await ctx.redis.incr(key);
    if (current === 1) {
      await ctx.redis.pexpire(key, config.windowMs);
    }
    
    if (current > config.max) {
      const ttl = await ctx.redis.pttl(key);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Retry after ${Math.ceil(ttl / 1000)}s`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        rateLimit: { remaining: config.max - current, resetInMs: config.windowMs },
      },
    });
  });

/**
 * Rate limit specifico per API AI (piu restrittivo)
 */
export const aiRateLimit = rateLimitMiddleware({
  max: 30,        // 30 richieste
  windowMs: 60000, // per minuto
  keyPrefix: "ai",
});

/**
 * Rate limit per kit generation (molto restrittivo)
 */
export const kitRateLimit = rateLimitMiddleware({
  max: 10,        // 10 generazioni
  windowMs: 60000, // per minuto
  keyPrefix: "kit",
});
```

### 6.3 NextAuth.js Configuration

```typescript
// src/server/auth.ts

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;
        if (user.status !== "ACTIVE") return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 ore (sessione lavorativa)
    updateAge: 60 * 60,  // Aggiorna ogni ora
  },

  jwt: {
    maxAge: 8 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.status = user.status;
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.status = token.status as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login?error=true",
  },

  events: {
    async signIn({ user }) {
      await prisma.activityLog.create({
        data: {
          type: "LOGIN",
          description: `Login utente ${user.email}`,
          userId: user.id,
        },
      });
    },
    
    async signOut({ token }) {
      if (token?.id) {
        await prisma.activityLog.create({
          data: {
            type: "LOGOUT",
            description: `Logout utente`,
            userId: token.id as string,
          },
        });
      }
    },
  },
};
```

### 6.4 GDPR Compliance (Azienda Italiana B2B)

```typescript
// src/server/gdpr/index.ts

/**
 * GDPR Compliance Module
 * 
 * Requisiti per azienda italiana B2B:
 * - Art. 6(1)(b) — Esecuzione contratto / misure precontrattuali
 * - Art. 6(1)(f) — Legittimo interesse (log sicurezza)
 * - NO consenso richiesto per dati B2B (art. 6(1)(f) vs 6(1)(a))
 */

// Privacy Policy — Dati raccolti
const GDPR_DATA_CATEGORIES = {
  // Dati agenti (dipendenti/utenti)
  AGENT_DATA: [
    "nome", "cognome", "email", "ruolo",
    "log attivita (anonymized)", "indirizzo IP (hashed)",
  ],
  
  // Dati clienti B2B (contatto commerciale)
  CUSTOMER_DATA: [
    "ragione sociale", "partita IVA", "codice fiscale",
    "nome contatto", "email contatto", "telefono contatto",
    "indirizzo sede legale",
  ],
  
  // Dati conversazioni AI
  CONVERSATION_DATA: [
    "testo messaggi", "prodotti ricercati", "kit generati",
    "timestamp", "token utilizzati",
  ],
};

// Misure tecniche implementate
const GDPR_TECHNICAL_MEASURES = {
  // Art. 25 — Privacy by Design
  PSEUDONYMIZATION: "Hash SHA-256 di IP address nei log",
  
  // Art. 32 — Sicurezza dati
  ENCRYPTION: "Password bcrypt(12), API keys AES-256, JWT HS256",
  
  // Art. 5(1)(e) — Limitazione conservazione
  RETENTION: {
    ACTIVITY_LOGS: "12 mesi",
    CONVERSATIONS: "24 mesi (poi archiviate)",
    DELETED_ACCOUNTS: "30 giorni (soft delete)",
  },
  
  // Art. 15-20 — Diritti interessato
  DATA_PORTABILITY: "Export conversazioni e kit in JSON/PDF",
  RIGHT_TO_ERASURE: "Soft delete + anonymization dopo 30gg",
  
  // Art. 33 — Data breach notification
  BREACH_DETECTION: "Alert automatico su accessi anomali",
};

/**
 * Funzione per hash sicuro di IP (GDPR-compliant)
 */
export function hashIP(ip: string): string {
  const crypto = require("crypto");
  return crypto.createHmac("sha256", process.env.IP_HASH_SECRET!)
    .update(ip)
    .digest("hex");
}

/**
 * Anonymize user data for analytics (retention > 12 mesi)
 */
export function anonymizeActivityLog(log: ActivityLog): AnonymizedLog {
  return {
    ...log,
    userId: `USER_${log.userId?.slice(0, 8)}`,
    ipHash: null,
    userAgent: null,
  };
}
```

### 6.5 CSRF & XSS Protection

```typescript
// src/server/security/csrf.ts

/**
 * CSRF Protection
 * - Next.js gestisce CSRF automaticamente per le route API
 * - tRPC usa SameSite=Lax cookies
 * - Aggiungiamo CSRF token per form s sensibili
 */

import { randomBytes } from "crypto";

export function generateCSRFToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyCSRFToken(token: string, cookie: string): boolean {
  return timingSafeEqual(Buffer.from(token), Buffer.from(cookie));
}

// Middleware per Next.js API routes
export function withCSRFProtection(handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      const csrfToken = req.headers["x-csrf-token"];
      const csrfCookie = req.cookies["csrf-token"];
      
      if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
        return res.status(403).json({ error: "Invalid CSRF token" });
      }
    }
    return handler(req, res);
  };
}
```

```typescript
// src/server/security/xss.ts

import DOMPurify from "isomorphic-dompurify";

/**
 * XSS Protection
 * - Sanitizzazione input utente
 * - Escape output HTML
 * - Content Security Policy headers
 */

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "target"],
  });
}

// CSP Header
export const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
```

### 6.6 Security Headers

```typescript
// src/server/security/headers.ts

import { NextResponse } from "next/server";

export function setSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set("Content-Security-Policy", CSP_HEADER);
  
  // Prevent XSS
  response.headers.set("X-XSS-Protection", "1; mode=block");
  
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  
  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  
  // HSTS (solo in produzione)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  
  // Referrer Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions Policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  
  return response;
}
```



---

## 7. Deployment Architecture

### 7.1 Infrastruttura Completa (Managed Services)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION ARCHITECTURE                                         │
│                                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│   │   VERCEL EDGE NETWORK                                                               │  │
│   │                                                                                     │  │
│   │   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐                  │  │
│   │   │ utpistoia.  │◄───────►│   Vercel    │◄───────►│   Next.js   │                  │  │
│   │   │ it          │  HTTPS  │   Edge      │  Proxy  │   Server    │                  │  │
│   │   │             │         │   Cache     │         │   Functions │                  │  │
│   │   └─────────────┘         └─────────────┘         └──────┬──────┘                  │  │
│   │                                                          │                          │  │
│   └──────────────────────────────────────────────────────────┼──────────────────────────┘  │
│                                                              │                             │
│   ┌──────────────────────────────────────────────────────────┼──────────────────────────┐  │
│   │                    DATA LAYER                           │                          │  │
│   │                                                          ▼                          │  │
│   │   ┌──────────────────────────────┐    ┌──────────────────────────────────────┐     │  │
│   │   │    NEON (PostgreSQL)         │    │    UPSTASH REDIS                     │     │  │
│   │   │                              │    │                                      │     │  │
│   │   │  ┌────────────────────────┐  │    │  ┌──────────┐ ┌──────────┐          │     │  │
│   │   │  │  Primary (us-east-1)   │  │    │  │ Sessions │ │ BullMQ   │          │     │  │
│   │   │  │  • PostgreSQL 16       │◄─┼────┼─►│ Store    │ │ Queues   │          │     │  │
│   │   │  │  • pgvector            │  │    │  │ JWT      │ │ Workers  │          │     │  │
│   │   │  │  • 2 vCPU / 8GB RAM    │  │    │  │ Cache    │ │ Rate     │          │     │  │
│   │   │  │  • 100GB storage       │  │    │  │ Pub/Sub  │ │ Limiting │          │     │  │
│   │   │  │  • Auto-scaling        │  │    │  └──────────┘ └──────────┘          │     │  │
│   │   │  │  • Daily backups       │  │    │                                      │     │  │
│   │   │  │  • Point-in-time       │  │    │  Plan: 10K ops/day (free tier)      │     │  │
│   │   │  │    recovery            │  │    │  Upgrade: $0.20/100K ops            │     │  │
│   │   │  │                        │  │    │                                      │     │  │
│   │   │  │  Costo stimato:        │  │    │  Costo stimato:                     │     │  │
│   │   │  │  • Launch: ~$19/mese   │  │    │  • Launch: ~$0/mese (free)          │     │  │
│   │   │  │  • Scale: ~$50-100/m   │  │    │  • Scale: ~$10-20/mese              │     │  │
│   │   │  └────────────────────────┘  │    └──────────────────────────────────────┘     │  │
│   │   │                              │                                                 │  │
│   │   │  Connection: PgBouncer       │                                                 │  │
│   │   │  Pool: 20 connections        │                                                 │  │
│   │   └──────────────────────────────┘                                                 │  │
│   │                                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                    EXTERNAL SERVICES                                                 │  │
│   │                                                                                     │  │
│   │   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐              │  │
│   │   │ Google AI Studio │    │   Moonshot AI    │    │    Resend        │              │  │
│   │   │ (Gemini API)     │    │   (Kimi K2.6)    │    │    (Email)       │              │  │
│   │   │                  │    │                  │    │                  │              │  │
│   │   │  • gemini-2.5-   │    │  • kimi-k2.6     │    │  • Transactional │              │  │
│   │   │    flash         │    │  • Fallback      │    │  • Kit PDF       │              │  │
│   │   │  • embedding-001 │    │  • Kit gen.      │    │  • Notifications │              │  │
│   │   │                  │    │                  │    │                  │              │  │
│   │   │  Costo: ~$0      │    │  Costo: ~$0-20/m │    │  Costo: ~$0-10/m │              │  │
│   │   │  (free tier)     │    │  (pay-as-you-go) │    │  (100/day free)  │              │  │
│   │   └──────────────────┘    └──────────────────┘    └──────────────────┘              │  │
│   │                                                                                     │  │
│   └──────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                    COSTO TOTALE STIMATO                                              │  │
│   │                                                                                     │  │
│   │   Fase Launch (MVP):                                         │  │
│   │   • Vercel Pro:                    $20/mese                │  │
│   │   • Neon PostgreSQL:               $19/mese                │  │
│   │   • Upstash Redis:                 $0/mese (free)          │  │
│   │   • Gemini API:                    $0/mese (free tier)     │  │
│   │   • Kimi K2.6:                     $0-20/mese              │  │
│   │   • Resend:                        $0/mese (free)          │  │
│   │   ─────────────────────────────────────────────            │  │
│   │   TOTALE:                          ~$39-59/mese           │  │
│   │                                                             │  │
│   │   Fase Scale (10 agenti, 1000 kit/mese):                   │  │
│   │   • Vercel Pro:                    $20/mese                │  │
│   │   • Neon Scale:                    $69/mese                │  │
│   │   • Upstash Redis:                 $10/mese                │  │
│   │   • Gemini API:                    $0-20/mese              │  │
│   │   • Kimi K2.6:                     $20-50/mese             │  │
│   │   • Resend:                        $10/mese                │  │
│   │   ─────────────────────────────────────────────            │  │
│   │   TOTALE:                          ~$129-179/mese         │  │
│   │                                                             │  │
│   │   NOTA: Switch a VPS consigliato quando il costo > EUR     │  │
│   │   500/mese (~50 agenti attivi o 10K+ kit/mese)            │  │
│   │                                                             │  │
│   └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Docker (Sviluppo Locale)

```dockerfile
# Dockerfile — Development
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Start dev server
CMD ["npm", "run", "dev"]
```

```yaml
# docker-compose.yml — Development Stack
version: "3.8"

services:
  # Next.js Application
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/utpistoia?schema=public
      - DIRECT_URL=postgresql://postgres:postgres@db:5432/utpistoia?schema=public
      - REDIS_URL=redis://redis:6379
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=dev-secret-change-in-prod
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - KIMI_API_KEY=${KIMI_API_KEY}
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - db
      - redis
    command: npm run dev

  # PostgreSQL with pgvector
  db:
    image: ankane/pgvector:latest
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=utpistoia
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./prisma/migrations:/docker-entrypoint-initdb.d

  # Redis for BullMQ + Sessions + Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # Prisma Studio (optional)
  studio:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "5555:5555"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/utpistoia?schema=public
    depends_on:
      - db
    command: npx prisma studio --port 5555 --hostname 0.0.0.0

volumes:
  postgres_data:
  redis_data:
```

### 7.3 Environment Variables

```bash
# .env.example — Tutte le variabili necessarie

# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host:5432/db"  # Per migrations

# ═══════════════════════════════════════════════════════════════
# REDIS (Upstash)
# ═══════════════════════════════════════════════════════════════
REDIS_URL="rediss://default:pass@host:6379"
REDIS_TOKEN="upstash-token"

# ═══════════════════════════════════════════════════════════════
# AUTH (NextAuth.js)
# ═══════════════════════════════════════════════════════════════
NEXTAUTH_URL="https://utpistoia.it"
NEXTAUTH_SECRET="openssl rand -base64 32"  # Min 32 chars

# ═══════════════════════════════════════════════════════════════
# AI PROVIDERS
# ═══════════════════════════════════════════════════════════════
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"

KIMI_API_KEY="your-kimi-api-key"
KIMI_MODEL="kimi-k2.6"

# ═══════════════════════════════════════════════════════════════
# EMAIL (Resend)
# ═══════════════════════════════════════════════════════════════
RESEND_API_KEY="re_xxxxxxxx"
EMAIL_FROM="noreply@utpistoia.it"
EMAIL_ADMIN="admin@utpistoia.it"

# ═══════════════════════════════════════════════════════════════
# SECURITY
# ═══════════════════════════════════════════════════════════════
IP_HASH_SECRET="openssl rand -base64 32"

# ═══════════════════════════════════════════════════════════════
# FEATURE FLAGS
# ═══════════════════════════════════════════════════════════════
ENABLE_AI_FALLBACK="true"
ENABLE_KIT_GENERATION="true"
ENABLE_ANALYTICS="true"
LOG_LEVEL="info"

# ═══════════════════════════════════════════════════════════════
# MONITORING (optional — Sentry)
# ═══════════════════════════════════════════════════════════════
SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"
```

### 7.4 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci-cd.yml

name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: "20"
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test?schema=public"

jobs:
  # ═══════════════════════════════════════════════════════════════
  # LINT & TYPE CHECK
  # ═══════════════════════════════════════════════════════════════
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate Prisma Client
        run: npx prisma generate
      
      - name: Type check
        run: npm run type-check
      
      - name: Lint
        run: npm run lint
      
      - name: Format check
        run: npm run format:check

  # ═══════════════════════════════════════════════════════════════
  # TESTS
  # ═══════════════════════════════════════════════════════════════
  test:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: ankane/pgvector:latest
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup database
        run: |
          npx prisma migrate deploy
          npx prisma db seed
      
      - name: Run unit tests
        run: npm run test:unit
        env:
          DATABASE_URL: ${{ env.DATABASE_URL }}
          REDIS_URL: redis://localhost:6379
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: ${{ env.DATABASE_URL }}
          REDIS_URL: redis://localhost:6379

  # ═══════════════════════════════════════════════════════════════
  # DEPLOY TO PRODUCTION (Vercel)
  # ═══════════════════════════════════════════════════════════════
  deploy:
    name: Deploy to Production
    needs: [lint, test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: vercel/action-deploy@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"
      
      - name: Run database migrations
        run: npx prisma migrate deploy
        env:
          DIRECT_URL: ${{ secrets.DIRECT_URL }}

  # ═══════════════════════════════════════════════════════════════
  # DEPLOY TO STAGING
  # ═══════════════════════════════════════════════════════════════
  deploy-staging:
    name: Deploy to Staging
    needs: [lint, test]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel (staging)
        uses: vercel/action-deploy@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_STAGING }}
```

### 7.5 Directory Structure

```
utpistoia-webapp/
├── .github/
│   └── workflows/
│       └── ci-cd.yml
├── prisma/
│   ├── schema.prisma              # Schema completo
│   ├── migrations/
│   │   └── 20250101000000_init/
│   │       └── migration.sql
│   └── seed.ts                    # Dati iniziali
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (public)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Homepage
│   │   │   ├── prodotti/
│   │   │   ├── chi-siamo/
│   │   │   └── contatti/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         # Dashboard layout (auth)
│   │   │   ├── dashboard/
│   │   │   ├── dashboard/kit/
│   │   │   ├── dashboard/conversations/
│   │   │   └── dashboard/catalogo/
│   │   ├── (admin)/
│   │   │   ├── layout.tsx         # Admin layout (admin role)
│   │   │   ├── admin/
│   │   │   ├── admin/users/
│   │   │   ├── admin/settings/
│   │   │   └── admin/analytics/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── trpc/[trpc]/route.ts
│   │   │   └── webhook/
│   │   └── login/
│   │       └── page.tsx
│   ├── components/
│   │   ├── ui/                    # Shadcn/ui components
│   │   ├── layout/                # Layout components
│   │   ├── chat/                  # Chat components
│   │   ├── kit/                   # Kit form components
│   │   └── admin/                 # Admin components
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useChat.ts
│   │   ├── useKit.ts
│   │   └── useToast.ts
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── api.ts                 # tRPC client setup
│   │   └── constants.ts
│   ├── server/
│   │   ├── ai/                    # AI integration
│   │   │   ├── service.ts         # AI orchestrator
│   │   │   ├── rag.ts             # RAG engine
│   │   │   ├── tools.ts           # Tool definitions
│   │   │   └── providers/
│   │   │       ├── gemini.ts
│   │   │       └── kimi.ts
│   │   ├── api/
│   │   │   ├── routers/           # tRPC routers
│   │   │   │   ├── _app.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── user.ts
│   │   │   │   ├── product.ts
│   │   │   │   ├── kit.ts
│   │   │   │   ├── conversation.ts
│   │   │   │   ├── analytics.ts
│   │   │   │   └── settings.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rbac.ts
│   │   │   │   ├── rateLimit.ts
│   │   │   │   └── logger.ts
│   │   │   ├── procedures/
│   │   │   │   ├── public.ts
│   │   │   │   ├── authed.ts
│   │   │   │   ├── agent.ts
│   │   │   │   └── admin.ts
│   │   │   └── trpc.ts
│   │   ├── auth/
│   │   │   └── config.ts
│   │   ├── kit/                     # Kit deterministic engine
│   │   │   ├── engine.ts
│   │   │   ├── rules.ts
│   │   │   ├── calculator.ts
│   │   │   ├── types.ts
│   │   │   └── templates/
│   │   ├── queues/
│   │   │   └── index.ts
│   │   ├── security/
│   │   │   ├── csrf.ts
│   │   │   ├── xss.ts
│   │   │   └── headers.ts
│   │   └── db.ts                    # Prisma client singleton
│   └── types/
│       └── index.ts
├── tests/
│   ├── unit/
│   │   ├── kit-engine.test.ts
│   │   ├── rules.test.ts
│   │   └── calculator.test.ts
│   └── integration/
│       ├── api.test.ts
│       └── auth.test.ts
├── public/
│   └── images/
├── docker-compose.yml
├── Dockerfile.dev
├── Dockerfile.prod
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

---

## 8. Piano di Sviluppo Sequenziale

### 8.1 Overview Timeline

```
2025
Gennaio                Febbraio               Marzo
  │                       │                      │
  ├── Fase 1a ──┼── 1b ──┼── 1c ──┼── 1d ──┼── 1e ──┼── 1f ──
  │  (1 sett)    (1 sett)  (1 sett)  (1 sett)  (1 sett)  (1 sett)
  │
  ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Setup   │  │ Catalogo │  │ Chat AI  │  │  Kit     │  │ Dashboard│  │ Deploy   │
│ Progetto │  │ Prodotti │  │  Base    │  │  Engine  │  │  + UI    │  │ + Test   │
│ + Auth   │  │          │  │ (RAG)    │  │          │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘

                       Aprile               Maggio               Giugno
                         │                    │                    │
                         ├── Fase 2a ─┼── 2b ──┼── 2c ──┼── 2d ──
                         │  (1 sett)   (1 sett)  (1 sett)  (1 sett)
                         │
                         ▼
                       ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
                       │ Workflow │  │  Admin   │  │ Analytics│  │  Opt.    │
                       │  Kit     │  │  Panel   │  │          │  │  AI      │
                       │ Completo │  │          │  │          │  │          │
                       └──────────┘  └──────────┘  └──────────┘  └──────────┘

                         Q3+ (post approvazione)
                         │
                         ├── Fase 3a ──┼── 3b ──┼── 3c ──
                         │
                         ▼
                       ┌──────────┐  ┌──────────┐  ┌──────────┐
                       │  Sito    │  │ Integr.  │  │ Customer │
                       │  Pubblico│  │  DB Az.  │  │  Portal  │
                       │  E-comm  │  │          │  │          │
                       └──────────┘  └──────────┘  └──────────┘
```

### 8.2 Fase 1a: Setup Progetto + Auth (Settimana 1)

**Deliverables:**
- [ ] Repository GitHub con struttura progetto
- [ ] Docker Compose con PostgreSQL + pgvector + Redis
- [ ] Prisma schema completo + prima migration
- [ ] NextAuth.js con provider Credentials (email/password)
- [ ] Sistema RBAC (3 ruoli: public, agent, admin)
- [ ] Login page UI
- [ ] Middleware di autenticazione tRPC
- [ ] Seeding database (admin iniziale, categorie base)

**Dipendenze:** Nessuna (fase iniziale)

**Criteri di Accettazione:**
- Docker Compose avvia tutti i servizi senza errori
- Prisma migrate deploy esegue con successo
- Login con credenziali admin funziona (JWT session)
- tRPC middleware blocca accesso non autenticato
- Ruoli funzionano correttamente (admin vede /admin, agent no)

**Stima:** 5 giorni lavorativi

---

### 8.3 Fase 1b: Catalogo Prodotti (Settimana 2)

**Deliverables:**
- [ ] Model Product + ProductCategory nel Prisma schema
- [ ] Script import catalogo AGB (CSV/Excel → database)
- [ ] Generazione embedding per tutti i prodotti (batch)
- [ ] Indici: tsvector (GIN) + vector (HNSW)
- [ ] tRPC router product (search, getById, getByCode, listCategories)
- [ ] Hybrid search implementation (tsvector + vector similarity)
- [ ] UI catalogo prodotti con ricerca
- [ ] Pagina dettaglio prodotto

**Dipendenze:** Fase 1a (database + auth)

**Criteri di Accettazione:**
- Import catalogo AGB crea N prodotti con embedding
- Ricerca ibrida ritorna risultati rilevanti in <200ms
- UI catalogo responsive con filtri
- Pagina prodotto mostra specifiche, prezzi, disponibilita

**Stima:** 5 giorni lavorativi

---

### 8.4 Fase 1c: Chat AI Base con RAG (Settimana 3)

**Deliverables:**
- [ ] Conversazione model (Conversation + Message)
- [ ] tRPC router conversation (create, list, getMessages, sendMessage)
- [ ] Integrazione Gemini API (primary provider)
- [ ] RAG engine con hybrid search
- [ ] Tool search_products implementato
- [ ] Streaming response (SSE)
- [ ] UI chat con storia messaggi
- [ ] Visualizzazione prodotti referenziati nella chat

**Dipendenze:** Fase 1a (auth), Fase 1b (prodotti + RAG)

**Criteri di Accettazione:**
- Chat crea conversazione e salva messaggi nel DB
- Query "cerniere ARTECH" ritorna prodotti rilevanti via RAG
- Messaggio user → AI response < 3 secondi
- Prodotti trovati mostrati inline nella chat
- Stream response visibile in tempo reale

**Stima:** 5 giorni lavorativi

---

### 8.5 Fase 1d: Kit Deterministic Engine (Settimana 4)

**Deliverables:**
- [ ] KitInput schema completo con Zod validation
- [ ] KitDeterministicEngine (validation → rule lookup → component selection)
- [ ] KitRulesRegistry con regole AGB codificate
- [ ] QuantityCalculator (dimension-based)
- [ ] KitTemplate model e seeding
- [ ] tRPC router kit (createRequest, generateKit, getById)
- [ ] UI form kit (tutti i parametri: tipo, dimensioni, materiale, aria, asse, battuta, sede, lato, direzione, finitura, serie)
- [ ] Visualizzazione risultato kit (tabella componenti)

**Dipendenze:** Fase 1a (database), Fase 1b (prodotti)

**Criteri di Accettazione:**
- Form kit valida tutti i parametri (es. larghezza 300-3000mm)
- Engine genera componenti corretti per ARTECH anta ribalta
- Prezzi totali calcolati correttamente
- Risultato mostrato in tabella con: codice, nome, posizione, quantita, prezzo
- Tempo generazione < 500ms

**Stima:** 5 giorni lavorativi

---

### 8.6 Fase 1e: Dashboard Agente + UI (Settimana 5)

**Deliverables:**
- [ ] Layout dashboard (sidebar + topbar)
- [ ] Dashboard homepage (riepilogo)
- [ ] Lista conversazioni con anteprima ultimo messaggio
- [ ] Lista richieste kit con stato e filtri
- [ ] Pagina catalogo con ricerca
- [ ] Pagina profilo utente
- [ ] Design system (colori, tipografia, componenti)
- [ ] Responsive design (mobile + tablet)

**Dipendenze:** Fase 1a (auth), Fase 1c (chat), Fase 1d (kit)

**Criteri di Accettazione:**
- Dashboard responsive su desktop e tablet
- Navigazione tra sezioni fluida (< 100ms)
- Lista conversazioni mostra ultimo messaggio e timestamp
- Lista kit mostra stato con colori (DRAFT=grigio, COMPLETED=verde, etc.)
- UI coerente con design system definito

**Stima:** 5 giorni lavorativi

---

### 8.7 Fase 1f: Deploy + Test con Agenti (Settimana 6)

**Deliverables:**
- [ ] Deploy su Vercel (production)
- [ ] Configurazione Neon PostgreSQL
- [ ] Configurazione Upstash Redis
- [ ] Configurazione Gemini API
- [ ] CI/CD pipeline GitHub Actions
- [ ] Test E2E con 2-3 agenti (scenario reali)
- [ ] Bugfix e ottimizzazioni
- [ ] Documentazione utente (base)

**Dipendenze:** Tutte le fasi precedenti

**Criteri di Accettazione:**
- Deploy automatico su push su main
- 2-3 agenti creano account e usano il sistema
- Chat AI risponde correttamente a query su prodotti
- Kit generato correttamente per almeno 3 configurazioni diverse
- Nessun errore critico in 3 giorni di uso
- Lighthouse score > 80 (performance + accessibility)

**Stima:** 5 giorni lavorativi

---

### 8.8 Fase 2: Enhancement (3-4 settimane)

#### Fase 2a: Richieste Kit Workflow Completo (Settimana 7)

**Deliverables:**
- [ ] Workflow stato completo (DRAFT → PENDING → GENERATING → COMPLETED → REVIEWED → SENT → APPROVED/REJECTED)
- [ ] Modifica kit dopo generazione (aggiungi/rimuovi componenti)
- [ ] Associazione cliente a richiesta kit
- [ ] Note per cliente
- [ ] Export PDF kit (BullMQ queue)
- [ ] Invio kit via email (Resend)

**Criteri di Accettazione:**
- Workflow stato funziona end-to-end
- Agente puo modificare kit dopo generazione
- PDF generato con layout professionale
- Email inviata con allegato PDF

---

#### Fase 2b: Admin Panel (Settimana 8)

**Deliverables:**
- [ ] Pagina gestione utenti (CRUD)
- [ ] Pagina impostazioni AI (provider, model, prompt)
- [ ] Pagina impostazioni API keys
- [ ] Pagina template kit (CRUD regole)
- [ ] Import prodotti (upload CSV/Excel)

**Criteri di Accettazione:**
- Admin crea nuovo agente (genera password temporanea)
- Admin cambia modello AI (Gemini flash/pro)
- Admin modifica prompt di sistema
- Admin carica nuovo catalogo AGB

---

#### Fase 2c: Analytics (Settimana 9)

**Deliverables:**
- [ ] Dashboard statistiche (conversazioni, kit, agenti)
- [ ] Grafici attivita (Recharts/Tremor)
- [ ] Activity log con filtri
- [ ] Report conversazioni per agente
- [ ] Report kit generati per periodo
- [ ] Esport dati (CSV)

**Criteri di Accettazione:**
- Dashboard mostra KPI aggiornati in tempo reale
- Filtri per data, agente, tipo attivita
- Grafici responsive e accessibili

---

#### Fase 2d: Ottimizzazioni AI (Settimana 10)

**Deliverables:**
- [ ] Fallback Kimi K2.6 implementato
- [ ] BullMQ queue per fallback
- [ ] Rate limiting per API AI
- [ ] Caching risposte frequenti (Redis)
- [ ] Ottimizzazione prompt system
- [ ] Tool generate_kit integrato in chat

**Criteri di Accettazione:**
- Fallback a Kimi funziona (simula errore Gemini)
- Rate limit blocca dopo 30 req/min
- Cache hit riduce latenza del 50%
- Kit generato direttamente dalla chat

---

### 8.9 Fase 3: Futuro (post approvazione)

#### Fase 3a: Sito Pubblico E-commerce (4-6 settimane)
- [ ] Homepage pubblica con catalogo
- [ ] Pagine prodotto pubbliche
- [ ] Richiesta preventivo (form B2B)
- [ ] Ottimizzazione SEO
- [ ] Multilingua (IT/EN)

#### Fase 3b: Integrazione DB Aziendale (3-4 settimane)
- [ ] Sync con gestionale aziendale (API o DB link)
- [ ] Aggiornamento prezzi automatico
- [ ] Aggiornamento disponibilita magazzino
- [ ] Import ordini
- [ ] Export fatture

#### Fase 3c: Customer Portal (4-6 settimane)
- [ ] Autenticazione clienti B2B
- [ ] Storico richieste kit
- [ ] Download PDF kit approvati
- [ ] Dashboard cliente personale
- [ ] Notifiche email

---

### 8.10 Riepilogo Deliverables per Fase

| Fase | Durata | Deliverables Chiave | Dipendenze |
|------|--------|---------------------|------------|
| **1a** | 1 sett | Setup, DB, Auth, RBAC | Nessuna |
| **1b** | 1 sett | Catalogo AGB, RAG, Hybrid Search | 1a |
| **1c** | 1 sett | Chat AI, tool search_products | 1a, 1b |
| **1d** | 1 sett | Kit Engine, form, risultati | 1a, 1b |
| **1e** | 1 sett | Dashboard UI, responsive | 1a, 1c, 1d |
| **1f** | 1 sett | Deploy, test con agenti | Tutte |
| **2a** | 1 sett | Workflow kit, PDF, email | 1f |
| **2b** | 1 sett | Admin panel, settings | 1f |
| **2c** | 1 sett | Analytics, report | 1f |
| **2d** | 1 sett | AI fallback, rate limit, cache | 1f |
| **3a** | 6 sett | Sito pubblico e-commerce | 2d |
| **3b** | 4 sett | Integrazione DB aziendale | 2d |
| **3c** | 6 sett | Customer portal | 3a, 3b |

**Totale Fase 1 (MVP): 6 settimane**
**Totale Fase 2: 4 settimane**
**Totale Fase 3: 16 settimane**

---

### 8.11 Team Raccomandato

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TEAM STRUCTURE                                  │
│                                                                              │
│  Fase 1 (MVP) — 6 settimane:                                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Full-stack Dev │  │  Full-stack Dev │  │  AI/Backend Dev │              │
│  │  (Senior)       │  │  (Mid)          │  │  (Specialist)   │              │
│  │                 │  │                 │  │                 │              │
│  │  • Next.js UI   │  │  • tRPC API     │  │  • RAG engine   │              │
│  │  • Dashboard    │  │  • Prisma       │  │  • AI tools     │              │
│  │  • Auth         │  │  • Kit engine   │  │  • Gemini int.  │              │
│  │  • Responsive   │  │  • Testing      │  │  • Fallback     │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  Fase 2+ — aggiungere:                                                      │
│  ┌─────────────────┐  ┌─────────────────┐                                    │
│  │  UX/UI Designer │  │  DevOps/QA      │                                    │
│  │  (Part-time)    │  │  (Mid)          │                                    │
│  │                 │  │                 │                                    │
│  │  • Design sys   │  │  • CI/CD        │                                    │
│  │  • Mockups      │  │  • Monitoring   │                                    │
│  │  • UX review    │  │  • E2E tests    │                                    │
│  └─────────────────┘  └─────────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendice A: Tecnologie e Versioni

| Componente | Tecnologia | Versione |
|------------|-----------|----------|
| Framework | Next.js | 15.x |
| Language | TypeScript | 5.x |
| UI Library | React | 19.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | shadcn/ui | latest |
| API | tRPC | 11.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | 16+ |
| Vector Ext | pgvector | 0.8+ |
| Cache/Queue | Redis | 7+ |
| Queue Lib | BullMQ | 5.x |
| Auth | NextAuth.js | 4.x |
| Validation | Zod | 3.x |
| AI Primary | Google Gemini | 2.5-flash |
| AI Secondary | Moonshot Kimi | K2.6 |
| Charts | Recharts | 2.x |
| Email | Resend | latest |
| Testing | Vitest | 2.x |
| E2E | Playwright | 1.x |
| Deployment | Vercel | latest |
| DB Hosting | Neon | latest |
| Redis Hosting | Upstash | latest |

## Appendice B: Glossary

| Termine | Significato |
|---------|-------------|
| **AGB** | AGB Serrature, principale fornitore di ferramenta |
| **Anta Ribalta** | Finestra con apertura a sporgere (top-hung) |
| **Aria** | Distanza tra telaio e anta (mm) |
| **Asse** | Distanza asse di rotazione dal bordo (mm) |
| **Battuta** | Profondita dello sconto nel telaio (mm) |
| **Sede** | Profondita alloggio cerniera nel telaio (mm) |
| **RAG** | Retrieval-Augmented Generation (ricerca + AI) |
| **RAG** | Retrieval-Augmented Generation |
| **tRPC** | TypeScript RPC framework |
| **BullMQ** | Redis-based queue system |
| **RBAC** | Role-Based Access Control |

---

*Documento prodotto per Utensilferramenta Pistoiese S.p.A.*
*Architettura Tecnica Completa — Versione 1.0*
