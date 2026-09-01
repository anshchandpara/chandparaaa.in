#!/usr/bin/env python3
"""PostToolUse hook (matcher: Edit|Write) — check your own house rules on new content.

This ships with an EMPTY rule set on purpose. Your writing rules are yours; adopting
someone else's is worse than having none. Fill in the config block below with whatever
you actually care about, or leave it empty and the hook is a harmless no-op.

TWO DESIGN CHOICES WORTH KEEPING
--------------------------------
1. DIFF-SCOPED, NOT FILE-SCOPED. It checks only lines that were ADDED, not the whole
   file. Without this, the first run on a real repo produces hundreds of hits in old
   content, you learn to ignore the output, and the hook is dead. A gate that cries
   wolf is worse than no gate.

2. EXIT 2 IS THE USEFUL EXIT CODE. On exit 2, stderr is fed back to the assistant,
   which can then fix the problem in the same turn without bothering you. Exit 0 with a
   printed warning just adds noise. Exit 1 blocks without explaining.

   So: structural problems that must be fixed → exit 2 with a clear message.
   Advisory notes → exit 0 and print.

Input (stdin JSON): { tool_name, tool_input: { file_path, ... }, ... }
"""
import json
import re
import subprocess
import sys
from pathlib import Path

# ── CONFIGURE ME ────────────────────────────────────────────────────────────
# Substrings or patterns you never want in newly added prose. Examples of what
# people put here: punctuation they dislike, emoji, corporate filler words.
# Each entry is (label, compiled pattern).
BANNED = [
    # ("em dash",  re.compile(r"—")),
    # ("emoji",    re.compile("[\U0001F300-\U0001FAFF☀-➿]")),
    # ("filler",   re.compile(r"\b(leverage|seamless|cutting-edge|world-class)\b", re.I)),
]

# Only check these file types for prose rules. Code comments are usually exempt from
# copy rules; add extensions deliberately.
PROSE_SUFFIXES = {".md", ".mdx", ".txt", ".yaml", ".yml"}

# Files where an edit should print a reminder rather than a failure. Use this for
# schema files that have a lockstep obligation elsewhere: "you changed the schema,
# remember the editor that has to render it".
REMINDERS = {
    "src/data/projects.json": (
        "projects.json edited by hand. The convention is a small Python script using "
        "json.dump(d, f, indent=2, ensure_ascii=False) plus a trailing newline — anything "
        "else mangles the em-dashes and the formatting."
    ),
    "src/lib/images.js": (
        "images.js is the media data layer. It currently globs the disk at build time, which "
        "only works because the media is committed. If media has moved to object storage, this "
        "MUST read the committed manifest instead — a disk glob returns {} on a CI runner and "
        "silently produces empty galleries with a green build."
    ),
}
# ────────────────────────────────────────────────────────────────────────────


def added_lines(path: Path):
    """Lines added versus git HEAD. Falls back to the whole file when git cannot say.

    The fallback is deliberate and its consequence is stated: for a brand-new
    untracked file, every line counts as added, which is correct.
    """
    try:
        out = subprocess.run(
            ["git", "diff", "-U0", "--no-color", "--", str(path)],
            capture_output=True, text=True, timeout=5, cwd=path.parent,
        )
        if out.returncode == 0 and out.stdout.strip():
            return [l[1:] for l in out.stdout.splitlines()
                    if l.startswith("+") and not l.startswith("+++")]
        # No diff output: either untracked or unchanged. Check the file.
        return path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        try:
            return path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            return []


def main() -> int:
    payload = json.load(sys.stdin)
    raw = (payload.get("tool_input") or {}).get("file_path")
    if not raw:
        return 0
    path = Path(raw)
    if not path.is_file():
        return 0

    for needle, message in REMINDERS.items():
        if needle in str(path):
            print(f"note: {message}")

    if not BANNED or path.suffix.lower() not in PROSE_SUFFIXES:
        return 0

    hits = []
    for line in added_lines(path):
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith("<!--"):
            continue  # comments are not shipped copy
        for label, pattern in BANNED:
            if pattern.search(line):
                hits.append((label, stripped[:100]))

    if hits:
        print(f"House copy rules violated in newly added lines of {path.name}:",
              file=sys.stderr)
        for label, excerpt in hits[:10]:
            print(f"  [{label}] {excerpt}", file=sys.stderr)
        print("\nFix these in this turn. Only added lines were checked; existing "
              "content was left alone.", file=sys.stderr)
        return 2  # stderr goes back to the assistant, which can self-correct

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)  # a broken validator must not block real work
