# Captured evaluation

The harness exited **0**: the good upgrade passed; the broken upgrade failed on
the saved setting and its displayed week order, as expected. Both retained two
notebooks, three notes, their relationships, and one preference row. An edit to
an existing note persisted through two explicit restart cycles in both builds.
The broken setting remained wrong; stable repeated startup does not repair loss.

## Scope and artifact identity

Run on 2026-10-30 from `/Users/giofiore/work/upgrade-check-skill`. The executable
sources and harness match the committed working tree (see the repository history);
the SHA-256 hashes below pin every executable source, including shared code.
There is no compilation step: Node executes the `.mjs` artifacts directly.

- Baseline: `notebook/1.0.0`, `fixture/baseline.mjs` plus `fixture/app.mjs`.
- Candidates: `notebook/2.0.0-good` and `notebook/2.0.0-broken`, their respective
  entrypoints plus `fixture/app.mjs`.
- Contract: schema 1's `week_start` day name becomes schema 2's `week_start_day`
  integer (Sunday = 0). The meaning of the saved preference must remain Sunday.
- Defect: `const converted = day || 1` treats Sunday as missing and chooses Monday;
  the correct build uses `day ?? 1`. The baseline explicitly saves a nondefault
  Sunday through its supported command interface.
- Isolation: the harness copies executable sources into separate temporary
  baseline/candidate directories and gives each candidate an independently seeded
  database. No SQL seeding, live database copies, or mocked migrations are used.
- Shutdown: every app command finishes `wal_checkpoint(TRUNCATE)` and closes its
  connection. The harness waits for exit 0 and asserts the WAL is absent or empty.
  All commands start new processes; the two labeled restart cycles are additional
  normal `init`/`read`/`week` launches, never forced migration reruns.
- Checks: exact notebook IDs/names, note IDs/titles/bodies/notebook relationships,
  Unicode, multiline and empty bodies, preference meaning, complete week order,
  edit persistence, schema version, counts, and stability on repeated startup.

## Host and runtime

Command (exit 0):

```sh
date -u '+%Y-%m-%dT%H:%M:%SZ'
sw_vers
uname -m
node --version
claude --version
codex --version
```

Captured stdout/stderr:

```text
2026-10-30T18:52:54Z
ProductName:		macOS
ProductVersion:		27.0.1
BuildVersion:		26A434
arm64
v26.8.1
2.1.311 (Claude Code)
WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
codex-cli 0.155.1
```

The Codex warning concerns this sandbox's PATH alias permissions; version reporting
succeeded. SQLite's version is queried by the harness below.

## Full upgrade run

Exact harness command (exit 0):

```sh
node evaluation/run.mjs
```

Captured output follows. `$` marks logged commands; `NODE` and `RUN_DIR` identify
their exact executable and temporary path. JSON lines are actual app stdout.
Every logged app command exited 0. The temporary paths were removed by the harness;
rerunning the harness creates new paths and executes the entire sequence again.

```text
Host: darwin arm64 27.0.0; Node v26.8.1
SQLite: 3.53.4
SHA256 fixture/app.mjs 95713bec38899d0a85115b7a799a091c6240d3181daa4218abb8728ff2d82090
SHA256 fixture/baseline.mjs 1c95b509d4a6e302c3c3d925a89705bc26495a9395f112a8d68a96e80d7f827a
SHA256 fixture/good.mjs ecab889ff1169617949f8716691919bf725493fa708d905248173f6312eb2e3a
SHA256 fixture/broken.mjs 0d3fce385f4c98a7e57cc939adea0ac6e13c427b31820152aea1d541683c9804
SHA256 evaluation/run.mjs cb9c962f8e3fb54caf08b5278c9293f7b7991c2153b8e09c4927601aaa7b44b3
export NODE='/Users/<user>/.hermes/node/bin/node'  # local install path redacted
export RUN_DIR='/var/folders/5w/hyjrff5s4bj3zftwcbg76dhr0000gn/T/upgrade-check-TABX7n'
VERSION baseline/baseline.mjs --version => notebook/1.0.0
VERSION good/app/good.mjs --version => notebook/2.0.0-good
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'init'
{"schema":1}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'add-notebook' 'home' 'Home'
{"ok":"add-notebook"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'add-notebook' 'work' 'Work'
{"ok":"add-notebook"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'add-note' 'n1' 'work' 'Release' 'Keep the saved preference.'
{"ok":"add-note"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'add-note' 'n2' 'home' 'Sunday'\''s café' 'Plan
Bring notebook.'
{"ok":"add-note"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'add-note' 'n3' 'work' 'Follow-up' ''
{"ok":"add-note"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'set-week-start' 'sunday'
{"ok":"set-week-start"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'read'
{"schema":1,"notebooks":[{"id":"home","name":"Home"},{"id":"work","name":"Work"}],"notes":[{"id":"n1","notebook_id":"work","title":"Release","body":"Keep the saved preference."},{"id":"n2","notebook_id":"home","title":"Sunday's café","body":"Plan\nBring notebook."},{"id":"n3","notebook_id":"work","title":"Follow-up","body":""}],"preferences":{"weekStartsOn":"sunday"},"counts":{"notebooks":2,"notes":3,"preferences":1}}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'week'
{"days":["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]}
BASELINE good: saved through normal interface; all processes exited; WAL absent or empty
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'init'
{"schema":2}
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'read'
{"schema":2,"notebooks":[{"id":"home","name":"Home"},{"id":"work","name":"Work"}],"notes":[{"id":"n1","notebook_id":"work","title":"Release","body":"Keep the saved preference."},{"id":"n2","notebook_id":"home","title":"Sunday's café","body":"Plan\nBring notebook."},{"id":"n3","notebook_id":"work","title":"Follow-up","body":""}],"preferences":{"weekStartsOn":"sunday"},"counts":{"notebooks":2,"notes":3,"preferences":1}}
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'week'
{"days":["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]}
CHECK good/upgrade: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=0
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'edit-note' 'n2' 'Revised after upgrade: café, then review.'
{"ok":"edit-note"}
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'init'
{"schema":2}
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'read'
{"schema":2,"notebooks":[{"id":"home","name":"Home"},{"id":"work","name":"Work"}],"notes":[{"id":"n1","notebook_id":"work","title":"Release","body":"Keep the saved preference."},{"id":"n2","notebook_id":"home","title":"Sunday's café","body":"Revised after upgrade: café, then review."},{"id":"n3","notebook_id":"work","title":"Follow-up","body":""}],"preferences":{"weekStartsOn":"sunday"},"counts":{"notebooks":2,"notes":3,"preferences":1}}
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'week'
{"days":["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]}
CHECK good/restart-1: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=0
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'init'
{"schema":2}
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'read'
{"schema":2,"notebooks":[{"id":"home","name":"Home"},{"id":"work","name":"Work"}],"notes":[{"id":"n1","notebook_id":"work","title":"Release","body":"Keep the saved preference."},{"id":"n2","notebook_id":"home","title":"Sunday's café","body":"Revised after upgrade: café, then review."},{"id":"n3","notebook_id":"work","title":"Follow-up","body":""}],"preferences":{"weekStartsOn":"sunday"},"counts":{"notebooks":2,"notes":3,"preferences":1}}
$ "$NODE" "$RUN_DIR/good/app/good.mjs" "$RUN_DIR/good/data/notebook.sqlite" 'week'
{"days":["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]}
CHECK good/restart-2: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=0
RESULT good: PASS; two explicit restarts stable; edit persisted
VERSION baseline/baseline.mjs --version => notebook/1.0.0
VERSION broken/app/broken.mjs --version => notebook/2.0.0-broken
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'init'
{"schema":1}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'add-notebook' 'home' 'Home'
{"ok":"add-notebook"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'add-notebook' 'work' 'Work'
{"ok":"add-notebook"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'add-note' 'n1' 'work' 'Release' 'Keep the saved preference.'
{"ok":"add-note"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'add-note' 'n2' 'home' 'Sunday'\''s café' 'Plan
Bring notebook.'
{"ok":"add-note"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'add-note' 'n3' 'work' 'Follow-up' ''
{"ok":"add-note"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'set-week-start' 'sunday'
{"ok":"set-week-start"}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'read'
{"schema":1,"notebooks":[{"id":"home","name":"Home"},{"id":"work","name":"Work"}],"notes":[{"id":"n1","notebook_id":"work","title":"Release","body":"Keep the saved preference."},{"id":"n2","notebook_id":"home","title":"Sunday's café","body":"Plan\nBring notebook."},{"id":"n3","notebook_id":"work","title":"Follow-up","body":""}],"preferences":{"weekStartsOn":"sunday"},"counts":{"notebooks":2,"notes":3,"preferences":1}}
$ "$NODE" "$RUN_DIR/baseline/baseline.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'week'
{"days":["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]}
BASELINE broken: saved through normal interface; all processes exited; WAL absent or empty
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'init'
{"schema":2}
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'read'
{"schema":2,"notebooks":[{"id":"home","name":"Home"},{"id":"work","name":"Work"}],"notes":[{"id":"n1","notebook_id":"work","title":"Release","body":"Keep the saved preference."},{"id":"n2","notebook_id":"home","title":"Sunday's café","body":"Plan\nBring notebook."},{"id":"n3","notebook_id":"work","title":"Follow-up","body":""}],"preferences":{"weekStartsOn":"monday"},"counts":{"notebooks":2,"notes":3,"preferences":1}}
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'week'
{"days":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]}
DETECTED broken/upgrade: preferences.weekStartsOn expected=sunday observed=monday
DETECTED broken/upgrade: week order expected=sunday,monday,tuesday,wednesday,thursday,friday,saturday observed=monday,tuesday,wednesday,thursday,friday,saturday,sunday
CHECK broken/upgrade: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=2
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'edit-note' 'n2' 'Revised after upgrade: café, then review.'
{"ok":"edit-note"}
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'init'
{"schema":2}
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'read'
{"schema":2,"notebooks":[{"id":"home","name":"Home"},{"id":"work","name":"Work"}],"notes":[{"id":"n1","notebook_id":"work","title":"Release","body":"Keep the saved preference."},{"id":"n2","notebook_id":"home","title":"Sunday's café","body":"Revised after upgrade: café, then review."},{"id":"n3","notebook_id":"work","title":"Follow-up","body":""}],"preferences":{"weekStartsOn":"monday"},"counts":{"notebooks":2,"notes":3,"preferences":1}}
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'week'
{"days":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]}
DETECTED broken/restart-1: preferences.weekStartsOn expected=sunday observed=monday
DETECTED broken/restart-1: week order expected=sunday,monday,tuesday,wednesday,thursday,friday,saturday observed=monday,tuesday,wednesday,thursday,friday,saturday,sunday
CHECK broken/restart-1: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=2
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'init'
{"schema":2}
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'read'
{"schema":2,"notebooks":[{"id":"home","name":"Home"},{"id":"work","name":"Work"}],"notes":[{"id":"n1","notebook_id":"work","title":"Release","body":"Keep the saved preference."},{"id":"n2","notebook_id":"home","title":"Sunday's café","body":"Revised after upgrade: café, then review."},{"id":"n3","notebook_id":"work","title":"Follow-up","body":""}],"preferences":{"weekStartsOn":"monday"},"counts":{"notebooks":2,"notes":3,"preferences":1}}
$ "$NODE" "$RUN_DIR/broken/app/broken.mjs" "$RUN_DIR/broken/data/notebook.sqlite" 'week'
{"days":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]}
DETECTED broken/restart-2: preferences.weekStartsOn expected=sunday observed=monday
DETECTED broken/restart-2: week order expected=sunday,monday,tuesday,wednesday,thursday,friday,saturday observed=monday,tuesday,wednesday,thursday,friday,saturday,sunday
CHECK broken/restart-2: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=2
RESULT broken: FAIL (expected setting loss detected); two explicit restarts stable; edit persisted
HARNESS PASS: good upgrade passes; broken upgrade detected by setting value and week behavior despite unchanged counts.
CLEANUP: disposable workspaces and databases removed.
```

## Additional validation

Syntax and whitespace commands (exit 0):

```sh
for file in fixture/*.mjs evaluation/*.mjs; do node --check "$file" || exit; done
printf '%s\n' 'PASS: node --check on all five .mjs files'
git diff --check
```

Observed output:

```text
PASS: node --check on all five .mjs files
```

Frontmatter and installation layout check (exit 0), using a skill validator that
happens to be installed on the authoring host (path redacted) plus its Python/PyYAML
environment. It is not a dependency of this repository and the exact command is not
reproducible elsewhere. It checks conventional format and the documented directory
layouts only; this particular run made no host calls. Later agent runs did test
discovery: Claude Code listed and expanded `/upgrade-check`; Codex needed an
isolated `CODEX_HOME` because its normal home exceeded the skills context budget,
then expanded `$upgrade-check`. Both explicit runs detected the defect. See
[agent-runs/explicit-invocation.md](agent-runs/explicit-invocation.md).

```sh
python3 - <<'PY'
from pathlib import Path
import shutil
import subprocess
import tempfile
import yaml

validator = '/Users/<user>/.codex/skills/.system/skill-creator/scripts/quick_validate.py'  # local to authoring host
source = Path('SKILL.md')
frontmatter = yaml.safe_load(source.read_text().split('---', 2)[1])
assert frontmatter['name'] == 'upgrade-check'
assert isinstance(frontmatter['description'], str) and frontmatter['description']
with tempfile.TemporaryDirectory(prefix='upgrade-check-layout-') as directory:
    for layout in ['home/.claude/skills/upgrade-check', 'home/.codex/skills/upgrade-check', 'project/.claude/skills/upgrade-check']:
        target = Path(directory) / layout
        target.mkdir(parents=True)
        shutil.copyfile(source, target / 'SKILL.md')
        assert sorted(p.name for p in target.iterdir()) == ['SKILL.md']
        subprocess.run(['python3', validator, str(target)], check=True)
        print(f'PASS format/layout: {layout}/SKILL.md', flush=True)
print('Format/layout only; no host discovery or model execution.')
PY
```

Captured output:

```text
Skill is valid!
PASS format/layout: home/.claude/skills/upgrade-check/SKILL.md
Skill is valid!
PASS format/layout: home/.codex/skills/upgrade-check/SKILL.md
Skill is valid!
PASS format/layout: project/.claude/skills/upgrade-check/SKILL.md
Format/layout only; no host discovery or model execution.
```

Negative control (exit 0): repair the defect **only in a disposable copy** and
assert that the harness rejects the unexpected pass with exit 1. This checks that
the expected broken outcome is asserted rather than merely printed.

```sh
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const copy = mkdtempSync(join(tmpdir(), 'upgrade-check-control-'));
try {
  cpSync('fixture', join(copy, 'fixture'), { recursive: true });
  mkdirSync(join(copy, 'evaluation'));
  cpSync('evaluation/run.mjs', join(copy, 'evaluation/run.mjs'));
  const file = join(copy, 'fixture/broken.mjs');
  const source = readFileSync(file, 'utf8');
  assert(source.includes('const converted = day || 1;'));
  writeFileSync(file, source.replace('const converted = day || 1;', 'const converted = day ?? 1;'));
  const result = spawnSync(process.execPath, [join(copy, 'evaluation/run.mjs')], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /broken\/upgrade: unexpected upgrade outcome/);
  console.log('CONTROL PASS: repairing only the disposable broken candidate makes the harness exit 1.');
  console.log(result.stderr.split('\n').find(line => line.startsWith('AssertionError')));
} finally {
  rmSync(copy, { recursive: true, force: true });
}
JS
```

Captured output:

```text
CONTROL PASS: repairing only the disposable broken candidate makes the harness exit 1.
AssertionError [ERR_ASSERTION]: broken/upgrade: unexpected upgrade outcome
```

## Boundary-value sweep

The first harness version seeded only Sunday. A peer review found that this made
the defect look detected only because the author chose the one falsy value; a
Tuesday-only seed let `broken.mjs` pass. `SKILL.md` now requires enumerating the
transformed field's value domain and saving each boundary value separately, and
the harness now upgrades all seven week-start values from independent baseline
states.

Captured output (exit 0):

```text
BOUNDARY good/sunday: expected=sunday observed=sunday
BOUNDARY broken/sunday: expected=monday observed=monday
BOUNDARY good/monday: expected=monday observed=monday
BOUNDARY broken/monday: expected=monday observed=monday
BOUNDARY good/tuesday: expected=tuesday observed=tuesday
BOUNDARY broken/tuesday: expected=tuesday observed=tuesday
BOUNDARY good/wednesday: expected=wednesday observed=wednesday
BOUNDARY broken/wednesday: expected=wednesday observed=wednesday
BOUNDARY good/thursday: expected=thursday observed=thursday
BOUNDARY broken/thursday: expected=thursday observed=thursday
BOUNDARY good/friday: expected=friday observed=friday
BOUNDARY broken/friday: expected=friday observed=friday
BOUNDARY good/saturday: expected=saturday observed=saturday
BOUNDARY broken/saturday: expected=saturday observed=saturday
BOUNDARY SWEEP PASS: all seven values checked separately; broken loses only Sunday, good preserves all.
```

Every row asserts the exact notebook and note records and their relationship,
the counts, the preference meaning and the displayed week order, not just the
one preference. The unmodified deprecated `day || 1` defect is still
the only difference between the candidates.

## Agent-following pilot

Four comparable runs were made in separate disposable fixture directories: Claude
Code and Codex CLI, each with and without the installed skill. The task asked
whether the two v2 candidates work for an existing user with saved data and did
not mention the planted defect. All four exercised a real baseline-to-candidate
path, passed the good build, and found the Sunday-to-Monday change. No false
findings appeared; two runs did not cover every weekday. The skill-guided reports
followed the report template and retained pristine baseline databases and command
logs. This is a four-run demonstration, not an accuracy rate.

Exact prompt, discovery observations, and the four captured reports are in
[agent-runs/](agent-runs/). Codex required an isolated `CODEX_HOME` because the
normal home exceeded its skills context budget and dropped all skill descriptions.

## Review-driven revision

A real review loop ran through Ousel using this repository. Claude Code ran the
harness and wrote a finding: the skill did not require testing boundary values of
a transformed field, and a Tuesday-only seed would pass the broken build. Codex
independently reproduced the result (all seven weekdays; only Sunday corrupted)
and returned `needs-fixes`. `SKILL.md` then gained a required value-domain sweep,
and the harness gained the seven-value boundary loop above. Codex re-reviewed,
caught one overclaim in this file about record assertions, and approved after the
assertions were added. The two review artifacts are in
[agent-runs/real-review-findings.md](agent-runs/real-review-findings.md) and
[agent-runs/real-review-verification.md](agent-runs/real-review-verification.md). The final approval was a reported verdict, not a
captured command result, and the viewer showed that gap.

## Untested and limitations

This is deterministic evaluation of a tiny application and the upgrade procedure,
plus a four-run agent-following pilot. It is not a benchmark. Skill auto-selection
was not recorded for Claude Code, and the Codex default-home discovery failure
shows that skill availability can depend on host context limits. The shared-format
validation does not prove host loading.

Only the reported macOS/Node/SQLite combination was executed. Linux, Windows,
Node 24/25, and other agent hosts are assumed compatible, not tested. No production
data, private user data, credentials, external services, or runtime network were
used. The harness does not evaluate attachments, large datasets, multiple writers,
crash/power-loss recovery, interrupted migrations, arbitrary schema versions,
other preference values, or rollback/downgrade compatibility. It does not prove
that the baseline executable can read schema 2 or that restoring a snapshot does so.

All fixture source files, the harness, the skill, and documentation were manually
inspected. The fixture checks a selected setting and related behaviors; passing
this example cannot establish that an unrelated application's upgrade is safe.
