#!/usr/bin/env bash
# Brings up the Fly WireGuard tunnel, resets the Upstash Vector index, then tears the tunnel down.
# WARNING: This deletes ALL vectors. Use only before a full re-ingestion.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WG_CONF="${SCRIPT_DIR}/fly-wireguard.conf"

if [[ ! -f "$WG_CONF" ]]; then
  echo "Error: WireGuard config not found at $WG_CONF"
  echo "Generate it with: pnpm wg:config"
  exit 1
fi

echo "WARNING: This will delete ALL vectors from the Upstash index."
read -r -p "Are you sure? (yes/N): " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

teardown() {
  echo ""
  echo "Bringing WireGuard tunnel down..."
  sudo wg-quick down "$WG_CONF" 2>/dev/null || true
}
trap teardown EXIT

echo "Bringing WireGuard tunnel up..."
sudo wg-quick up "$WG_CONF"
echo ""

pnpm --dir "$SCRIPT_DIR" reset
