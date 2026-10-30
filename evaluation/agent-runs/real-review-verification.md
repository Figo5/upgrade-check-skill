# Independent verification

Verdict: **needs-fixes**. I agree with the central finding: steps 2/4 do not require systematic coverage of the values a migration transforms, and a Tuesday-only test misses the demonstrated Sunday defect.

Verified on 2026-10-30 from `/tmp/review-upgrade-check`. No changes were made to SKILL.md, README.md, fixture/, evaluation/, or FINDINGS.md. Tests used the existing Node entry points; no build step is required. Artifact hashes and runtime are below.

## Evaluation rerun

Exact execution command (exit 0):

```sh
mkdir -p /tmp/review-upgrade-check-probe && node evaluation/run.mjs > /tmp/review-upgrade-check-probe/evaluation.log 2>&1; result=$?; cat /tmp/review-upgrade-check-probe/evaluation.log; exit $result
```

Observed output, filtered to runtime, artifact identity, checks, and results:

```text
Host: darwin arm64 27.0.0; Node v26.8.1
SQLite: 3.53.4
SHA256 fixture/app.mjs 95713bec38899d0a85115b7a799a091c6240d3181daa4218abb8728ff2d82090
SHA256 fixture/baseline.mjs 1c95b509d4a6e302c3c3d925a89705bc26495a9395f112a8d68a96e80d7f827a
SHA256 fixture/good.mjs ecab889ff1169617949f8716691919bf725493fa708d905248173f6312eb2e3a
SHA256 fixture/broken.mjs 0d3fce385f4c98a7e57cc939adea0ac6e13c427b31820152aea1d541683c9804
SHA256 evaluation/run.mjs 417d3ad1a9002cb10091044bd5b7861e4a479bbf5f58ee1a9f2c18d4885cfb36
CHECK good/upgrade: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=0
CHECK good/restart-1: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=0
CHECK good/restart-2: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=0
RESULT good: PASS; two explicit restarts stable; edit persisted
DETECTED broken/upgrade: preferences.weekStartsOn expected=sunday observed=monday
DETECTED broken/upgrade: week order expected=sunday,monday,tuesday,wednesday,thursday,friday,saturday observed=monday,tuesday,wednesday,thursday,friday,saturday,sunday
CHECK broken/upgrade: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=2
DETECTED broken/restart-1: preferences.weekStartsOn expected=sunday observed=monday
DETECTED broken/restart-1: week order expected=sunday,monday,tuesday,wednesday,thursday,friday,saturday observed=monday,tuesday,wednesday,thursday,friday,saturday,sunday
CHECK broken/restart-1: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=2
DETECTED broken/restart-2: preferences.weekStartsOn expected=sunday observed=monday
DETECTED broken/restart-2: week order expected=sunday,monday,tuesday,wednesday,thursday,friday,saturday observed=monday,tuesday,wednesday,thursday,friday,saturday,sunday
CHECK broken/restart-2: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=2
RESULT broken: FAIL (expected setting loss detected); two explicit restarts stable; edit persisted
HARNESS PASS: good upgrade passes; broken upgrade detected by setting value and week behavior despite unchanged counts.
CLEANUP: disposable workspaces and databases removed.
```

The good build passed. The broken build failed both Sunday preference preservation and week ordering at upgrade and both explicit restarts. Counts remained 2 notebooks / 3 notes / 1 preference throughout; records, relationships, and edits matched. Harness exit 0 means these expected outcomes were confirmed, not that the broken build passed. The harness removed its databases.

## Independent seven-value probe and Tuesday-only check

Created one baseline database per supported weekday via the real baseline CLI. Each contains a notebook, related note, and saved setting. Read back the baseline preference and week order, waited for each command to exit, verified absent/empty WAL, then copied the closed database to a candidate database. Pristine baseline copies remain available. No SQL injection or handwritten baseline state was used.

The following is the exact disposable probe script saved as `/tmp/review-upgrade-check-probe/probe.mjs`:

```js
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
const root = '/tmp/review-upgrade-check';
const dir = mkdtempSync('/tmp/review-upgrade-check-probe/state-');
const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const transcript = [];
function run(build, db, ...args) {
  const argv = [`${root}/fixture/${build}.mjs`, db, ...args];
  const r = spawnSync(process.execPath, argv, {encoding:'utf8'});
  transcript.push(JSON.stringify({command:[process.execPath,...argv],status:r.status,stdout:r.stdout,stderr:r.stderr}));
  assert.ifError(r.error); assert.equal(r.status,0);
  assert(!existsSync(db+'-wal') || statSync(db+'-wal').size===0);
  return JSON.parse(r.stdout);
}
for (const [index, day] of days.entries()) {
  const baseline = `${dir}/${day}-baseline.sqlite`;
  const db = `${dir}/${day}-broken.sqlite`;
  run('baseline',baseline,'init');
  run('baseline',baseline,'add-notebook','work','Work');
  run('baseline',baseline,'add-note','n1','work','Title','Original');
  run('baseline',baseline,'set-week-start',day);
  const expected = run('baseline',baseline,'read');
  const week = run('baseline',baseline,'week');
  assert.equal(expected.preferences.weekStartsOn,day);
  assert.deepEqual(week.days,[...days.slice(index),...days.slice(0,index)]);
  copyFileSync(baseline,db);
  run('broken',db,'init');
  const actual = run('broken',db,'read');
  const actualWeek = run('broken',db,'week');
  assert.equal(actual.schema,2);
  for (const key of ['counts','notebooks','notes']) assert.deepEqual(actual[key],expected[key]);
  const settingPass = actual.preferences.weekStartsOn===day;
  const weekPass = JSON.stringify(actualWeek)===JSON.stringify(week);
  assert.equal(settingPass,index!==0); assert.equal(weekPass,index!==0);
  console.log(`${day} (${index}) -> ${actual.preferences.weekStartsOn}; setting=${settingPass?'PASS':'FAIL'}; week=${weekPass?'PASS':'FAIL'}; counts=1/1/1 unchanged`);
  if(day==='tuesday') {
    expected.schema=2;
    assert.deepEqual(actual,expected); assert.deepEqual(actualWeek,week);
    run('broken',db,'edit-note','n1','Edited Tuesday');
    expected.notes[0].body='Edited Tuesday';
    for(let n=1;n<=2;n++) {
      run('broken',db,'init');
      assert.deepEqual(run('broken',db,'read'),expected);
      assert.deepEqual(run('broken',db,'week'),week);
      console.log(`TUESDAY-ONLY restart-${n}: PASS; edit persisted; setting and week order preserved; counts unchanged`);
    }
    console.log('TUESDAY-ONLY RESULT: PASS on broken build (Sunday defect missed)');
  }
}
writeFileSync('/tmp/review-upgrade-check-probe/commands.jsonl',transcript.join('\n')+'\n');
console.log(`Retained pristine baseline and upgraded databases: ${dir}`);

```

Exact execution command (exit 0):

```sh
node /tmp/review-upgrade-check-probe/probe.mjs > /tmp/review-upgrade-check-probe/probe.log 2>&1; result=$?; cat /tmp/review-upgrade-check-probe/probe.log; exit $result
```

Observed output:

```text
sunday (0) -> monday; setting=FAIL; week=FAIL; counts=1/1/1 unchanged
monday (1) -> monday; setting=PASS; week=PASS; counts=1/1/1 unchanged
tuesday (2) -> tuesday; setting=PASS; week=PASS; counts=1/1/1 unchanged
TUESDAY-ONLY restart-1: PASS; edit persisted; setting and week order preserved; counts unchanged
TUESDAY-ONLY restart-2: PASS; edit persisted; setting and week order preserved; counts unchanged
TUESDAY-ONLY RESULT: PASS on broken build (Sunday defect missed)
wednesday (3) -> wednesday; setting=PASS; week=PASS; counts=1/1/1 unchanged
thursday (4) -> thursday; setting=PASS; week=PASS; counts=1/1/1 unchanged
friday (5) -> friday; setting=PASS; week=PASS; counts=1/1/1 unchanged
saturday (6) -> saturday; setting=PASS; week=PASS; counts=1/1/1 unchanged
Retained pristine baseline and upgraded databases: /tmp/review-upgrade-check-probe/state-t2THon

```

All subprocess argument arrays, exit statuses, stdout, and stderr are retained in `/tmp/review-upgrade-check-probe/commands.jsonl`. The script and both output logs are retained in that directory as disposable evidence.

Only Sunday (mapped index 0) is corrupted within the complete supported seven-day domain. For Tuesday, the entire snapshot matches after allowing the documented schema change, the week order matches, an existing note can be edited, and two explicit fresh-process restarts preserve everything. Thus a Tuesday-only semantic check passes this broken build, even with checks beyond counts and startup.

Code inspection explains the result: broken.mjs uses `const converted = day || 1`; good.mjs uses `day ?? 1`. Sunday maps to zero and triggers the truthiness fallback; indices 1 through 6 do not.

## Steps 2/4 and judgment

Step 2 selects “representative records, settings, and supported actions” with semantic expectations. Step 4 asks for “meaningful edge values such as an explicitly disabled setting or a nondefault relationship”. Neither requires identifying the transformed field's supported domain or selecting its zero/first/last cases explicitly. A nondefault Tuesday and the empty-body record used in the harness can satisfy representative/edge examples without exercising this particular zero case.

The requested improvement is warranted: require identifying each transformed field's supported domain and encoding, saving supported boundary values through the baseline into independent disposable states, and recording each expected semantic outcome. For this small enum, all seven values are inexpensive to exercise; at minimum Sunday/0 must be selected deliberately. This evidence directly demonstrates the coverage gap, not a general accuracy improvement from changing the skill.

Qualifications / disagreement:

- Step 10 already says a pass applies only to the versions, state, and behaviors exercised. A scoped Tuesday-only PASS is correct for Tuesday; a claim that the entire build is safe would be unsupported. The finding overstates this as necessarily a wrong PASS report from literal skill compliance.
- Interpret “enumerate the value domain” as identifying allowed values or constraints, not exhaustively listing an unbounded domain. Empty string, null, absent, and maximum cases apply only where supported by the baseline contract; this CLI accepts only the seven lowercase weekday names. Do not bypass the baseline save path to fabricate unsupported cases.
- The reviewer's displayed probe lists only four weekdays. This independent probe tests all seven and confirms its only-Sunday conclusion.
- The pilot README reports all four runs detected the bug and narrower coverage in one skill-guided run. That supports “no demonstrated detection benefit”; it does not establish that the skill causes worse coverage or that choosing Sunday was luck. I did not rerun those historical agent experiments.

## Ousel reporting

Used the user-supplied helper, which explicitly constructs events with `source: "reported"`. These reports are claims, not automatic check evidence.

Initial command:

```sh
node /Users/giofiore/work/ousel/skills/ousel/scripts/report.mjs --actor codex --action task_start --session ousel-real --project upgrade-check --task upgrade-check-review --status running --summary "Independently validating FINDINGS.md with evaluation and all-weekday upgrade probes; source reported." --url http://127.0.0.1:4330
```

Observed: `Ousel report not delivered; continuing work.` (helper exit 0). Review and completion attempts and outcomes are recorded below after this file is created.

After VERIFICATION.md existed, executed:

```sh
node /Users/giofiore/work/ousel/skills/ousel/scripts/report.mjs --actor codex --action review --session ousel-real --project upgrade-check --task upgrade-check-review --status ok --verdict needs-fixes --summary "Independent rerun: good passes; broken loses Sunday and week order with unchanged counts. Seven-day probe corrupts only Sunday; Tuesday-only checks pass. Agree boundary coverage gap; VERIFICATION.md records evidence. Source reported." --url http://127.0.0.1:4330
node /Users/giofiore/work/ousel/skills/ousel/scripts/report.mjs --actor codex --action completion --session ousel-real --project upgrade-check --task upgrade-check-review --status ok --summary "VERIFICATION.md exists with exact commands, observed output, needs-fixes verdict, and qualifications. Evaluation and seven-day/Tuesday-only probes completed. Source reported." --url http://127.0.0.1:4330
```

Both attempts returned `Ousel report not delivered; continuing work.` The helper returns 0 even on failed delivery; no successful Ousel delivery is claimed. Completion was attempted only after this file existed.
