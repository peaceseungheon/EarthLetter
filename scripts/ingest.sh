#!/usr/bin/env bash
set -euo pipefail

# Load .env from project root if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

SITE_URL="${SITE_URL:-http://localhost:3000}"
INGEST_SECRET="${INGEST_SECRET:-}"

if [[ -z "$INGEST_SECRET" ]]; then
  echo "Error: INGEST_SECRET is not set. Check your .env file." >&2
  exit 1
fi

echo "POST ${SITE_URL}/api/ingest"

curl --fail --silent --show-error \
  --max-time 300 \
  -X POST "${SITE_URL}/api/ingest" \
  -H "Authorization: Bearer ${INGEST_SECRET}" \
  -H "Content-Type: application/json" | jq .
