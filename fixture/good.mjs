import { days, initializeBaseline, run, schemaVersion } from './app.mjs';

run('notebook/2.0.0-good', db => {
  if (schemaVersion(db) === 0) initializeBaseline(db);
  if (schemaVersion(db) === 2) return;
  if (schemaVersion(db) !== 1) throw new Error('Unsupported schema');
  db.exec('BEGIN IMMEDIATE');
  const old = db.prepare("SELECT value FROM preferences WHERE key = 'week_start'").get();
  const day = Object.fromEntries(days.map((name, index) => [name, index]))[old?.value];
  const converted = day ?? 1;
  db.exec(`
    ALTER TABLE preferences RENAME TO preferences_v1;
    CREATE TABLE preferences (
      key TEXT PRIMARY KEY, value INTEGER NOT NULL CHECK(value BETWEEN 0 AND 6)
    ) STRICT;
  `);
  db.prepare("INSERT INTO preferences VALUES ('week_start_day', ?)").run(converted);
  db.exec('DROP TABLE preferences_v1; PRAGMA user_version = 2; COMMIT;');
});
