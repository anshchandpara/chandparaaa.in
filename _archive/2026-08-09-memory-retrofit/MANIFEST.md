# Archive manifest — 2026-08-09 memory retrofit

Moved here rather than deleted, per rule R3 (`~/.claude/RULES.md`).

| File | Was at | Size | Why moved |
|---|---|---|---|
| `CLAUDE.md.before` | `ansh-portfolio/CLAUDE.md` | 51 KB / 610 lines | Split into a 117-line spine + `docs/design-state.md` + `docs/media-recipes.md` + `memory/` + `HANDOFF.md`. Kept because it held ~400 lines of hand-maintained detail and the split is worth being able to diff. |
| `chandparaaa-handoff.md` | `Work/Claude/chandparaaa-handoff.md` | 5.3 KB | Superseded by `ansh-portfolio/HANDOFF.md`. It was a second copy of current state and had already drifted — it claimed 22 published projects while commit `6940c1c` had since hidden `reel-edit-2026`. Two owners for one fact is exactly what the retrofit removes. |

## Restore

```bash
cp ansh-portfolio/_archive/2026-08-09-memory-retrofit/CLAUDE.md.before ansh-portfolio/CLAUDE.md
mv ansh-portfolio/_archive/2026-08-09-memory-retrofit/chandparaaa-handoff.md ./chandparaaa-handoff.md
```

Note the pre-split `CLAUDE.md` is also recoverable from git at commit `6940c1c`, but the
uncommitted Hero-glitch documentation written after that commit exists **only** in this copy.

**Review after:** 2026-11-09. If the new structure has held for three months, this can go.
