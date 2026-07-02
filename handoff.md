# Handoff — UFPtrade WebApp

> Creato/aggiornato da Claude alla fine di ogni sessione per riprendere il lavoro
> senza perdere contesto. (Regola permanente: aggiornare tutti i `.md` a fine sessione.)

---

## Sessione attuale

| Campo | Valore |
|-------|--------|
| **Data** | 2026-07-02 |
| **Fase in corso** | Fase 1 — MVP Gestionale |
| **Sotto-fase** | 1a ✅ · migrazione Better Auth ✅ · **1b Catalogo + hybrid search ✅** |
| **Branch git** | `claude/superpowers-handoff-next-z1wyh7` → **merged su `main`** (scelta utente: merge locale, no PR) |
| **Pull Request** | Nessuna per la 1b (merge diretto); PR #2/#3 della 1a: merged |

## Stato attuale in breve

- **Fase 1a (Fondamenta): COMPLETA** — scaffolding, schema DB, Better Auth,
  tRPC, login, dashboard.
- **Fase 1b (Catalogo + hybrid search): COMPLETA e verificata e2e nel browser
  sul catalogo reale (6.191 prodotti).** Piano eseguito task-per-task (TDD):
  `docs/superpowers/plans/2026-07-02-fase1b-catalogo-hybrid-search.md`.
- Test: **86 passed** (+5 integrazione gated su `INTEGRATION_DATABASE_URL`).
  `typecheck` · `lint` · `build` verdi.

## Fase 1b — cosa è stato costruito

| Componente | File | Note |
|---|---|---|
| Parser deterministico | `src/server/catalog/parse-listino.ts` | State machine su righe `pdftotext -layout`; slicing celle per offset colonna; ereditarietà; NO `server-only` (riusato da tsx) |
| Mapping | `src/server/catalog/map-product.ts` | nome composto, specifications JSON, slug/nome categoria, dedupe last-wins |
| Estrazione PDF | `src/server/catalog/extract-pdf.ts` | wrapper `pdftotext` (poppler-utils) |
| Upsert catalogo | `src/server/catalog/import-catalog.ts` | idempotente, batch 500 in transazione, blocco fallito → log e prosegue |
| Import CLI | `scripts/import-agb.ts` → `pnpm import:agb <pdf>` | report copertura |
| Seed sintetico | `prisma/seed-catalog.ts` → `pnpm db:seed:catalog` | 50 prodotti AGB reali, 6 categorie |
| EmbeddingService | `src/server/ai/embedding.ts` | interfaccia + `GeminiEmbeddingService` (NON cablato, Fase ≥1c) + `FakeEmbeddingService` per test |
| RAGEngine | `src/server/ai/rag.ts` | **UNICO modulo raw SQL**; tsvector `italian` + **pg_trgm** + boost prefisso codice 2.0; ramo pgvector pronto (pesi 0.4/0.6); `getRelated` |
| Product router | `src/server/api/routers/product.ts` | `search` (agent, log `PRODUCT_SEARCHED`), `getById`, `getByCode`, `listCategories` (public), `getRelated` |
| UI Archivio | `src/app/(dashboard)/archivio/` + `src/components/product/` | ricerca debounced 300ms, filtri (categoria/prezzo/materiale/disponibilità), lista (default, densità) / griglia, skeleton/vuoto/errore, paginazione 24 |
| UI Dettaglio | `archivio/[id]` | specifiche tabellari, copy codice con feedback, 4 correlati, stato not-found |
| Migration | `20260702050000_trgm_fuzzy_search` | `pg_trgm` + indice GIN trigram su `name + short_description` |

### Numeri dell'import reale (listino 2026, misurati)
`Pagine: 959 · Righe con codice: 8491 · Parsed: 8217 · Skipped: 274 ·
Prodotti unici: 6191 · Categorie: 22`. Idempotente (secondo run identico).
E2e browser: "cerniere anta ribalta" 13 hit / 218ms · "cremonese ARTECH" 90 /
195ms · codice esatto 1 · prefisso `A50122` → primi risultati col prefisso.

### Decisioni prese durante la 1b (delta vs spec/piano)
- **pg_trgm aggiunto**: lo stemmer `italian` è asimmetrico ("cerniere"→`cern`,
  "cerniera"→`cernier`) → il singolare non trovava il plurale. Ramo
  `word_similarity`/`<%` (peso 0.5) + indice GIN. Estensione in `schema.prisma`.
- **Boost prefisso codice 2.0** (era 1.0): col catalogo pieno un accessorio che
  cita un codice nel nome superava i codici veri.
- **Prodotti unici = 6.191** (non 6.299: quel conteggio includeva codici presenti
  solo su righe-indice) · **categorie = 22** (23 nel parse; i 3 codici di
  "GALILEO PRO - RICAMBI" ricompaiono altrove → dedupe last-wins li riassegna).
- **Vista lista default** in Archivio (PRODUCT.md: information density).
- `shortDescription` = `categoria · sottocategoria · materiale` (per il match
  tsvector sulle categorie); `composeName` include la mano DX/SX.
- Errori di ricerca: banner inline `role="alert"` (niente infra toast, YAGNI).

### Limitazioni note (accettate per 1b)
- Colonne combinate tipo "ENTRATA HBB" (ARTECH): la `dimension` mostrata può
  essere la cella ereditata meno significativa (es. "1) 7,5" invece del range
  HBB); tutti i dati grezzi restano in `specifications.colonne`. Migliorabile
  in 1c con gli embedding o mappature colonna dedicate.
- `total` della ricerca = match del ramo testuale (il vettoriale integrerà solo
  il ranking).

## Task pendenti

### Prossima sessione (Fase 1c — Chat AI)
- [ ] Chat AI + tool `search_products` (RAG) — richiede `GEMINI_API_KEY` + coda BullMQ
- [ ] Generazione embedding batch (BullMQ) quando c'è la key → attiva ramo vettoriale
- [ ] Verificare raggiungibilità API Gemini dalla sandbox
- [ ] Valutare PR verso `main` per la 1b (branch pushato, nessuna PR aperta)

### Sessioni future
- [ ] Fase 1d: Kit deterministic engine · 1e: dashboard dati reali · 1f: deploy

## Contesto tecnico

| Componente | Stato |
|------------|-------|
| Database schema | [X] Migrato (dominio + Better Auth + pg_trgm) |
| Auth | [X] Better Auth (email/password, sessioni DB 8h, plugin admin) |
| RBAC | [X] public/authed/agent/admin — testato |
| Catalogo importato | [X] 6.191 prodotti / 22 categorie (import locale; PDF in scratchpad, non committato) |
| Ricerca | [X] tsvector+trigram via RAGEngine; embedding **null** (1c) |
| UI Archivio + dettaglio | [X] Verificata nel browser (Playwright) |
| Docker (DB + Redis) | [X] `scripts/dev-bootstrap.sh` |
| Git | [X] Branch pushato; un commit per task |

### Regola utente — file esterni (2026-07-01)
- **Listino AGB PDF**: se manca nell'ambiente, **chiedere il link all'utente**
  (mai cercarlo sul web autonomamente). Link fornito:
  https://drive.google.com/file/d/1TugU94aM6OP557ELiLQpH0nUxhxrXMUz/view?usp=sharing

### Problemi riscontrati e workaround
- **Engine Prisma**: downloader in ECONNRESET dietro proxy → `scripts/setup-prisma-engines.sh`
  (fixato bug `set -e` sull'ultimo comando della funzione fetch); engine copiati
  anche in `node_modules/.pnpm/@prisma+engines@*/...` così `pnpm install` non
  ritenta il download.
- **Vitest**: `beforeEach(() => mock.mockReset())` — il valore di ritorno di
  beforeEach viene invocato come hook di cleanup → usare un body con graffe.
- **`pnpm lint | tail`** maschera l'exit code → mai in catena `&&` con pipe.
- **PDF import**: richiede `poppler-utils` (`apt-get install poppler-utils`).

## Istruzioni permanenti (utente)
1. **/using-superpowers** — sempre quando si sviluppa.
2. **/llm-council** — sempre per dubbi, quesiti, problematiche.
3. **/impeccable** — sempre per UI/UX.
4. **Aggiornare tutti i `.md`** (handoff incluso) **a fine di ogni sessione** (la
   fine sessione la dichiara l'utente).

## Cronologia sessioni

| Data | Cosa fatto | Branch |
|------|-----------|--------|
| 2026-07-01 | Fase 1a completa + migrazione Better Auth + spec Fase 1b | `claude/ufptrade-mvp-setup-gcwxnt` |
| 2026-07-02 | Piano 1b + esecuzione completa (parser, import 6.191 prodotti, RAGEngine tsvector+trigram, router, UI Archivio+dettaglio, verifiche browser) | `claude/superpowers-handoff-next-z1wyh7` |
