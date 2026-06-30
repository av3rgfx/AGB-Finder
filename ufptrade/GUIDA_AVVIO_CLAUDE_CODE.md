# Guida Avvio — Come usare Claude Code per sviluppare UFPtrade

> Questa guida ti spiega come avviare il progetto in Claude Code e come gestire le sessioni di lavoro giorno per giorno.

---

## Prerequisiti

Prima di aprire Claude Code, assicurati di avere:

1. **Node.js 20+** installato (`node --version`)
2. **pnpm** installato (`npm i -g pnpm`)
3. **Docker + Docker Compose** installati (`docker --version`)
4. **Git** inizializzato

Account da creare (gratuiti):
- [ ] **Google AI Studio** → https://aistudio.google.com → API Key gratuita
- [ ] **Neon** → https://neon.tech → Database PostgreSQL (free tier)
- [ ] **Upstash** → https://upstash.com → Redis (free tier)
- [ ] **Vercel** → https://vercel.com → Deploy (free tier)
- [ ] **Moonshot AI** → https://platform.moonshot.cn → API Key (opzionale per ora)

---

## Step 1: Prepara i file di progettazione

Copia i file di progettazione in una directory accessibile a Claude Code:

```bash
# Crea directory progetto
mkdir -p ~/projects/ufptrade-design

# Copia i file di progettazione
cp /mnt/agents/output/PROGETTO_MASTER.md ~/projects/ufptrade-design/
cp /mnt/agents/output/ARCHITETTURA_COMPLETA.md ~/projects/ufptrade-design/
cp /mnt/agents/output/wireframe-utensilferramenta.md ~/projects/ufptrade-design/
cp -r /mnt/agents/output/ufptrade-design/ ~/projects/
cp /mnt/agents/output/CLADE_SKILLS_REPORT.md ~/projects/ufptrade-design/
```

---

## Step 2: Apri Claude Code

```bash
# Posizionati dove vuoi creare il progetto
cd ~/projects

# Avvia Claude Code
claude

# Oppure in modalita ultracode:
claude --mode ultracode
```

---

## Step 3: Primo messaggio (copia e incolla)

**IMPORTANTE:** Non incollare tutto il PROMPT_AVVIO_CLAUDE.md in un messaggio solo. Ecco come procedere:

### Messaggio 1 — Contesto iniziale

```
Devi sviluppare la webapp UFPtrade per Utensilferramenta Pistoiese S.p.A. — un'azienda B2B di ferramenta a Pistoia. E' un progetto Next.js 15 + React 19 + TypeScript + tRPC + Prisma + PostgreSQL(pgvector) + Redis.

REGOLE ASSOLUTE (non negoziabili):
1. Kit Generation = Engine DETERMINISTICO TypeScript. MAI usare LLM per calcolare componenti kit.
2. Single-agent AI con tool-use. NON fare sistema multi-agent.
3. Dual AI provider: Google Gemini (primario) + Moonshot Kimi K2.6 (kit gen + fallback).
4. Ogni chiamata AI passa attraverso BullMQ con rate limiting e circuit breaker.
5. TypeScript strict mode sempre.
6. Tutte le API attraverso tRPC. Mai fetch dirette.
7. Tutte le query DB attraverso Prisma. Mai raw SQL (tranne migrazioni).
8. Lingua italiana per tutta l'UI.
9. Admin crea tutti gli account agenti. Nessuna self-registration.
10. Product codes in font monospace.

Devi iniziare dalla FASE 1 — MVP Gestionale: setup progetto, auth, schema DB, layout dashboard.

PRIMA di scrivere codice, leggi i file di progettazione che ti indico. Ti daro' i percorsi uno alla volta. Conferma di aver letto ogni file e poi passo al prossimo.
```

### Messaggio 2 — Dai i file da leggere

Dopo che Claude conferma, dai i file da leggere uno alla volta usando `read_file`:

```
Leggi questo file integralmente: [percorso]/PROGETTO_MASTER.md
```

Poi:
```
Ora leggi: [percorso]/ARCHITETTURA_COMPLETA.md (solo capitoli 1, 2, 6, 7, 8 per ora)
```

Poi:
```
Ora leggi: [percorso]/ufptrade-design/DESIGN.md
```

Poi:
```
Ora leggi: [percorso]/ufptrade-design/PRODUCT.md
```

Poi:
```
Ora leggi solo le sezioni "Login" e "Dashboard Agente" da: [percorso]/wireframe-utensilferramenta.md
```

### Messaggio 3 — Chiedi il piano

```
Perfetto. Ora fai un piano dettagliato di implementazione per la Fase 1 (Fondamenta, settimane 1-2).

Elenca:
1. Tutti i file che creerai, in ordine preciso
2. Il contenuto chiave di ogni file (senza scriverlo ancora, solo descrivere)
3. Le dipendenze tra i file (cosa deve essere fatto prima)
4. I test da fare dopo ogni gruppo di file

Non scrivere ancora codice. Presentami solo il piano e aspetta la mia conferma.
```

### Messaggio 4 — Conferma e avvia

Dopo che ti presenta il piano:

```
Confermo il piano. Prima di iniziare a scrivere codice, crea il file handoff.md nella root del progetto seguendo questo template esatto:

---
# Handoff — UFPtrade WebApp

## Sessione attuale
- **Data/ora inizio:** [timestamp]
- **Fase:** Fase 1 — MVP (Fondamenta)
- **Branch:** main

## Task (stato)
- [ ] 1. Setup Next.js + dipendenze
- [ ] 2. Docker Compose (Postgres + Redis)
- [ ] 3. Schema Prisma + migrazione
- [ ] 4. NextAuth config
- [ ] 5. RBAC middleware
- [ ] 6. Layout dashboard
- [ ] 7. Login page
- [ ] 8. Seed script
- [ ] 9. Test flusso auth
- [ ] 10. README + handoff

## Task completati
(nessuno ancora)

## Task in corso
(nessuno ancora)

## Contesto tecnico
- Database: non creato
- Auth: non config
- Git: non inizializzato
- .env: non creato

## Note
Progetto da avviare.
---

Dopo aver creato handoff.md, procedi con l'implementazione seguendo il piano che hai presentato.
```

---

## Step 4: Gestione sessioni successive

### Come riprendere il lavoro il giorno dopo

All'inizio di OGNI nuova sessione con Claude Code, incolla questo messaggio:

```
Riprendiamo il lavoro sul progetto UFPtrade. Leggi prima il file handoff.md per capire lo stato attuale, poi leggi i file di progettazione necessari per i task pendenti.

Ecco le regole assolute del progetto (ribadisco):
1. Kit Generation = Engine DETERMINISTICO TypeScript
2. Single-agent AI con tool-use
3. Dual AI provider: Gemini + Kimi
4. BullMQ per tutte le chiamate AI
5. TypeScript strict
6. tRPC per tutte le API
7. Prisma per tutte le query DB
8. UI in italiano
9. Solo admin crea account
10. Codici prodotto in monospace

Leggi handoff.md e dimmi cosa c'e' da fare oggi.
```

### Come chiudere una sessione

Alla fine di ogni sessione, chiedi a Claude:

```
Aggiorna il file handoff.md con:
- Task completati oggi (con check)
- Task in corso (se non finiti)
- Task pendenti per la prossima sessione
- Note su decisioni prese, problemi trovati, workaround
- Domande aperte
- Dipendenze bloccanti (se ci sono)

Poi fai un commit git con messaggio descrittivo.
```

---

## Struttura comandi utili

### Avvio progetto
```bash
# 1. Avvia Docker (DB + Redis)
docker-compose up -d

# 2. Avvia dev server
pnpm dev        # http://localhost:3000

# 3. Prisma Studio (GUI DB)
pnpx prisma studio   # http://localhost:5555
```

### Gestione database
```bash
# Migrazione
pnpx prisma migrate dev --name [nome]

# Genera client dopo schema change
pnpx prisma generate

# Seed
pnpx tsx prisma/seed.ts

# Reset DB
pnpx prisma migrate reset
```

### Git workflow
```bash
# Commit frequente
git add .
git commit -m "feat: [descrizione]"

# Push
git push origin main
```

---

## Checklist per il primo avvio

- [ ] Node.js 20+ installato
- [ ] pnpm installato
- [ ] Docker + Docker Compose installati
- [ ] Account Google AI Studio creato + API key
- [ ] Account Neon creato
- [ ] Account Upstash creato
- [ ] File di progettazione copiati in directory accessibile
- [ ] Claude Code aperto nella directory del progetto
- [ ] Primo messaggio inviato a Claude
- [ ] Claude ha letto tutti i file di progettazione
- [ ] Piano di implementazione confermato
- [ ] handoff.md creato
- [ ] Sviluppo avviato!
