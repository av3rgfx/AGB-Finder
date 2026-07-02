# Handoff — UFPtrade WebApp

> Creato/aggiornato da Claude alla fine di ogni sessione per riprendere il lavoro
> senza perdere contesto. (Regola permanente: aggiornare tutti i `.md` a fine sessione.)

---

## Sessione attuale

| Campo | Valore |
|-------|--------|
| **Data** | 2026-07-01 |
| **Fase in corso** | Fase 1 — MVP Gestionale |
| **Sotto-fase** | 1a Fondamenta ✅ completata · migrazione auth ✅ · **1b Catalogo in progettazione** |
| **Branch git** | `claude/ufptrade-mvp-setup-gcwxnt` |
| **Pull Request** | [#2](https://github.com/av3rgfx/AGB-Finder/pull/2) (aperta) |

## Stato attuale in breve

- **Fase 1a (Fondamenta): COMPLETA e verificata e2e.** Scaffolding, schema DB,
  auth, tRPC, login, dashboard. 29 test verdi, build ok, login reale da browser.
- **Migrazione auth NextAuth v4 → Better Auth: COMPLETA** (verdetto LLM Council).
- **Fase 1b (Catalogo + hybrid search): spec di design scritto e approvato nello
  scope, in attesa review utente → poi writing-plans.**

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

- **Fase 1b — spec in review utente.** Prossimo passo: `writing-plans` per il
  piano dettagliato, poi esecuzione TDD (parser AGB, import, product router,
  RAGEngine, UI Archivio+dettaglio con impeccable).

## Task pendenti

### Prossima sessione
- [ ] Approvazione spec 1b → piano dettagliato (writing-plans)
- [ ] Implementare parser `parseListino` (deterministico) + test su righe reali
- [ ] Import script `pnpm import:agb <pdf>` + seed catalogo sintetico
- [ ] Product router + RAGEngine (hybrid search, tsvector-only per ora)
- [ ] UI Archivio + dettaglio prodotto (impeccable)

### Sessioni future
- [ ] Fase 1c: Chat AI + tool search_products (RAG) — richiede GEMINI_API_KEY + coda
- [ ] Generazione embedding batch (BullMQ) quando c'è la key
- [ ] Fase 1d: Kit deterministic engine · 1e: dashboard dati reali · 1f: deploy

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
| Catalogo importato | [ ] Non ancora (spec pronto, PDF scaricato in scratchpad) |

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

### Regola utente — file esterni (2026-07-01)
- **Listino AGB PDF**: se manca nell'ambiente, **chiedere il link all'utente**
  (mai cercarlo sul web autonomamente). Link fornito:
  https://drive.google.com/file/d/1TugU94aM6OP557ELiLQpH0nUxhxrXMUz/view?usp=sharing

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
