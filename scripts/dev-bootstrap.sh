#!/usr/bin/env bash
# One-shot dev bootstrap for sandbox/web sessions:
# start Docker if needed, fetch Prisma engines, bring up services, migrate, seed.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ ensuring Docker daemon…"
if ! docker info >/dev/null 2>&1; then
  (sudo -n dockerd >/tmp/dockerd.log 2>&1 &) 2>/dev/null || (dockerd >/tmp/dockerd.log 2>&1 &)
  for _ in $(seq 1 15); do docker info >/dev/null 2>&1 && break; sleep 1; done
fi

echo "▶ Prisma engines…"
bash scripts/setup-prisma-engines.sh

[ -f .env ] || cp .env.example .env

echo "▶ services…"
docker compose up -d

echo "▶ waiting for Postgres…"
for _ in $(seq 1 30); do
  docker exec ufptrade-db pg_isready -U postgres -d utpistoia >/dev/null 2>&1 && break
  sleep 2
done

set -a; # shellcheck disable=SC1091
source .env; set +a

echo "▶ migrate + seed…"
pnpm prisma migrate deploy
pnpm db:seed
pnpm db:seed:kit

echo "✓ ready — run: pnpm dev"
