#!/usr/bin/env bash
# Brings up the Fly WireGuard tunnel, runs pnpm query, then tears the tunnel down.
# Usage: ./wg-query.sh "<query text>" [topK] [--filter "<filter>"]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WG_CONF="${SCRIPT_DIR}/../fly-wireguard.conf"

if [[ ! -f "$WG_CONF" ]]; then
  echo "Error: WireGuard config not found at $WG_CONF"
  echo "Generate it with: flyctl wireguard create spherity-vera"
  exit 1
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

pnpm --dir "$SCRIPT_DIR" query "$@"
