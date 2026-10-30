---
name: upgrade-check
description: Test whether existing users' saved data survives an update. Use for upgrades, migrations, schema changes, a new app version, release validation, or questions like "will existing users' data survive?" Insist on running the baseline build to save state, then the candidate against that state; a successful fresh install is not upgrade evidence.
---

# upgrade-check

Answer: **Does this update still work for someone who already has saved data?**
Use filesystem and shell access to exercise the application's real upgrade path.
Keep the check bounded to the requested update and report the evidence collected.

## Procedure

1. **Pin both versions.** Identify the baseline users are upgrading from and the
   candidate being evaluated. Record exact commit refs, release/artifact versions,
   build commands, runtime versions, and any uncommitted changes. Resolve moving
   branch names to immutable refs; hash local artifacts when refs are insufficient.
   If the baseline or another prerequisite is unavailable, mark the affected check
   **not tested**, never passed. Do not substitute a fresh install.
2. **Define what must survive.** Locate persisted stores, configuration, attachments,
   and relationships. Select representative records, settings, and supported actions
   with explicit expected values. Read the documented migration contract: intentional
   schema changes or transformations need semantic expectations, not byte equality.
   An undocumented reset or loss is a defect, even when the app starts successfully.
   For every field the update transforms or re-encodes, enumerate its value domain
   and select boundary values: zero or falsy, empty, the first and last enum member,
   null or absent when the baseline can produce them, and the maximum. If the domain
   is small, cover every value. Record one expected result per value before running
   the candidate.
3. **Isolate everything.** Use separate worktrees/build directories for baseline and
   candidate, and disposable data directories with explicit paths. Redirect the
   app's config, caches, and service endpoints as needed to avoid real user state.
   Use synthetic disposable fixtures only: no production databases, private user
   data, or live credentials. If isolation cannot be established, stop that check
   and report it as not tested. Keep each candidate's starting state independent.
4. **Save state with the baseline.** Run the actual baseline app. Create data through
   its supported UI, CLI, or API, including meaningful edge values such as an
   explicitly disabled setting or a nondefault relationship. Save each selected
   boundary value in its own disposable state, or one state per independent value,
   so a bug in one value cannot hide behind another. Read each state back and
   capture its expected values and behavior. Never create "old-version data" with the
   new version and call it an upgrade test. Do not inject SQL or handwrite old data
   as a replacement for exercising the baseline's supported save path.
5. **Close or safely checkpoint the baseline.** Wait for writes and child processes
   to finish. For SQLite, prefer clean shutdown with a completed checkpoint; if a
   running app must be captured, use its supported consistent backup procedure and
   account for WAL state. Do not assume copying a live `.db` file captures full
   state. Keep a pristine copy of the closed baseline state, including any `-wal`
   and `-shm` files if still present, so each candidate starts from the same
   bytes. Record the shutdown/backup method before handing state to the candidate.
6. **Start the candidate on that state.** Point the real candidate executable at the
   disposable baseline data and follow its real initialization/upgrade procedure,
   including its supported migration command if required. Never replace the real
   app path with a mocked migration. Capture commands, exit codes, and diagnostics.
7. **Check values and behavior.** Read back selected records, relationships, and
   settings through supported interfaces. Compare meaningful expected and observed
   values, allowing only documented transformations. Exercise supported user actions
   on upgraded data, such as editing an existing record or following a relationship,
   and verify the result. Counts and successful startup alone cannot prove survival.
   Classify every difference as an expected, documented transformation or an
   accidental loss; if the contract does not explain it, report it as a defect.
8. **Restart and check again.** Shut down the candidate safely, start a new process
   using the same upgraded data, and repeat the meaningful checks, including any
   edits made in step 7. Confirm state persists beyond one process's memory.
9. **Check repeated normal startup.** Perform at least two fresh process starts
   after the first candidate start, each on that same state. Verify no duplicate
   records, reset settings, or repeated transformations. Do not blindly reapply a
   one-shot migration: exercise the app's normal repeated initialization and its
   migration-version guards.
10. **Report the evidence.** Use the template below; keep it concise, put the
    observations in the checks rather than a narrative, distinguish failures from
    unavailable evidence, and name untested areas explicitly. A pass applies only to
    the versions, state, and behaviors exercised. Restoring a pre-upgrade snapshot
    is not proof that the old executable can read the upgraded schema. Only claim
    downgrade compatibility after a separate old-executable check on a disposable
    copy, if requested and supported. Record cleanup or retained artifact locations.

## Report template

```text
Versions: baseline <exact ref/version>; candidate <exact ref/version + local changes>
Artifacts: build/runtime versions, hashes, workspace/data paths, logs, cleanup
Commands: baseline build/save/read/close; candidate build/start/check/close
State created: synthetic records, relationships, nondefault settings
Value domain: transformed fields, boundary values tried, expected result per value
Migration contract: documented transformations and semantic expectations
Checks: <record/relationship/setting/action> | expected <value> | observed <value> | status
Restarts: commands, number of new processes, checks and observations
Repeated-start check: normal initialization; duplicates/resets/retransformation observed?
Result: PASS / FAIL / NOT TESTED (scope and reason; mark incomplete checks separately)
Untested: unavailable prerequisites, omitted stores/actions/versions, rollback/downgrade
```
