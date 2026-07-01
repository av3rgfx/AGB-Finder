#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-prisma-engines.sh
#
# In sandboxed/proxied environments Prisma's engine downloader attempts a
# DIRECT connection to binaries.prisma.sh and gets ECONNRESET (only the agent
# proxy has egress). `curl` DOES work through the proxy, so we fetch the engine
# binaries manually and point Prisma at them via env vars.
#
# Run once after `pnpm install`:  bash scripts/setup-prisma-engines.sh
# It downloads the engines into ./.prisma-engines and appends the required
# env vars to .env (idempotent).
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

PLATFORM="${PRISMA_PLATFORM:-debian-openssl-3.0.x}"
CACERT="${NODE_EXTRA_CA_CERTS:-/root/.ccr/ca-bundle.crt}"
CURL_CA=()
[ -f "$CACERT" ] && CURL_CA=(--cacert "$CACERT")

# Derive the engine commit hash from the installed @prisma/engines-version dir.
EV_DIR="$(ls -d node_modules/.pnpm/@prisma+engines-version@* 2>/dev/null | head -1 || true)"
if [ -z "$EV_DIR" ]; then
  echo "ERROR: @prisma/engines-version not installed. Run 'pnpm install' first." >&2
  exit 1
fi
HASH="${EV_DIR##*.}"   # everything after the last dot in the dir name
echo "Engine hash:     $HASH"
echo "Platform:        $PLATFORM"

DEST=".prisma-engines"
mkdir -p "$DEST"
BASE="https://binaries.prisma.sh/all_commits/$HASH/$PLATFORM"

fetch() { # <remote-file> <local-name> <chmod?>
  local url="$BASE/$1.gz" out="$DEST/$2"
  if [ -f "$out" ]; then echo "  exists: $out"; return; fi
  echo "  download: $1"
  curl -fsS "${CURL_CA[@]}" "$url" -o "$out.gz"
  gunzip -f "$out.gz"
  [ "${3:-}" = "exec" ] && chmod +x "$out"
}

fetch "libquery_engine.so.node" "libquery_engine-$PLATFORM.so.node"
fetch "schema-engine"           "schema-engine-$PLATFORM" exec

QE="$PWD/$DEST/libquery_engine-$PLATFORM.so.node"
SE="$PWD/$DEST/schema-engine-$PLATFORM"

touch .env
# Remove any previous engine lines, then append fresh ones (idempotent).
grep -vE '^(PRISMA_QUERY_ENGINE_LIBRARY|PRISMA_SCHEMA_ENGINE_BINARY|PRISMA_CLI_QUERY_ENGINE_TYPE|NODE_EXTRA_CA_CERTS)=' .env > .env.tmp 2>/dev/null || true
mv .env.tmp .env
{
  echo "# --- Prisma engines (local, sandbox workaround) ---"
  echo "PRISMA_QUERY_ENGINE_LIBRARY=$QE"
  echo "PRISMA_SCHEMA_ENGINE_BINARY=$SE"
  echo "PRISMA_CLI_QUERY_ENGINE_TYPE=library"
  echo "NODE_EXTRA_CA_CERTS=$CACERT"
} >> .env

echo "Done. Engine env vars written to .env"
