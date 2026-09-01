# Preferences — how Ansh wants this project worked on

The one must-read in `memory/`. Machine-wide preferences live in `~/.claude/CLAUDE.md`; this
file holds only what is specific to the portfolio.

_Last updated 2026-08-09._

## Evidenced

- **No terminal required.** The whole publish path was deliberately built as a double-click:
  `Studio.command` starts the dev server and opens `/admin`, and the Publish bar runs
  `ship.sh` end to end and reports "✓ Live at chandparaaa.in". Prefer extending the Studio
  over handing over a command to paste. *(Evidence: `Studio.command`, `tools/vite-admin-plugin.js`,
  built 2026-08-02.)*
- **Ansh judges anything visual.** Present measured facts — overlay the versions, diff the
  render, compare against the reference — and let him call it. *(Rule R4.)*
- **Copy drafted by an assistant must be flagged as such, every time.** 27 text-break notes
  were written across 17 projects from each project's existing description; they were handed
  over explicitly labelled as first drafts in Claude's words, and they still need rewriting in
  his voice via Studio → Projects → Text breaks. *(2026-08, still open.)*
- **He corrects once, and the correction sticks.** The nav brand string was changed by an
  assistant and he reverted it to "Ansh Chandpara". Do not re-litigate it.
- **Local first, ship only when happy.** `dev` is where everything happens; `main` is only
  ever reached through `ship.sh`. *(Rule R1.)*
- **Drafts are a real workflow, not a staging accident.** `"draft": true` hides an entry from
  the masonry while keeping `?p=<slug>` previewable. Used deliberately for entries that have
  no media yet — e.g. `reel-edit-2026`, marked draft on 2026-08-08 at his request.

## Unknown — ask rather than assume

<!--
ANSH — these change how a session behaves and nobody can fill them in but you:

- When there is a choice to make, do you want one recommended default plus named exceptions,
  or the full set of options laid out?
- Plain-language summary first with technical detail underneath, or straight to the detail?
- How much should a session do before checking in on design work — one option, or three?
- What stalls you? What unblocks you when you are stuck on something?
-->
