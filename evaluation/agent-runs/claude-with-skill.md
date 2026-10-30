# Upgrade check: notebook 1.0.0 → 2.0.0 candidates

| Candidate | Result |
|---|---|
| `fixture/good.mjs` (notebook/2.0.0-good) | **PASS** |
| `fixture/broken.mjs` (notebook/2.0.0-broken) | **FAIL**: if the user's week starts on Sunday, the upgrade quietly changes it to Monday |

**Versions:** baseline `notebook/1.0.0` (schema 1); candidates `notebook/2.0.0-good` and `notebook/2.0.0-broken` (both migrate to schema 2). Node v26.8.1, built-in `node:sqlite`.
**SHA-256:** app.mjs `95713bec…2090`, baseline.mjs `1c95b509…827a`, good.mjs `ecab889f…c9804`, broken.mjs `0d3fce38…9804`. The hashes matched before and after the run, so the fixtures were not changed.
**Artifacts:** script `work/run.sh`, full log `work/log.txt`. Untouched baseline databases are in `work/baseline-{sunday,friday}/nb.db`. Each candidate got its own copy: `work/{good,broken}-{sunday,friday}/nb.db`. I left all of these in place.

## Method
1. **Saving state with the baseline:** I used the baseline 1.0.0 CLI for everything (`init`, `add-notebook` ×2, `add-note` ×3, `set-week-start`), then read it back with `read` and `week`. I built two states: week start = **sunday** (stored as index 0 in v2, the edge case) and week start = **friday** (a non-default value). The data included Unicode notebook and note names, a note with quotes and `&`, an empty note body, a body with a newline, and notes spread across two notebooks.
2. **Shutdown:** every CLI command is its own process. It runs `wal_checkpoint(TRUNCATE)` and closes the database cleanly. Afterwards only `nb.db` was on disk (no `-wal` or `-shm` files). I copied that database separately for each candidate.
3. **Candidate run on the copy:** first `read` (this triggers the migration), then `week`, then `edit-note n1`, then `add-note n4`. After that, 3 more separate `read` processes, then `week`, then `set-week-start wednesday` followed by `week`.

**Expected behaviour of the migration (from the code):** schema 2 stores the week start as an integer 0–6 under `week_start_day` instead of a day-name string. Notebooks and notes should come through unchanged. The week start should mean the same day after the upgrade.

## Checks

| Check | Expected | good | broken |
|---|---|---|---|
| Notebooks (nb1 "Work", nb2 "Personal ✓") | unchanged | ✅ | ✅ |
| Notes n1–n3: titles, bodies (quotes, empty, newline, emoji), which notebook | unchanged | ✅ | ✅ |
| Week start, sunday state | `sunday` | ✅ `sunday` | ❌ **`monday`** |
| `week` output, sunday state | sunday…saturday | ✅ | ❌ monday…sunday |
| Week start, friday state | `friday` | ✅ | ✅ |
| `edit-note n1` on an upgraded note | body updated, still there after restart | ✅ | ✅ |
| `add-note n4` into an existing notebook | still there after restart | ✅ | ✅ |
| `set-week-start wednesday` on upgraded data | week starts wednesday | ✅ | ✅ |
| 3 more process starts on upgraded data | schema stays 2, no duplicate rows, nothing reset, preference count stays 1 | ✅ | ✅ (but the wrong Monday value stays) |

**Why broken fails:** `broken.mjs` converts the day name to a number with `const converted = day || 1;`. Sunday's index is `0`, and JavaScript treats `0` as false, so the code swaps in `1` (Monday). `good.mjs` uses `day ?? 1`, which only falls back when the value is actually missing. Nothing about this is documented, there is no error or warning, and it affects every user whose week starts on Sunday.

## Not tested
- **Downgrade / rollback:** after either upgrade, the baseline refuses to open the database (`Baseline cannot open schema 2`, exit 1). So the only rollback path is restoring a backup taken before the upgrade, and I did not test that.
- **The fallback for a missing or invalid stored week-start:** the baseline CLI cannot produce that state, and I did not hand-craft one.
- **Running two processes at once or crashing mid-migration:** the migration runs inside a `BEGIN IMMEDIATE` transaction, but I did not test those cases.
- **The other five week-start values** (I only tested sunday and friday), larger datasets, and other Node versions.
