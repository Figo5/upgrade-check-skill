import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { arch, platform, release, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

assert(Number(process.versions.node.split('.')[0]) >= 24, 'Node >=24 is required');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = mkdtempSync(join(tmpdir(), 'upgrade-check-'));
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const expectedDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const editedBody = 'Revised after upgrade: café, then review.';
const original = {
  schema: 1,
  notebooks: [{ id: 'home', name: 'Home' }, { id: 'work', name: 'Work' }],
  notes: [
    { id: 'n1', notebook_id: 'work', title: 'Release', body: 'Keep the saved preference.' },
    { id: 'n2', notebook_id: 'home', title: "Sunday's café", body: 'Plan\nBring notebook.' },
    { id: 'n3', notebook_id: 'work', title: 'Follow-up', body: '' },
  ],
  preferences: { weekStartsOn: 'sunday' },
  counts: { notebooks: 2, notes: 3, preferences: 1 },
};

function command(app, db, ...args) {
  const relativeApp = app.slice(workspace.length + 1);
  const relativeDb = db.slice(workspace.length + 1);
  console.log(`$ "$NODE" "$RUN_DIR/${relativeApp}" "$RUN_DIR/${relativeDb}" ${args.map(quote).join(' ')}`);
  const result = spawnSync(process.execPath, [app, db, ...args], {
    encoding: 'utf8', timeout: 10000, cwd: dirname(app),
  });
  if (result.stdout) console.log(result.stdout.trimEnd());
  if (result.stderr) console.log(`stderr: ${result.stderr.trimEnd()}`);
  assert.ifError(result.error);
  assert.equal(result.status, 0, `App command failed: ${app} ${args[0]}`);
  // A command's exit is the shutdown boundary. Never copy a live SQLite file.
  const wal = `${db}-wal`;
  assert(!existsSync(wal) || statSync(wal).size === 0, 'Uncheckpointed WAL after shutdown');
  return JSON.parse(result.stdout);
}

function checkPhase(kind, phase, actual, week, expected) {
  for (const key of ['schema', 'counts', 'notebooks', 'notes']) {
    assert.deepEqual(actual[key], expected[key], `${kind}/${phase}: ${key}`);
  }
  const failures = [];
  if (actual.preferences.weekStartsOn !== expected.preferences.weekStartsOn) {
    failures.push('preferences.weekStartsOn');
    console.log(`DETECTED ${kind}/${phase}: preferences.weekStartsOn expected=sunday observed=${actual.preferences.weekStartsOn}`);
  }
  assert.deepEqual(Object.keys(actual.preferences), ['weekStartsOn']);
  if (JSON.stringify(week.days) !== JSON.stringify(expectedDays)) {
    failures.push('week order');
    console.log(`DETECTED ${kind}/${phase}: week order expected=${expectedDays.join(',')} observed=${week.days.join(',')}`);
  }
  assert.deepEqual(failures, kind === 'broken' ? ['preferences.weekStartsOn', 'week order'] : [],
    `${kind}/${phase}: unexpected upgrade outcome`);
  if (kind === 'broken') {
    assert.equal(actual.preferences.weekStartsOn, 'monday');
    assert.deepEqual(week.days, [...expectedDays.slice(1), expectedDays[0]]);
  }
  console.log(`CHECK ${kind}/${phase}: schema=2; counts=2/3/1 unchanged; records, relationships and edit state match; semantic failures=${failures.length}`);
}

try {
  console.log(`Host: ${platform()} ${arch()} ${release()}; Node ${process.version}`);
  const memory = new DatabaseSync(':memory:');
  console.log(`SQLite: ${memory.prepare('SELECT sqlite_version() AS version').get().version}`);
  memory.close();
  for (const file of ['fixture/app.mjs', 'fixture/baseline.mjs', 'fixture/good.mjs',
    'fixture/broken.mjs', 'evaluation/run.mjs']) {
    console.log(`SHA256 ${file} ${createHash('sha256').update(readFileSync(join(root, file))).digest('hex')}`);
  }
  console.log(`export NODE=${quote(process.execPath)}`);
  console.log(`export RUN_DIR=${quote(workspace)}`);
  const baselineDir = join(workspace, 'baseline');
  mkdirSync(baselineDir);
  for (const name of ['app.mjs', 'baseline.mjs']) {
    copyFileSync(join(root, 'fixture', name), join(baselineDir, name));
  }
  const baseline = join(baselineDir, 'baseline.mjs');

  for (const kind of ['good', 'broken']) {
    const candidateDir = join(workspace, kind, 'app');
    mkdirSync(candidateDir, { recursive: true });
    for (const name of ['app.mjs', `${kind}.mjs`]) {
      copyFileSync(join(root, 'fixture', name), join(candidateDir, name));
    }
    const candidate = join(candidateDir, `${kind}.mjs`);
    const db = join(workspace, kind, 'data', 'notebook.sqlite');
    for (const [app, version] of [[baseline, 'notebook/1.0.0'], [candidate, `notebook/2.0.0-${kind}`]]) {
      const result = spawnSync(process.execPath, [app, '--version'], { encoding: 'utf8', timeout: 10000 });
      assert.ifError(result.error);
      assert.equal(result.status, 0);
      assert.equal(result.stdout.trim(), version);
      console.log(`VERSION ${app.slice(workspace.length + 1)} --version => ${version}`);
    }
    command(baseline, db, 'init');
    for (const notebook of original.notebooks) command(baseline, db, 'add-notebook', notebook.id, notebook.name);
    for (const note of original.notes) command(baseline, db, 'add-note', note.id, note.notebook_id, note.title, note.body);
    command(baseline, db, 'set-week-start', 'sunday');
    assert.deepEqual(command(baseline, db, 'read'), original, 'Baseline must actually save the expected state');
    assert.deepEqual(command(baseline, db, 'week'), { days: expectedDays });
    console.log(`BASELINE ${kind}: saved through normal interface; all processes exited; WAL absent or empty`);

    const expected = structuredClone(original);
    expected.schema = 2; // Documented transformation: names -> indices; meaning must survive.
    assert.deepEqual(command(candidate, db, 'init'), { schema: 2 });
    checkPhase(kind, 'upgrade', command(candidate, db, 'read'), command(candidate, db, 'week'), expected);
    command(candidate, db, 'edit-note', 'n2', editedBody);
    expected.notes[1].body = editedBody;
    let previous;
    for (const phase of ['restart-1', 'restart-2']) {
      assert.deepEqual(command(candidate, db, 'init'), { schema: 2 });
      const actual = command(candidate, db, 'read');
      checkPhase(kind, phase, actual, command(candidate, db, 'week'), expected);
      if (previous) assert.deepEqual(actual, previous, 'Repeated startup must not change stored meaning');
      previous = actual;
    }
    console.log(`RESULT ${kind}: ${kind === 'good' ? 'PASS' : 'FAIL (expected setting loss detected)'}; two explicit restarts stable; edit persisted`);
  }
  // Boundary sweep: every value of the transformed preference, each in its
  // own baseline state. This is the check the skill now requires; without it
  // a Tuesday-only seed would let the Sunday defect pass.
  for (const day of expectedDays) {
    for (const kind of ['good', 'broken']) {
      const db = join(workspace, `boundary-${kind}-${day}`, 'data', 'notebook.sqlite');
      command(baseline, db, 'init');
      command(baseline, db, 'add-notebook', 'home', 'Home');
      command(baseline, db, 'add-note', 'n1', 'home', 'One', 'body');
      command(baseline, db, 'set-week-start', day);
      const candidate = join(workspace, kind, 'app', `${kind}.mjs`);
      command(candidate, db, 'init');
      const read = command(candidate, db, 'read');
      const week = command(candidate, db, 'week');
      const expectedDay = kind === 'broken' && day === 'sunday' ? 'monday' : day;
      const observed = read.preferences.weekStartsOn;
      console.log(`BOUNDARY ${kind}/${day}: expected=${expectedDay} observed=${observed}`);
      assert.equal(observed, expectedDay, `${kind} boundary ${day}`);
      assert.deepEqual(read.notebooks, [{ id: 'home', name: 'Home' }]);
      assert.deepEqual(read.notes, [
        { id: 'n1', notebook_id: 'home', title: 'One', body: 'body' },
      ]);
      assert.deepEqual(read.counts, { notebooks: 1, notes: 1, preferences: 1 });
      const shift = expectedDays.indexOf(expectedDay);
      assert.deepEqual(week.days, [...expectedDays.slice(shift), ...expectedDays.slice(0, shift)]);
    }
  }
  console.log('BOUNDARY SWEEP PASS: all seven values checked separately; broken loses only Sunday, good preserves all.');
  console.log('HARNESS PASS: good upgrade passes; broken upgrade detected by setting value and week behavior despite unchanged counts.');
} finally {
  rmSync(workspace, { recursive: true, force: true });
  console.log('CLEANUP: disposable workspaces and databases removed.');
}
