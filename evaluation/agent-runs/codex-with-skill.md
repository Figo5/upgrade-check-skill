> Note: links to `upgrade-check-artifacts/` or `validation/` below are original
> disposable workspace paths, not files published in this repository. The full
> harness evidence is in [../results.md](../results.md).

# Existing-user upgrade validation

| Candidate | Result | Evidence |
|---|---|---|
| `fixture/good.mjs` — notebook/2.0.0-good | **PASS** for tested scope | All seven baseline week-start settings survived migration to schema 2; `week` returned the expected ordering. Notebook and note IDs, names, titles, bodies, and relationships matched exactly. Editing an existing note persisted across subsequent processes and initialization. |
| `fixture/broken.mjs` — notebook/2.0.0-broken | **FAIL** | A baseline user with `weekStartsOn: "sunday"` received `"monday"` after upgrade; `week` likewise started on Monday instead of Sunday. The incorrect setting persisted through repeated initialization and edits. The other six settings, saved records, relationships, and note edits survived. |

Baseline: `fixture/baseline.mjs`, notebook/1.0.0 (schema 1). Runtime: Node v26.8.1; these are directly executed local artifacts, with no build step. No Git repository was available. SHA-256 identities for all four fixture files are recorded in [results.json](upgrade-check-artifacts/results.json); hashes were unchanged after testing.

Each of seven databases was created through the **actual baseline CLI**, with two notebooks and two notes linked to different notebooks, Unicode names/body text, a multiline body, an empty body, and one of the seven supported week-start settings. Baseline `read` and `week` outputs were checked against explicit expectations. Every command completed synchronously; the app checkpoints WAL with `wal_checkpoint(TRUNCATE)` and closes SQLite before exit. Each candidate received an independent copy of the closed baseline database, including sidecars if present. Initial database hashes matched, and pristine baseline databases remained unchanged.

The migration implemented in source replaces the string preference `week_start` with integer `week_start_day` (Sunday=0 through Saturday=6), and advances schema 1 to 2. Semantic day selection must survive; no separate migration documentation was supplied. The broken candidate uses `day || 1`, replacing valid Sunday index 0 with Monday index 1. The good candidate uses `day ?? 1`.

Commands used: `node fixture/<build>.mjs <database> <command> [args]`. Baseline sequence: `init`, `add-notebook` ×2, `add-note` ×2, `set-week-start`, `read`, `week`. Each candidate ran `init`, `read`, `week`, two additional `init`/`read` pairs, `edit-note n1`, `read`, `init`, `read`, `week`. Each command was a fresh process. Repeated starts caused no duplicates or further transformations; counts stayed at two notebooks, two notes, and one preference. The broken candidate's Sunday reset remained. All **224 commands exited 0**, demonstrating why exit status alone is insufficient.

Evidence retained under [upgrade-check-artifacts](upgrade-check-artifacts/): pristine baseline databases, upgraded candidate databases, [test harness](upgrade-check-artifacts/check.mjs), [command arguments, exit codes, stdout and stderr](upgrade-check-artifacts/commands.json), and [expected/observed check results](upgrade-check-artifacts/results.json). All test data is disposable and confined to this working directory; fixture files were not modified.

Untested for both candidates: post-upgrade creation of notebooks/notes and changing preferences, empty/large/corrupt databases, interrupted or concurrent migrations, other runtime/platform versions, and downgrade compatibility. No prerequisite blocked the checks reported above; PASS is limited to the exercised saved state and behavior.
