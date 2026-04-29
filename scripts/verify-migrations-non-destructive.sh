#!/usr/bin/env bash
# Fail if any Prisma migration SQL contains patterns that typically wipe or
# bulk-remove production data. Intended to run before `prisma migrate deploy`
# on production only. Safe changes (UPDATE, ALTER ADD COLUMN, CREATE INDEX,
# etc.) are not flagged.
#
# This does not replace human review of migrations; it catches footguns like
# TRUNCATE or DROP DATABASE accidentally committed to main.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="${ROOT}/prisma/migrations"
BAD=0

if [[ ! -d "$MIGRATIONS" ]]; then
  echo "No prisma/migrations directory at $MIGRATIONS"
  exit 0
fi

shopt -s nullglob
for f in "${MIGRATIONS}"/*/migration.sql; do
  [[ -f "$f" ]] || continue
  rel="${f#$ROOT/}"

  if grep -qiE 'DROP[[:space:]]+DATABASE' "$f"; then
    echo "::error file=$rel::Contains DROP DATABASE — never run this against production."
    BAD=1
  fi

  if grep -qiE '\bTRUNCATE\b' "$f"; then
    echo "::error file=$rel::Contains TRUNCATE — removes all rows from a table; not allowed by production safety check."
    BAD=1
  fi

  # Whole-schema drops are catastrophic for an app DB.
  if grep -qiE 'DROP[[:space:]]+SCHEMA[[:space:]]+(IF[[:space:]]+EXISTS[[:space:]]+)?["'\'']?[[:alnum:]_]+["'\'']?[[:space:]]+CASCADE' "$f"; then
    echo "::error file=$rel::Contains DROP SCHEMA … CASCADE — not allowed by production safety check."
    BAD=1
  fi
done

if [[ "$BAD" -ne 0 ]]; then
  echo ""
  echo "Fix or replace these migrations before deploying to production."
  echo "Legitimate schema work should use ALTER / CREATE / targeted UPDATE, and"
  echo "be reviewed in a PR — not bulk TRUNCATE or DROP DATABASE."
  exit 1
fi

echo "OK: No blocked destructive patterns (DROP DATABASE, TRUNCATE, DROP SCHEMA … CASCADE) in prisma/migrations/*/migration.sql"
