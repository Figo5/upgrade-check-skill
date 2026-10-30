# Explicit skill invocation

Tested on 2026-10-30 on macOS 27.0.1, Node 26.8.1. These runs used the skill's
documented explicit names rather than relying on automatic selection.

## Claude Code

Host: Claude Code 2.1.311, model `claude-sonnet-5-5`.

```sh
claude -p --dangerously-skip-permissions --model sonnet \
  "/upgrade-check Use the skill explicitly: ..."
```

The same task as the automatic pilot was used: baseline `fixture/baseline.mjs`,
candidates `good.mjs` and `broken.mjs`, disposable data only. Claude ran the real
1.0.0 baseline for all seven week-start values plus the untouched default,
upgraded copies with each candidate, restarted, and wrote `REPORT.md`.

Result: `good.mjs` pass; `broken.mjs` fail on Sunday→Monday. Full report:
[claude-explicit-report.md](claude-explicit-report.md).

No discovery problem: `/upgrade-check` expanded and the procedure was followed.

## Codex CLI

Host: Codex CLI 0.155.1, model `gpt-6-astra`.

With an isolated home containing only this skill:

```sh
CODEX_HOME=/tmp/upgrade-check-codex-home \
  codex exec -m gpt-6-astra -s workspace-write -C <workdir> \
  '$upgrade-check Use the skill explicitly: ...'
```

Result: `good.mjs` pass; `broken.mjs` fail on Sunday→Monday. Full report:
[codex-explicit-report.md](codex-explicit-report.md).

## Discovery problem and tested workaround

Under the normal `~/.codex` home, Codex reported that the skills context budget
was exceeded, removed all skill descriptions, and a direct "is upgrade-check
available?" probe answered `NONE`. `$upgrade-check` therefore had no skill to
expand. Pointing `CODEX_HOME` at a directory containing only `skills/upgrade-check`
(and auth/config) made Codex discover the skill, and the explicit `$upgrade-check`
run above succeeded. This is a host context-limit problem, not a malformed
SKILL.md. It is the documented workaround for Codex users with large skill
collections. Claude Code did not need it.

Both reports were produced by the invoked skill; neither run was given the
planted defect or told which value to seed.
