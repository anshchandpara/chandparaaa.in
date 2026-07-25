#!/usr/bin/env bash
# Publish the site: dev -> main -> GitHub Pages (chandparaaa.in).
#
#   npm run ship                 # commit any pending work, then publish
#   npm run ship "message"       # ... with a custom commit message
#
# Safety: refuses to publish a build that doesn't compile, always returns you
# to dev, and never force-pushes.
set -euo pipefail

cd "$(dirname "$0")/.."
BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; OFF=$'\033[0m'
say() { printf '%s\n' "$*"; }
die() { printf '%s\n' "${RED}✗ $*${OFF}" >&2; exit 1; }

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = "dev" ] || die "You're on '$BRANCH'. Design work happens on 'dev' — run: git checkout dev"

# 1. Commit anything pending.
if [ -n "$(git status --porcelain)" ]; then
  MSG="${1:-Design tweaks}"
  say "${BOLD}Committing your changes${OFF} ${DIM}($MSG)${OFF}"
  git add -A
  git commit -qm "$MSG

Co-Authored-By: Claude <noreply@anthropic.com>"
else
  say "${DIM}Nothing new to commit.${OFF}"
fi

# 2. Nothing to publish?
git fetch -q origin main 2>/dev/null || true
AHEAD=$(git rev-list --count origin/main..dev 2>/dev/null || echo 0)
if [ "$AHEAD" = "0" ]; then
  say "${GREEN}✓ Live site is already up to date.${OFF}"
  exit 0
fi
say "${BOLD}$AHEAD commit(s) to publish:${OFF}"
git log --oneline origin/main..dev | sed 's/^/  /'

# 3. Validate the build before it can reach the live site.
say ""
say "${BOLD}Building…${OFF}"
if ! npm run build >/tmp/ship-build.log 2>&1; then
  tail -20 /tmp/ship-build.log
  die "Build failed — nothing was published. Fix the errors above and re-run."
fi
say "${GREEN}✓ Build clean${OFF}"

# 4. dev -> main -> live.
say "${BOLD}Publishing…${OFF}"
git push -q origin dev                      # back up dev too
git checkout -q main
git merge -q --ff-only dev || { git checkout -q dev; die "main has commits dev doesn't. Run: git checkout dev && git merge main"; }
git push -q origin main
git checkout -q dev

say "${GREEN}✓ Pushed. GitHub Actions is deploying…${OFF}"

# 5. Follow the deploy if gh is available.
GH="$HOME/.local/bin/gh"
[ -x "$GH" ] || GH=$(command -v gh || true)
if [ -n "$GH" ]; then
  sleep 6
  for _ in $(seq 1 40); do
    S=$("$GH" run list -R anshchandpara/chandparaaa.in --limit 1 --json status,conclusion \
        -q '.[0] | .status + ":" + (.conclusion // "-")' 2>/dev/null || echo "")
    case "$S" in
      completed:success) say "${GREEN}${BOLD}✓ Live at https://chandparaaa.in${OFF}"; exit 0 ;;
      completed:*)       say "${RED}✗ Deploy failed:${OFF} $S"
                         say "  ${DIM}$GH run view -R anshchandpara/chandparaaa.in --log-failed${OFF}"; exit 1 ;;
    esac
    sleep 10
  done
  say "${YEL}Still deploying — check: https://github.com/anshchandpara/chandparaaa.in/actions${OFF}"
else
  say "${DIM}Deploy runs on GitHub Actions (~40s): https://chandparaaa.in${OFF}"
fi
