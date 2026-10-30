# v2 candidate validation (upgrade from notebook 1.0.0)

Method: for each of the 7 week-start days, I created a database with the baseline (`fixture/baseline.mjs`): 1 notebook, 2 notes (one with Unicode and emoji) and `set-week-start DAY`. I captured `read` and `week`, then opened the same file with the candidate and compared the results. After that I ran writes on the upgraded database (`edit-note`, `add-note`, `add-notebook`, `set-week-start`) and an `edit-note` on an unknown ID. All data is under `work/data/`, and the script is `work/check.sh`. Node v26.8.1. I did not modify the fixture files.

## good.mjs: PASS

- The upgrade to schema 2 kept notebooks, notes and the week-start day for **all 7 days**. `read` (ignoring the schema number) and `week` matched the baseline exactly.
- Writes after the upgrade worked, and the upgrade did not re-run on later startups. An unknown note ID gave `Unknown note: nope`.
- Fresh install: `init` → schema 2, default Monday. `set-week-start sunday` worked. `PRAGMA integrity_check` and `foreign_key_check` both reported ok.

## broken.mjs: FAIL

- **A user whose week starts on Sunday has it silently changed to Monday.** Before: `weekStartsOn: "sunday"`, `week` starting with sunday. After: `weekStartsOn: "monday"`, `week` starting with monday. The setting is permanently rewritten in the database, and the user gets no error.
- Cause: `const converted = day || 1;` treats Sunday's index 0 as missing. `good.mjs` uses `day ?? 1`. That is the only difference between the two files.
- The other 6 days, notes, notebooks, writes after the upgrade and fresh install all behaved like `good.mjs`.

## Applies to both / not tested

- **No downgrade path:** once a v2 candidate has opened a database, 1.0.0 refuses it (`Baseline cannot open schema 2`). Users can't roll back without a backup. This is expected given the design, but release notes should say so.
- Both upgrades keep only the `week_start` preference. Baseline has no command that creates other preference keys, so I could not test whether they would be lost.
- Not tested: two processes using the database at the same time during the upgrade, a crash or kill partway through the upgrade (the code runs it in one `BEGIN IMMEDIATE` transaction, so it should roll back), large databases, databases created by earlier 1.x builds, other Node/SQLite versions.
