#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# dev-macos.sh — Avvio UFPtrade su macOS (MacBook) in un comando.
#
#   bash scripts/dev-macos.sh
#
# Cosa fa (idempotente):
#   1. Verifica Node >= 20 e attiva pnpm via corepack
#   2. Avvia Docker Desktop se non è in esecuzione
#   3. pnpm install
#   4. Genera .env al primo avvio (secret casuali; stampa le credenziali admin)
#   5. Avvia Postgres(pgvector) + Redis, applica le migrazioni, esegue il seed
#      (admin + categorie + 50 prodotti demo; catalogo completo: pnpm import:agb <pdf>)
#   6. Avvia il dev server su http://localhost:3000
#
# Prerequisiti: Docker Desktop installato; Node 20+ (es. brew install node@22).
# Opzionale (solo per l'import del listino PDF): brew install poppler
# NOTA: i workaround PRISMA_* del sandbox NON servono su macOS — Prisma
# scarica gli engine da solo.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$*"; }

# 1) Node + pnpm ------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "ERRORE: Node.js non trovato. Installa Node 20+ (es. 'brew install node@22')." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERRORE: serve Node >= 20 (trovato $(node -v))." >&2
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  bold "▶ attivo pnpm via corepack…"
  corepack enable pnpm >/dev/null 2>&1 || corepack enable
fi

# 2) Docker Desktop ---------------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  bold "▶ avvio Docker Desktop…"
  open -a Docker || {
    echo "ERRORE: Docker Desktop non trovato. Installalo da docker.com." >&2
    exit 1
  }
  printf "  attendo il daemon"
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then echo " ✓"; break; fi
    printf "."
    sleep 2
  done
  docker info >/dev/null 2>&1 || { echo; echo "ERRORE: Docker non è partito entro 2 minuti." >&2; exit 1; }
fi

# 3) Dipendenze -------------------------------------------------------------
bold "▶ pnpm install…"
pnpm install

# 4) .env -------------------------------------------------------------------
if [ ! -f .env ]; then
  bold "▶ genero .env (primo avvio)…"
  NEXTAUTH_SECRET="$(openssl rand -base64 32)"
  IP_HASH_SECRET="$(openssl rand -base64 32)"
  SEED_PW="$(openssl rand -base64 18)"
  cat > .env <<EOF
# Generato da scripts/dev-macos.sh il $(date -u +%Y-%m-%dT%H:%M:%SZ)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/utpistoia?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/utpistoia?schema=public"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
GEMINI_MODEL="gemini-2.5-flash"
KIMI_MODEL="kimi-k2.6"
IP_HASH_SECRET="$IP_HASH_SECRET"
SEED_ADMIN_EMAIL="admin@utensilferramenta.it"
SEED_ADMIN_PASSWORD="$SEED_PW"
EOF
  bold "  ── CREDENZIALI ADMIN (salvale!) ──────────────────────"
  echo "     email:    admin@utensilferramenta.it"
  echo "     password: $SEED_PW"
  bold "  ──────────────────────────────────────────────────────"
else
  echo "  .env già presente — non lo tocco."
fi

# 5) Servizi + DB -----------------------------------------------------------
bold "▶ Postgres(pgvector) + Redis…"
docker compose up -d
printf "  attendo Postgres"
for _ in $(seq 1 30); do
  if docker exec ufptrade-db pg_isready -U postgres -d utpistoia >/dev/null 2>&1; then echo " ✓"; break; fi
  printf "."
  sleep 2
done

set -a
# shellcheck disable=SC1091
source .env
set +a

bold "▶ migrazioni + seed…"
pnpm prisma migrate deploy
pnpm db:seed           # admin + categorie base
pnpm db:seed:catalog   # 50 prodotti demo reali (idempotente)

echo
bold "✓ pronto — http://localhost:3000 (login con le credenziali SEED_ADMIN_* in .env)"
echo "  Catalogo completo (6.191 prodotti): pnpm import:agb /percorso/LISTINO-2026.pdf"
echo
exec pnpm dev
