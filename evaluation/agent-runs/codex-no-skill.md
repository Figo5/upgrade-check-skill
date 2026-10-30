# Existing-user upgrade validation

| Candidate | Verdict | Evidence |
| --- | --- | --- |
| `fixture/good.mjs` | **PASS** | All seven saved week-start choices survive the schema 1 → 2 upgrade and produce the correct `week` ordering. All 56 grouped checks passed. |
| `fixture/broken.mjs` | **FAIL** | A baseline database saved with `sunday` silently becomes `monday` on first candidate startup. `week` changes from Sunday–Saturday to Monday–Sunday; reopening retains the incorrect preference. The other six choices pass. 54/56 grouped checks passed. |

Created seven databases using only the baseline CLI, each with two notebooks and three notes, including Unicode, quotes, multiline and empty bodies, and a pre-upgrade edit. After clean shutdown, each database was copied separately for each candidate. Compared every notebook/note field, relationships, counts, saved preference and week ordering against the baseline.

Both candidates preserve notebook/note data, migrate to schema 2, reopen consistently, persist edits and new notebooks/notes, and support all seven preference changes after upgrade. SQLite integrity and foreign-key checks pass. Fresh-install initialization/read smoke tests also pass for both, so fresh-install success alone misses the regression.

The failure is explained by `const converted = day || 1` in `broken.mjs`: Sunday's index is `0`, so it is replaced with Monday's `1`. The good build uses `day ?? 1`, preserving zero.

Validation ran on Node v26.8.1 with 466 CLI invocations. Fixture SHA-256 hashes were unchanged. Disposable databases and [detailed results](validation/data-mx4lbB/results.json) are under `validation/`; rerun with `node validation/run.mjs`.

Not tested: crash/power-loss recovery, concurrent access, disk/permission failures, corrupt or externally modified databases, large datasets, downgrade compatibility, or other Node/OS environments. Verdicts cover clean upgrades of valid baseline-created data.
