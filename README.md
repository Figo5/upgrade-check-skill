# upgrade-check

**Does this update still work for someone who already has saved data?**

`upgrade-check` is a small, MIT-licensed coding-agent skill. It makes an agent
create state with the old build, open that state with the new build, compare
meaningful values and behavior, restart, and report what it actually checked.
A successful fresh install is not upgrade evidence.

The skill is [SKILL.md](SKILL.md). The tiny notebook app and harness here
demonstrate the procedure; they are not a CLI product or a testing framework.
You need an agent with filesystem and shell access. The demo needs Node 24+ and
uses the built-in `node:sqlite`; there are no dependencies or network calls.

## See it in 30 seconds

```sh
git clone https://github.com/Figo5/upgrade-check-skill.git
cd upgrade-check-skill
node evaluation/run.mjs
```

The harness runs a real baseline (`notebook/1.0.0`) and two candidate v2 builds.
The app stores notebooks, notes, and a week-start setting in SQLite. Upgrading
changes the setting from a day name to a numeric index.

Actual output excerpt:

```text
CHECK good/upgrade: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=0
RESULT good: PASS; two explicit restarts stable; edit persisted

DETECTED broken/upgrade: preferences.weekStartsOn expected=sunday observed=monday
DETECTED broken/upgrade: week order expected=sunday,monday,... observed=monday,...,sunday
CHECK broken/upgrade: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=2
RESULT broken: FAIL (expected setting loss detected); two explicit restarts stable; edit persisted

BOUNDARY SWEEP PASS: all seven values checked separately; broken loses only Sunday, good preserves all.
```

This is the point of the skill: **both candidates report the same record,
relationship, and preference counts**, and both start cleanly. The broken
candidate still silently changes an existing user's Sunday setting to Monday.
A row-count check would pass it.

The harness also seeds every one of the seven week-start values from a separate
baseline state, so a Sunday-only defect cannot hide behind a Tuesday test. Its
exit code 0 means “good passed and broken was detected”; it does not mean the
broken build is safe.

## Install

Clone the repository, then copy `SKILL.md` into your agent's skill directory.

Claude Code:

```sh
mkdir -p ~/.claude/skills/upgrade-check
cp SKILL.md ~/.claude/skills/upgrade-check/SKILL.md
```

Codex:

```sh
mkdir -p ~/.codex/skills/upgrade-check
cp SKILL.md ~/.codex/skills/upgrade-check/SKILL.md
```

Project-local Claude Code install, from the target project:

```sh
mkdir -p .claude/skills/upgrade-check
cp /path/to/upgrade-check-skill/SKILL.md .claude/skills/upgrade-check/SKILL.md
```

No fixture files are needed after installation.

## Invoke it

Claude Code:

```text
/upgrade-check Check whether upgrading /path/to/app from v1.4.0 to v2.0.0
keeps existing SQLite data. Use a disposable copy.
```

Codex:

```text
$upgrade-check Check whether upgrading /path/to/app from v1.4.0 to v2.0.0
keeps existing SQLite data. Use a disposable copy.
```

Both explicit forms were exercised in headless runs; see
[explicit-invocation.md](evaluation/agent-runs/explicit-invocation.md). Codex
users with a large skill collection may need an isolated `CODEX_HOME` because
the host can drop skill descriptions when its skills context budget is exceeded.

## What it checks

1. Pin the baseline and candidate versions/refs.
2. List persisted data and user-visible behavior that must survive.
3. Use disposable workspaces and synthetic data only.
4. Create representative state through the baseline's real interface, including
   boundary values of transformed fields.
5. Close or safely checkpoint the baseline; do not copy a live SQLite file.
6. Start the candidate on that state through its real initialization path.
7. Compare records, relationships, settings, and supported actions.
8. Restart and check again.
9. Check repeated normal startup for duplicates, resets, or re-transformation.
10. Report versions, commands, expected/observed checks, and untested areas.

Missing prerequisites mean **not tested**, never passed. A restored snapshot is
not proof that the old executable can read the upgraded schema.

## Evaluation: what this does and does not show

The deterministic fixture passes and detects its planted defect. A four-run
pilot compared Claude Code and Codex with and without the skill: all four runs
found the defect, so **this did not establish better bug-detection accuracy than
agents without the skill**. The visible benefit was report structure and retained
evidence. The skill was later revised to require covering every
boundary value after review found that a single non-boundary seed could let the
defect pass.

- Captured evidence and limitations: [evaluation/results.md](evaluation/results.md)
- Four comparable agent runs: [agent-runs/](evaluation/agent-runs/)
- Tested: macOS 27.0.1, Node 26.8.1, SQLite 3.53.4; Claude Code 2.1.311 and
  Codex CLI 0.155.1 explicit invocation.
- Assumed: other OS/Node 24+ combinations, other app storage engines, concurrent
  writers, interrupted migrations, and downgrades. The fixture's baseline and
  candidates share storage/read code, so a reader-only regression in that shared
  code would not be caught.

The harness and CI run on Node 24. See [LICENSE](LICENSE) (MIT).
