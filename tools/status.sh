#!/usr/bin/env bash
# What's on localhost vs. what's live. Run: npm run status
set -uo pipefail
cd "$(dirname "$0")/.."
BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YEL=$'\033[33m'; OFF=$'\033[0m'

BRANCH=$(git rev-parse --abbrev-ref HEAD)
git fetch -q origin main 2>/dev/null || true

printf '%s\n' "${BOLD}Branch:${OFF} $BRANCH $([ "$BRANCH" = dev ] && printf '%s' "${DIM}(working — safe)${OFF}" || printf '%s' "${YEL}(careful: main is the live branch)${OFF}")"

DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$DIRTY" != "0" ]; then
  printf '%s\n' "${BOLD}Uncommitted:${OFF} $DIRTY file(s) — only on this machine"
  git status --short | head -8 | sed 's/^/  /'
fi

AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
if [ "$AHEAD" = "0" ] && [ "$DIRTY" = "0" ]; then
  printf '%s\n' "${GREEN}✓ Live site matches your local work.${OFF}"
else
  printf '%s\n' "${BOLD}Not yet live:${OFF} $AHEAD commit(s)"
  git log --oneline origin/main..HEAD 2>/dev/null | head -8 | sed 's/^/  /'
  printf '%s\n' "${DIM}Publish with: npm run ship${OFF}"
fi
printf '%s\n' "${DIM}Live: https://chandparaaa.in${OFF}"
