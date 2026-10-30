# FINDINGS: upgrade-check skill review

Reviewed 2026-10-30 in `/private/tmp/review-upgrade-check`. No other file was modified.

## Verdict

**The planted defect is detected. The skill's core claim holds: a fresh install is not evidence.**
It does make an agent run the real baseline, save state, open the candidate on it, restart, and report evidence.

**The skill is not shown to be better than no skill.** It also does not teach the one habit that would catch this class of bug on a different fixture (see below).

## Commands and observed evidence

1. `node evaluation/run.mjs` exited 0 (Node v26.8.1, SQLite 3.53.4).
   - `good`: `RESULT good: PASS; two explicit restarts stable; edit persisted`, with schema 2, counts 2/3/1 unchanged, and `weekStartsOn: sunday`.
   - `broken`: `DETECTED broken/upgrade: preferences.weekStartsOn expected=sunday observed=monday`.
   - `broken`: `DETECTED ... week order expected=sunday,monday,... observed=monday,...,sunday`.
   - `broken` counts were identical to `good` (2/3/1), so a counts-only check would have passed it.
   - `broken` also reported `semantic failures=2` at restart-1 and restart-2, so the defect persists across restarts.
2. `diff fixture/good.mjs fixture/broken.mjs`: the only logic difference is `day ?? 1` versus `day || 1` (Sunday = 0 falls through to Monday).
3. `shasum -a 256 fixture/*.mjs evaluation/run.mjs` matches every hash recorded in `evaluation/results.md`, so the recorded results describe the files as they are now.
4. Extra probe, which is not in the harness. I saved each weekday with the baseline, then upgraded with `broken.mjs`:

   ```text
   sunday   -> broken reads: week starts monday   (WRONG)
   monday   -> broken reads: week starts monday
   tuesday  -> broken reads: week starts tuesday
   saturday -> broken reads: week starts saturday
   ```

   Only the single value `0` is corrupted.
5. `evaluation/agent-runs/README.md` has four pilot runs, two with the skill and two without. All four caught the defect, so the pilot shows no detection benefit from the skill. The README says as much.

## Single most important improvement

**Add a required step to `SKILL.md` step 2 or 4: for every field the migration transforms or re-encodes, enumerate its value domain and save each boundary value through the baseline, with a separate disposable state per value.**

Boundary values include zero, the first and last enum member, empty string, null or absent, and the maximum.
Each value needs its own expected result.

Why this matters:

- The defect is a falsy-zero bug that corrupts exactly one value out of seven. The harness catches it only because the author chose Sunday as the seeded value.
- `SKILL.md` today only says to include "meaningful edge values such as an explicitly disabled setting or a nondefault relationship". That does not name the zero, falsy or boundary case and does not require sweeping the domain.
- The skill-guided Claude run tested only two settings (Sunday and Friday) of seven, so it caught the bug partly by luck. The unguided run tested all seven. On this evidence the skill is neutral or worse on coverage, even though it helps with report structure and retained evidence.
- An agent that follows the skill literally with a typical value such as Tuesday or the default Monday would write a clean PASS report that is wrong. That is the honest-evidence failure the skill exists to prevent.

## Secondary observations (not the main fix)

- `fixture/baseline.mjs`, `good.mjs` and `broken.mjs` all share `fixture/app.mjs` for read and write code. The README admits that a reader-only regression would go undetected.
- Repeated-start duplication is untested because the fixture's guard is trivial. The README admits this.
- Exit 0 from the harness means "good passed and broken was detected", not that the skill works. The README states this clearly.
