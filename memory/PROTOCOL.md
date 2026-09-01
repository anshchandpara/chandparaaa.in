# Memory protocol — Ansh Chandpara Portfolio

Durable state for this project lives here. This file says where each kind of fact goes.

## One owner per fact class

Write each fact in exactly ONE place. If a fact is tempted to live in two places, the second
place gets a pointer.

| Fact class | Owner | Everyone else |
|---|---|---|
| What shipped, when, which commit | `HANDOFF.md` ship log | link, do not restate |
| What is in flight right now | `HANDOFF.md` CURRENT block (rewritten, capped ~50 lines) | — |
| How Ansh wants to be worked with | `preferences.md` | — |
| Locked decisions and the why | `decisions.md` | pointer only |
| What surprised us | `lessons.md` | — |
| What we are aiming at | `goals.md` | — |
| Verbatim prompts | `user-prompts.md` (hook-written, never by hand) | — |
| Standing rules | `~/.claude/RULES.md` | pointer to a rule id (R1–R7) |
| Project conventions and workflow rails | `../CLAUDE.md` | — |
| Structure, design tokens, data-layer contract | `../README.md` | — |
| How the built things actually work | `../docs/design-state.md` | — |
| Encode and extraction recipes | `../docs/media-recipes.md` | — |

## At session start

1. Read `../CLAUDE.md`.
2. Read `preferences.md`. This is the one must-read in here.
3. Read the CURRENT block of `../HANDOFF.md`, and only that block.
4. Everything else is grep-on-demand. **Do not read the whole directory.**

## During the session

- Prompt capture is mechanical, done by a hook. Do not duplicate it by hand.
- When a durable fact appears, update its OWNER file **immediately**. Do not save it for the
  checkpoint; that is how facts get lost.

## At checkpoints

A checkpoint is: something shipped and was verified, a decision locked, a thread parked or
unblocked, before a compaction, or session end.

- **REWRITE the CURRENT block. Never append to it.**
- If something shipped, prepend a block to the ship log.
- Durable facts go to their owner file.

The test for the CURRENT block: **if a fresh session that read only this block would act
wrongly, the block is wrong.**

## Rules for writing in here

- Terse. This is state, not prose.
- No duplication. A second copy is a future contradiction — this directory exists because
  `CLAUDE.md` had grown to 610 lines with a second, disagreeing copy of its own state in
  `chandparaaa-handoff.md`.
- Cite sources with dates. "He said X" without a date cannot be aged out.
- Convert relative dates to absolute. "Last Tuesday" is meaningless in a month.

## Unattended runs

Scheduled jobs and loops write reports to their own files. They never rewrite the CURRENT
block, which belongs to interactive sessions. They never push and never fix. Report only.

---

`CLAUDE.md → this file → preferences + HANDOFF CURRENT → work.`
Everything else is grep-on-demand.
