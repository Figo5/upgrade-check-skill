# Existing-user upgrade report

**Result: `good.mjs` PASS; `broken.mjs` FAIL.** The broken candidate changes a saved Sunday week start to Monday. Both preserve the tested notebooks, notes, relationships, and subsequent edits.

## Versions and artifacts

- Baseline: `notebook/1.0.0`; candidates: `notebook/2.0.0-good` and `notebook/2.0.0-broken`.
- Runtime: Node.js `v26.8.1` with built-in `node:sqlite`. Build: none; the supplied JavaScript modules run directly.
- No Git repository is present, so commit refs and a Git change diff are unavailable. Exact original artifacts are pinned by SHA-256 below; hashes were checked again after testing and fixture files were unchanged.
- Workspace: `/private/tmp/uc-explicit-codex`. Separate executable copies: `upgrade-check-artifacts/builds/{baseline,good,broken}/`, each with its own identical `app.mjs`.
- All synthetic data and logs are retained under `upgrade-check-artifacts/`; no data outside this workspace was used. The application accesses only the explicitly supplied SQLite file and its SQLite sidecars; no external services or separate configuration/cache stores are present. No cleanup was performed.

| Artifact | SHA-256 |
|---|---|
| `fixture/app.mjs` | `95713bec38899d0a85115b7a799a091c6240d3181daa4218abb8728ff2d82090` |
| `fixture/baseline.mjs` | `1c95b509d4a6e302c3c3d925a89705bc26495a9395f112a8d68a96e80d7f827a` |
| `fixture/broken.mjs` | `0d3fce385f4c98a7e57cc939adea0ac6e13c427b31820152aea1d541683c9804` |
| `fixture/good.mjs` | `ecab889ff1169617949f8716691919bf725493fa708d905248173f6312eb2e3a` |

## State, value domain, and migration expectations

- Seven independently saved baseline databases, one per allowed day. Each contains `home` → `Home` and `work` → `Work — café`; note `empty` belongs to `home` with empty title/body, and `travel` belongs to `work` with title `Trip 日本語` and body `Line one\nLine two: "quoted" ☕` (actual newline).
- No standalone migration documentation was supplied. The source defines schema 1 as text preference `week_start` and schema 2 as integer `week_start_day` constrained to 0–6. The semantic expectation is that the chosen day and week ordering survive; notes and notebooks are not transformed. This expectation was recorded before either candidate ran in `expected-before-upgrade.json`.
- The complete supported setting domain is seven lowercase English day names. Sunday covers zero/falsy and the first enum member; Saturday covers the maximum/last member. Empty, null, missing, and out-of-range settings cannot be saved through the baseline CLI (initialization supplies Monday, setter accepts only these seven names, and there is no delete command). Those corrupt/unsupported states were not injected.

| Saved baseline value | Expected schema-2 encoding | Expected read/week first day | Good observed | Broken observed |
|---|---:|---|---|---|
| sunday | 0 | sunday | sunday | monday — FAIL |
| monday | 1 | monday | monday | monday |
| tuesday | 2 | tuesday | tuesday | tuesday |
| wednesday | 3 | wednesday | wednesday | wednesday |
| thursday | 4 | thursday | thursday | thursday |
| friday | 5 | friday | friday | friday |
| saturday | 6 | saturday | saturday | saturday |

The numeric encodings above describe the source contract; runtime assertions use supported `read` and `week` interfaces and schema version, not direct SQL inspection. Week checks compare all seven positions, not just the first day.

## Commands and shutdown

Every CLI invocation, exact argument (including Unicode/newlines), exit code, stdout, and stderr is recorded in [commands.json](upgrade-check-artifacts/commands.json). All application commands exited 0; no stderr diagnostics were emitted. [checks.json](upgrade-check-artifacts/checks.json) contains full expected/observed values for each assertion.

The following sequence was executed for each day `DAY`; `BASE` is its separate baseline executable and `DB` its absolute database path. Arguments shown with `\n` contain actual newlines in the command log.

```text
node BASE DB init
node BASE DB add-notebook home Home
node BASE DB add-notebook work "Work — café"
node BASE DB add-note empty home "" ""
node BASE DB add-note travel work "Trip 日本語" 'Line one\nLine two: "quoted" ☕'
node BASE DB set-week-start DAY
node BASE DB read
node BASE DB week
```

Each command ran synchronously in a new process and exited before the next action. The real app performs `wal_checkpoint(TRUNCATE)`, requires a nonbusy checkpoint, and closes the database before printing success. After baseline shutdown, the entire state directory was copied to `pristine/DAY/`, then independently to each candidate directory. All files were copied (including any sidecars); the retained pristine states contain only `notebook.db`. Initial candidate copies were verified byte-identical to pristine. Pristine file hashes were rechecked after all tests; see [baseline-backups.json](upgrade-check-artifacts/baseline-backups.json).

For each candidate/day pair, `CANDIDATE` is its separate executable and `DB` its independent copy:

```text
node CANDIDATE DB init             # first real migration/start
node CANDIDATE DB read
node CANDIDATE DB week
node CANDIDATE DB edit-note travel "Edited after upgrade\nPersist this: café 日本語 ☕"
node CANDIDATE DB init             # explicit restart 1
node CANDIDATE DB read
node CANDIDATE DB week
node CANDIDATE DB init             # explicit restart 2
node CANDIDATE DB read
node CANDIDATE DB week
```

No custom migration or SQL writes were used. The exact harness is retained at [check.py](upgrade-check-artifacts/check.py). Version commands were `node <isolated-entry> --version`; runtime command was `node --version`.

## Checks (expected / observed)

| Check | Expected | Good observed | Broken observed |
|---|---|---|---|
| Baseline save/read, all days | Schema 1; exact records, relationships, selected day, full week order | PASS prerequisite: all 7 states verified | Same pristine states |
| First initialization | Schema 2, exit 0 | 7/7 PASS | 7/7 PASS |
| Names, titles, bodies, Unicode, newlines, empty strings | Exact baseline strings | PASS on all 7 states | PASS on all 7 states |
| Relationships | `empty → home`; `travel → work` | PASS on all 7 states | PASS on all 7 states |
| Setting and complete week order | Selected day retained; seven days rotated accordingly | 7/7 PASS at all 3 readback phases | Sunday becomes Monday at all 3 phases: FAIL; other 6 PASS |
| Edit upgraded existing note | Exact edited body on `travel`; other fields retained | PASS after both restarts, all days | PASS after both restarts, all days |
| Counts on every read | 2 notebooks, 2 notes, 1 preference | PASS | PASS |
| Repeated normal initialization | Schema stays 2; no duplicates, resets, repeated transformation | PASS | No additional change, but Sunday loss persists: FAIL for preservation |

## Restarts and repeated-start check

Per candidate/day, 10 separate CLI processes ran: first `init`, followed by 9 fresh starts on the same data. Two explicit `init → read → week` cycles ran after editing. Every invocation uses the real normal startup and schema-version guard. Exact records, counts, relationships, setting, and full week order were compared after both cycles. No duplicate records or additional transformations appeared. The broken candidate’s Sunday-to-Monday reset persists across restart; it is not an in-memory display issue.

## Verdicts and limitations

- **notebook/2.0.0-good: PASS** — 147/147 assertions passed. All seven existing-user states retain their semantics, and edits persist across repeated starts. The `day ?? 1` conversion preserves Sunday’s zero index. Pass is limited to these artifacts and exercised state/actions.
- **notebook/2.0.0-broken: FAIL** — 141/147 assertions passed. Saved Sunday is converted to Monday: `day || 1` treats index 0 as absent. Six failed assertions cover the setting and full week ordering at initial readback and both restart cycles. This is accidental preference loss, with no documented justification.

- **Untested:** downgrade/rollback compatibility, crashes or interrupted migration recovery, concurrent access/checkpoint contention, large databases/performance, corrupt or unsupported schemas/settings, fresh installations, other releases/runtimes/platforms, creating new records or changing the setting after upgrade. Attachments and external stores are not implemented in this fixture. No unavailable prerequisite affected the executed upgrade checks. A restored baseline snapshot is not evidence of downgrade compatibility.
