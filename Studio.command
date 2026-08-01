#!/bin/bash
# ── Chandparaaa Studio ────────────────────────────────────────────────────────
# Double-click this file to open the Studio (project editor + publisher).
# It starts the local dev server and opens the Studio in your browser.
# Closing this window (or Ctrl-C) shuts the server down.
#
# Nothing here needs Claude — it's yours to run any time.

cd "$(dirname "$0")" || exit 1

# Node is installed locally, not via Homebrew.
export PATH="$HOME/.local/bin:$PATH"

clear
printf '\n  \033[1mChandparaaa Studio\033[0m\n'
printf '  ────────────────────────────────────────────\n\n'

if ! command -v npm >/dev/null 2>&1; then
  printf '  \033[31mCan'"'"'t find npm.\033[0m Node should be at ~/.local/bin.\n'
  printf '  Try opening Terminal and running:  ls ~/.local/bin/node\n\n'
  read -r -p '  Press return to close…' _
  exit 1
fi

if [ ! -d node_modules ]; then
  printf '  First run — installing dependencies (one time, ~1 min)…\n\n'
  npm install || { read -r -p '  Install failed. Press return…' _; exit 1; }
fi

# Pick a free port so a stray server never blocks startup.
PORT=5173
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

printf '  Starting the studio server on port %s…\n' "$PORT"
PORT=$PORT npm run dev >/tmp/studio-server.log 2>&1 &
SERVER_PID=$!

# Shut the server down when this window closes.
trap 'kill $SERVER_PID 2>/dev/null; exit 0' INT TERM EXIT

# Wait for it to answer before opening the browser.
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://localhost:$PORT/admin"; then break; fi
  sleep 0.5
done

open "http://localhost:$PORT/admin"

printf '\n  \033[32mStudio is open in your browser.\033[0m\n'
printf '  Preview the site:  \033[4mhttp://localhost:%s\033[0m\n\n' "$PORT"
printf '  Edit projects, upload images, tweak the design, then hit\n'
printf '  \033[1mPublish\033[0m in the Studio to push it live to chandparaaa.in.\n\n'
printf '  \033[2mKeep this window open while you work. Close it to stop.\033[0m\n\n'

wait $SERVER_PID
