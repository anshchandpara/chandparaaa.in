#!/bin/bash
# SessionStart hook (matcher: compact) — reprint the CURRENT block after a compaction.
#
# THIS IS THE HIGHEST-VALUE HOOK IN THE PACK, and the least obvious.
#
# When a long session gets compacted, the assistant loses its working state. In theory
# it then re-reads the handoff file. In practice it does not, because nothing tells it
# to, and the summary it was handed reads complete enough to carry on from. So the
# second half of a long session drifts away from the first half, and the drift is
# invisible until something is built on a stale assumption.
#
# Stdout from a SessionStart hook is added to the assistant's context. So this prints
# the CURRENT block on every post-compaction start, and continuity stops depending on
# anyone remembering anything.
#
# It searches for the literal marker comments. If you rename or remove them, this hook
# prints nothing, and printing nothing looks exactly like "there was nothing to print".
# That is the one failure mode to know about.
#
# Exits 0 always. A missing handoff file is a normal state, not an error.

# Where your handoff lives, relative to the project root. Adjust to taste.
# Ordered. The ansh-portfolio entry is second because sessions are usually rooted at
# the PARENT folder (Work/Claude), where CLAUDE_PROJECT_DIR resolves one level above
# the repo. Without it this hook finds nothing and prints nothing, which is
# indistinguishable from "there was nothing to print".
CANDIDATES=(
  "HANDOFF.md"
  "ansh-portfolio/HANDOFF.md"
  "_intake/_session-handoff.md"
  "memory/HANDOFF.md"
  "Claude/memory/HANDOFF.md"
)

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

for rel in "${CANDIDATES[@]}"; do
  f="$ROOT/$rel"
  [ -f "$f" ] || continue
  # Print the block between the markers, inclusive, then stop.
  awk '/<!-- CURRENT:START -->/{f=1} f{print} /<!-- CURRENT:END -->/{exit}' "$f"
  exit 0
done

exit 0
