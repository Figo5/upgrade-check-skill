import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const schemaVersion = db => db.prepare('PRAGMA user_version').get().user_version;

export function initializeBaseline(db) {
  const schema = schemaVersion(db);
  if (schema === 1) return;
  if (schema !== 0) throw new Error(`Baseline cannot open schema ${schema}`);
  db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE notebooks (id TEXT PRIMARY KEY, name TEXT NOT NULL) STRICT;
    CREATE TABLE notes (
      id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL REFERENCES notebooks(id),
      title TEXT NOT NULL, body TEXT NOT NULL
    ) STRICT;
    CREATE TABLE preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
    INSERT INTO preferences VALUES ('week_start', 'monday');
    PRAGMA user_version = 1;
    COMMIT;
  `);
}

function weekStart(db) {
  const v1 = schemaVersion(db) === 1;
  const key = v1 ? 'week_start' : 'week_start_day';
  const { value } = db.prepare('SELECT value FROM preferences WHERE key = ?').get(key);
  return v1 ? value : days[value];
}

function snapshot(db) {
  const notebooks = db.prepare('SELECT id, name FROM notebooks ORDER BY id').all();
  const notes = db.prepare('SELECT id, notebook_id, title, body FROM notes ORDER BY id').all();
  return {
    schema: schemaVersion(db), notebooks, notes,
    preferences: { weekStartsOn: weekStart(db) },
    counts: { notebooks: notebooks.length, notes: notes.length,
      preferences: db.prepare('SELECT count(*) AS n FROM preferences').get().n },
  };
}

function dispatch(db, command, args) {
  const arities = { init: 0, read: 0, week: 0, 'add-notebook': 2,
    'add-note': 4, 'set-week-start': 1, 'edit-note': 2 };
  if (!(command in arities) || args.length !== arities[command]) {
    throw new Error('Commands: init | read | week | add-notebook ID NAME | '
      + 'add-note ID NOTEBOOK TITLE BODY | set-week-start DAY | edit-note ID BODY');
  }
  switch (command) {
    case 'init': return { schema: schemaVersion(db) };
    case 'read': return snapshot(db);
    case 'week': {
      const start = days.indexOf(weekStart(db));
      return { days: [...days.slice(start), ...days.slice(0, start)] };
    }
    case 'add-notebook':
      db.prepare('INSERT INTO notebooks VALUES (?, ?)').run(...args);
      break;
    case 'add-note':
      db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?)').run(...args);
      break;
    case 'set-week-start': {
      const index = days.indexOf(args[0]);
      if (index < 0) throw new Error('DAY must be a lowercase English day name');
      const v1 = schemaVersion(db) === 1;
      db.prepare('UPDATE preferences SET value = ? WHERE key = ?')
        .run(v1 ? args[0] : index, v1 ? 'week_start' : 'week_start_day');
      break;
    }
    case 'edit-note': {
      const { changes } = db.prepare('UPDATE notes SET body = ? WHERE id = ?').run(args[1], args[0]);
      if (changes !== 1) throw new Error(`Unknown note: ${args[0]}`);
      break;
    }
  }
  return { ok: command };
}

// Every command is a normal app startup and a clean, synchronous shutdown.
export function run(version, initialize) {
  try {
    const [file, command, ...args] = process.argv.slice(2);
    if (file === '--version') { console.log(version); return; }
    if (!file || !command) throw new Error('Usage: node fixture/<version>.mjs DATABASE COMMAND [ARGS]');
    mkdirSync(dirname(resolve(file)), { recursive: true });
    const db = new DatabaseSync(file);
    let output;
    try {
      db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      initialize(db);
      output = dispatch(db, command, args);
    } finally {
      try {
        if (db.isTransaction) db.exec('ROLLBACK');
        const { busy } = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
        if (busy !== 0) throw new Error('Checkpoint blocked by another connection');
      } finally { db.close(); }
    }
    console.log(JSON.stringify(output));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
