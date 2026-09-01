# Goals — what this project is aiming at

So a session can infer priorities without asking. Updated 2026-08-09.

## The site itself

**chandparaaa.in is a working portfolio, not a work in progress.** It is live, deployed, and
every featured masonry card has real imagery (171 stills across 18 projects as of 2026-08).
The bar for any change is that it must not make the live site worse.

Current shape: 27 `work` entries (22 published, 5 draft) and 5 `lab` entries (1 published,
4 draft).

## What "better in three months" looks like

<!--
ANSH — this is the one answer the roadmap gets checked against, and it should be in your
words. Some candidates visible from the repo, but you should overwrite this entirely:

- Every published project carrying its film, not just stills (0 of 32 entries currently have
  a Vimeo ID — see the open thread in HANDOFF.md)
- The 2021-23 T7 archive imported and confirmed, so the site covers the full body of work
- Text-break copy rewritten in your voice rather than Claude's first drafts
- Media out of the repo so the site stops carrying 101 MB of git weight
-->

## Standing constraints

- **The publish path must stay double-click.** Any workflow change has to survive someone who
  does not want to open a terminal. → `memory/preferences.md`
- **No media in git, going forward.** The repo already carries 101 MB across 285 files and
  `.git` is 140 MB. History will not be rewritten — the public repo depends on it — so the
  goal is to stop the growth, not to shrink the past.
  → `~/.claude/plans/joyful-sparking-pebble.md`, Stage 4
- **Masters are precious and this project does not back them up.** Source masters live in
  `iCloud Drive (Archive)/…/Website Master/`, with a 2021-23 archive on `/Volumes/T7/`. Object
  storage will hold encoded web files only, never masters. → rule R3
