# upgrade-check

A small, free, MIT-licensed coding-agent skill that asks: **Does this update still
work for someone who already has saved data?** It tells an agent to save real state
with the baseline app, open it with the candidate, compare meaningful values and
behavior, and restart repeatedly. A successful fresh install is not evidence.

The skill is just [SKILL.md](SKILL.md). The SQLite fixture and evaluation harness
demonstrate the procedure; they are not a CLI product or a general testing framework.
The skill needs an agent with filesystem and shell access. The demonstration needs
Node >=24 with built-in `node:sqlite`, no third-party dependencies or runtime network.

## Install

Clone it, then install the standalone skill:

```sh
git clone https://github.com/Figo5/upgrade-check-skill.git
cd upgrade-check-skill
```

For Claude Code:

```sh
mkdir -p ~/.claude/skills/upgrade-check
cp SKILL.md ~/.claude/skills/upgrade-check/SKILL.md
```

Or install it for Codex:

```sh
mkdir -p ~/.codex/skills/upgrade-check
cp SKILL.md ~/.codex/skills/upgrade-check/SKILL.md
```

For a project-local Claude Code installation, run from the target project, replacing
`/path/to/upgrade-check-skill` with this checkout's path:

```sh
mkdir -p .claude/skills/upgrade-check
cp /path/to/upgrade-check-skill/SKILL.md .claude/skills/upgrade-check/SKILL.md
```

The resulting project layout is:

```text
your-project/
└── .claude/
    └── skills/
        └── upgrade-check/
            └── SKILL.md
```

No fixture files are needed in an installed skill. The intended invocation is
`/upgrade-check` in Claude Code or `$upgrade-check` in Codex, with the baseline and
candidate to evaluate; that invocation syntax is assumed, not host-tested (see
compatibility below).

## One worked example: a notebook's saved week-start setting

The included notebook app stores notebooks, notes, and a week-start preference in
SQLite WAL mode. Its baseline defaults to Monday. The evaluation uses its normal
command interface to create two notebooks, three related notes, and explicitly save
Sunday. Each command checkpoints and closes the database before exiting.

Version 2 intentionally changes the preference from a day name to a numeric index
(Sunday = 0, Monday = 1). The correct upgrade preserves Sunday. The broken upgrade
uses a truthiness fallback that turns `0` into `1`, silently changing the preference
and the displayed week order. All record, relationship, and preference row counts
remain unchanged.

Run from this checkout:

```sh
node evaluation/run.mjs
```

The harness executes the baseline separately for each candidate, then executes the
real candidate's initialization, reads values and week order, edits a saved note,
and verifies persistence through two more startups. It also saves each of the
seven week-start values in its own baseline state and upgrades it with both
candidates, so the Sunday-only defect cannot hide behind a Tuesday seed. It
asserts the good candidate passes and the broken candidate fails specifically on
the Sunday setting and week order. Harness exit 0 means both expected outcomes were demonstrated; it does **not**
mean the broken candidate is safe. An unexpected pass, unrelated failure, or crash
makes the harness exit nonzero. Temporary databases are deleted in a `finally` block.

## Evaluation and compatibility

See [evaluation/results.md](evaluation/results.md) for captured commands/output,
artifact hashes, checks, and limitations, and
[agent-runs/](evaluation/agent-runs/) for four comparable Claude Code/Codex runs
with and without the skill. All four found the planted setting loss; that small
pilot is a demonstration, not an accuracy rate.

**Tested:** macOS 27.0.1 (arm64), Node 26.8.1, SQLite 3.53.4. Good upgrade preserved
records, relationships, and settings; broken upgrade retained counts but lost the
Sunday preference. Both were checked after edits and repeated restarts. The
frontmatter and installed-skill layouts were parsed by an independent skill validator
and validated against the documented Claude Code and Codex layout; neither host was
asked to discover or load the skill, and no invocation syntax was executed.

**Assumed:** the dependency-free harness should work on other operating systems and
Node >=24 versions with `node:sqlite`. The portable skill should work with other
agents supporting this skill layout and shell/filesystem access, including the
`/upgrade-check` and `$upgrade-check` invocation forms. These combinations, other
app storage engines, concurrent writers, interrupted migrations, duplication on
repeated startup (the fixture's guard is trivial), and downgrade behavior have not
been tested. The fixture's baseline and candidates share storage/read code, so a
reader-only regression in that shared code would not be caught. See [LICENSE](LICENSE).
