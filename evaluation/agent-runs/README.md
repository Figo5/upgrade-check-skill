# Agent-following observations

These are four small pilot runs, not a general accuracy rate. Each run received
the same task in a separate disposable directory containing only the fixture
files. No run was told that a defect was planted or where it was.

## Task given to every run

> You are validating candidate releases of a small notebook app. The installed
> baseline release is `fixture/baseline.mjs` (notebook 1.0.0). Two candidate v2
> builds are `fixture/good.mjs` and `fixture/broken.mjs`. All share
> `fixture/app.mjs`. The app is a CLI: `node <entry> <database-path> <command>
> [args]`, with commands `init`, `read`, `week`, `add-notebook ID NAME`,
> `add-note ID NOTEBOOK TITLE BODY`, `set-week-start DAY`, `edit-note ID BODY`.
> Decide whether each v2 candidate works for an existing user who already has
> saved data. Use disposable data under this working directory only. Do not
> modify the fixture files. Write a concise `REPORT.md` here: for each candidate,
> pass or fail, the evidence, and anything you could not test.

## Runs

| Run | Host/model | Skill available | Real old→new path | Good passed | Broken detected | False findings |
| --- | --- | --- | --- | --- | --- | --- |
| `claude-no-skill.md` | Claude Code 2.1.311, claude-opus-5-5 | no (`--disable-slash-commands`) | yes — 7 baseline states, candidate opened copies | yes | yes (Sunday→Monday) | none observed |
| `claude-with-skill.md` | Claude Code 2.1.311, claude-opus-5-5 | yes; `upgrade-check` in session command list | yes — Sunday and Friday baseline states, candidate copies | yes | yes (Sunday→Monday) | none observed |
| `codex-no-skill.md` | Codex CLI 0.155.1, gpt-6-astra | no | yes — 7 baseline states, 466 CLI calls | yes | yes (Sunday→Monday) | none observed |
| `codex-with-skill.md` | Codex CLI 0.155.1, gpt-6-astra | yes, via isolated `CODEX_HOME` | yes — 7 baseline states, 224 CLI calls, pristine baseline copies | yes | yes (Sunday→Monday) | none observed |

Both hosts solved this fixture without the skill, so these runs do **not** show an
accuracy improvement. The visible differences were report structure and retained
evidence: the skill-guided runs followed the template (versions, migration
contract, restarts, repeated-start check, untested) and kept pristine baseline
databases and command logs. The skill-guided Claude run tested two representative
settings instead of all seven; the unguided Claude run tested all seven.

## Discovery findings

- Claude Code listed `upgrade-check` in its session skill/command list after the
  documented install; `--disable-slash-commands` removed it. No explicit `Skill`
  tool call appeared in the captured JSON, so loading is inferred from that list
  and the report shape, not from a recorded invocation.
- Codex CLI did **not** see the skill under the normal `~/.codex` home: the host
  warned that the skills context budget was exceeded and dropped all descriptions,
  and a direct "is upgrade-check available?" prompt answered `NONE`. With
  `CODEX_HOME` pointed at a temporary home containing only this skill (auth
  symlinked), Codex reported `upgrade-check`, and the task run used it. This is a
  real discovery limitation of an oversubscribed skill directory, not a SKILL.md
  defect.

## Limits

- One fixture, one task wording, one run per condition.
- Both models are strong and the fixture names the baseline and candidates.
- No run used unavailable baseline artifacts, live databases, concurrency, or
  interruption.
- Only macOS 27.0.1 and Node 26.8.1 were used.
