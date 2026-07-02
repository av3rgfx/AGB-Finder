# Handoff — UFPtrade WebApp

> Creato/aggiornato da Claude alla fine di ogni sessione per riprendere il lavoro
> senza perdere contesto. (Regola permanente: aggiornare tutti i `.md` a fine sessione.)

---

## Sessione attuale

| Campo | Valore |
|-------|--------|
| **Data** | 2026-07-02 |
| **Fase in corso** | Fase 1 — MVP Gestionale |
| **Sotto-fase** | 1a ✅ · migrazione auth ✅ · **1b Catalogo + hybrid search ✅** |
| **Branch git** | `claude/ufptrade-mvp-setup-gcwxnt` |
| **Pull Request** | [#2](https://github.com/av3rgfx/AGB-Finder/pull/2) (aperta) |

## Stato attuale in breve

- **Fase 1a (Fondamenta): COMPLETA e verificata e2e.** Scaffolding, schema DB,
  auth, tRPC, login, dashboard.
- **Migrazione auth NextAuth v4 → Better Auth: COMPLETA** (verdetto LLM Council).
- **Fase 1b (Catalogo + hybrid search): COMPLETA.** Parser deterministico del
  LISTINO 2026 (96,8% parse rate), **6.191 prodotti importati** in 22 categorie,
  RAGEngine a 3 strategie (prefisso codice ILIKE / AND tsvector / fallback OR),
  product router tRPC, UI Archivio (ricerca+griglia/lista+filtri) e dettaglio
  prodotto. 79 test verdi (+6 integrazione su DB reale), build ok, e2e browser
  verificato con screenshot. Embedding **differiti**: colonna vector(768) null
  finché non ci sono GEMINI_API_KEY + coda BullMQ (il ramo ibrido è già pronto).

## Task completati

**Fase 1a**
- [X] 1. Scaffolding Next.js 15 + TS strict + Tailwind + tooling
- [X] 2. Env validation (zod)
- [X] 3. Schema Prisma (12 modelli dominio) + pgvector(768) + migration
- [X] 4-6. Auth + tRPC core (RBAC) + handler/client/router
- [X] 7. Middleware edge
- [X] 8-10. Design tokens + Login + Dashboard shell (impeccable)
- [X] 11. Seed (admin + categorie)
- [X] 12. Verifica e2e + README + bootstrap
**Migrazione Better Auth**
- [X] Schema (User rimodellato + Session/Account/Verification), config, tRPC,
  router, middleware, UI client, seed, cleanup next-auth/bcryptjs
**Fase 1b**
- [X] Brainstorming scope + download listino AGB (PDF 959pp) + analisi formato
- [X] Spec design → `docs/superpowers/specs/2026-07-01-fase1b-catalogo-hybrid-search-design.md`

## Task in corso

- Nessuna. Fase 1b chiusa (piano 9/9 task completati e committati).

## Task pendenti

### Prossima sessione
- [ ] **Fase 1c: Chat AI base con RAG** — Conversation/Message router, provider
  Gemini, tool `search_products` (il RAGEngine è pronto), streaming, UI chat.
  Richiede GEMINI_API_KEY (+ coda BullMQ per la regola "AI via queue").
- [ ] Generazione embedding batch via BullMQ (attiva il ramo ibrido già scritto)

### Sessioni future
- [ ] Fase 1d: Kit deterministic engine · 1e: dashboard dati reali · 1f: deploy
- [ ] Valutare merge PR #2 (contiene 1a + Better Auth + 1b)

## Contesto tecnico

| Componente | Stato |
|------------|-------|
| Database schema | [X] Migrato (dominio + Better Auth) |
| Auth | [X] **Better Auth** (email/password, sessioni DB 8h, plugin admin) — funzionante |
| RBAC | [X] Impl + testato (procedure tRPC public/authed/agent/admin) |
| Dashboard layout | [X] Impl + stilizzato (impeccable) |
| Login page | [X] Impl + stilizzato |
| Docker (DB + Redis) | [X] Funzionante (avvio manuale daemon: `scripts/dev-bootstrap.sh`) |
| .env | [X] Completo (dev) |
| Git commit | [X] Multipli, pushati; PR #2 aperta |
| Catalogo importato | [X] **6.191 prodotti / 22 categorie** (LISTINO 2026, idempotente) |
| Ricerca prodotti | [X] tsvector 3-strategie + UI Archivio/dettaglio (embedding differiti) |

## Note importanti

### Decisioni prese (delta rispetto al design originale)
- **Auth: Better Auth** (non NextAuth v4/v5) — LLM Council unanime: v5 in sola
  manutenzione, Better Auth è il successore attivo. Sessioni DB (revoca), plugin
  admin per creazione account, tipi inferiti.
- **Embedding: `vector(768)`** (non 1536) — Gemini `gemini-embedding-001` @ 768.
- **Struttura: layout T3** (`src/server/api/...`, server-only sotto `src/server/`).
- **Ruoli**: `AGENT`/`ADMIN` come stringhe (Better Auth admin plugin + access-control).
- **Fase 1b**: parser PDF **deterministico** (no LLM); catalogo reale ~**6.300**
  codici (non 20k); hybrid search degrada a solo-tsvector finché embedding null.

### Problemi riscontrati e workaround
- **Engine Prisma**: il downloader va in ECONNRESET dietro il proxy → scaricati
  via curl con `scripts/setup-prisma-engines.sh` (env `PRISMA_*` in `.env`).
- **Docker daemon**: non parte da solo → `scripts/dev-bootstrap.sh` lo avvia.
- **Commit "Unverified"**: chiave di firma SSH dell'ambiente è vuota (0 byte) →
  tutti i commit sono non firmati ma correttamente attribuiti (`noreply@anthropic.com`).
- **PDF import**: richiede `poppler-utils` (`pdftotext`), installato nell'ambiente.

### Domande aperte
- Raggiungibilità API Gemini dalla sandbox (da verificare quando serviranno embedding).
- Merge PR #2 (Fase 1) prima o dopo la 1b? (1b è sullo stesso branch salvo diversa scelta.)

## Dipendenze bloccanti

| Blocco | Impatto | Risoluzione |
|--------|---------|-------------|
| `GEMINI_API_KEY` assente | Niente embedding reali | Fase 1b gira solo-tsvector; embedding differiti |
| Chiave firma vuota | Commit "Unverified" (cosmetico) | Provisioning chiave nell'ambiente (fuori controllo) |
| PDF listino 39MB | Non committabile | In `scratchpad/catalog.pdf`; import locale via script |

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
| 2026-07-02 | Fase 1b completa: parser AGB, import 6.191 prodotti, RAGEngine, UI Archivio+dettaglio | `claude/ufptrade-mvp-setup-gcwxnt` |
