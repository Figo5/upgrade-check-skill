# Upgrade check: notebook 1.0.0 → 2.0.0-good / 2.0.0-broken

## Verdicts
- **2.0.0-good: PASS** for the exercised scope (all 8 week-start states).
- **2.0.0-broken: FAIL.** A user whose week starts on **sunday** is silently changed to **monday**. The app starts, the schema is v2, and every other value survives. This is a loss of a saved setting.

## Versions
- Baseline: `fixture/baseline.mjs`, reports `notebook/1.0.0` (schema `user_version=1`).
- Candidates: `fixture/good.mjs` (`notebook/2.0.0-good`) and `fixture/broken.mjs` (`notebook/2.0.0-broken`). Both use `fixture/app.mjs`, schema v2.
- No git repo, so there are no commit refs. SHA-256 of the files, identical before and after the run (fixtures were not modified):
  - app.mjs `95713bec…2d82090`
  - baseline.mjs `1c95b509…f827a`
  - good.mjs `ecab889f…2e3a`
  - broken.mjs `0d3fce38…9804`
- Runtime: node v26.8.1, built-in `node:sqlite`. There is no build step.
- Paths: all data is under `/private/tmp/uc-explicit-claude/work/`. `pristine/` holds the closed baseline states. `good/` and `broken/` hold the candidate copies. `log.txt` has every command with its exit code. `run.sh` is the harness.
- Cleanup: nothing deleted. `work/` is kept as evidence.

## Commands
`node fixture/<entry> <db> <cmd>` in every case.
- **Baseline, per state:**
  1. `init`
  2. `add-notebook nb1 "Work <d>"`
  3. `add-note n1 nb1 "Title <d>" "Body <d>"`
  4. `set-week-start <d>`
  5. `read` and `week`
- **Candidate, per state:** copy the pristine db, then `read`, `week`, `edit-note n1 "Edited <d>"`, `read` ×3, `week`, `set-week-start wednesday`, `week`.
- **Baseline close:** every command is a full process with a clean shutdown. The app runs `wal_checkpoint(TRUNCATE)` and closes the db. No `-wal` or `-shm` files were left in `pristine/`. The `.db` files were copied only after the baseline had closed.
- **Exit codes:** every command exited 0 (log.txt contains no non-zero exits).

## State created (baseline 1.0.0, supported CLI only)
- Each state has 1 notebook `nb1` and 1 note `n1` referencing `nb1`, with distinct titles and bodies per state.
- Week start (`preferences.week_start`, text) is set to each of the 7 day names, one independent db each.
- An 8th state, `default`, never calls `set-week-start`. This is the baseline's built-in `monday`.
- Each baseline `read` and `week` output matched the value set. For example, sunday gave `["sunday","monday",…]` and saturday gave `["saturday","sunday",…]`.

## Value domain and migration contract
- **Transformed field:** `preferences.week_start` (TEXT day name, v1) becomes `preferences.week_start_day` (INTEGER 0–6, sunday=0, v2). The key is renamed, the table is recreated STRICT with a CHECK, and the old table is dropped.
- **Values covered:** all 7 members (first = sunday/0, last = saturday/6) plus the default-untouched state. The domain is small, so every value was tried.
- **Expected result per value:** the same day name read back through `read` and `week`. There is no documented contract allowing any change, so any difference is a defect.
- **Not applicable:** a null or absent week_start. Baseline `init` always inserts it, and the value is NOT NULL.
- **Untouched data:** notebooks, notes, the relationship and the counts must be unchanged.

## Checks
All 8 states were checked for each candidate. The note and notebook columns match the baseline and survived in every row. The expected value is the baseline value; the observed column is the candidate's first start.

| State | Expected `weekStartsOn` | good first start | broken first start | good | broken |
|---|---|---|---|---|---|
| default | monday | monday | monday | PASS | PASS |
| sunday (0) | sunday | sunday | **monday** | PASS | **FAIL** |
| monday | monday | monday | monday | PASS | PASS |
| tuesday | tuesday | tuesday | tuesday | PASS | PASS |
| wednesday | wednesday | wednesday | wednesday | PASS | PASS |
| thursday | thursday | thursday | thursday | PASS | PASS |
| friday | friday | friday | friday | PASS | PASS |
| saturday (6) | saturday | saturday | saturday | PASS | PASS |

Other checks, identical for every state and both candidates:
- **Schema:** `schema` read 2 after first start.
- **Notebook and note:** `nb1` and `n1` (title and body) are unchanged and `n1` still references `nb1`.
- **Counts:** notebooks 1, notes 1, preferences 1.
- **`week` ordering:** matches the week start observed in `read`. For broken-sunday the week starts on monday, which is wrong.
- **Action on upgraded data:** `edit-note n1` returned ok, and `read` then showed `Edited <d>`. PASS for both.
- **Action on upgraded data:** `set-week-start wednesday` then `week` began on wednesday. PASS for both.

Root cause of the failure, at `fixture/broken.mjs:11`: `day || 1` treats `sunday` (index 0) as falsy and falls back to monday. `good.mjs` uses `day ?? 1`, which falls back only when the value is absent.

## Restarts
- 3 new processes per state per candidate (`read` ×3) after the first start and the edit.
- Observed: the edited note body and the week start were identical on every restart. For broken-sunday, the wrong value `monday` persisted. Preferences count was 1.

## Repeated-start check
- The same 3 normal starts, plus the `week` and `set-week-start` commands, ran on the same upgraded db. The migration guard (`user_version === 2` returns early) prevented re-migration.
- No duplicate records and no reset settings were observed. The preference count stayed at 1.
- The one-shot migration was not re-applied manually.

## Untested
- **Downgrade:** not tested. This covers running 1.0.0 on a v2 db and restoring a snapshot.
- **Data volume:** only 1 notebook and 1 note per state. No large dbs, no empty-notebook or multi-note cases, no unicode or very long text.
- **Other baseline `week_start` values:** none were tried. The app only accepts the 7 lowercase day names, and a hand-edited value was out of scope.
- **Crash or kill mid-migration:** not tested (transaction atomicity was not exercised).
- **Concurrency:** no concurrent processes.
- **Other platforms and node versions:** not tested.
- **Data in the old `preferences` table:** only `week_start` was exercised, since it is the only key the baseline writes.
