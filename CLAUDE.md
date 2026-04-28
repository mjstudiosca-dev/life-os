# CLAUDE.md — Working Rules

> Claude Code reads this file at the start of every session. Pair with PROJECT.md (source of truth).

## Read first, every session

1. `PROJECT.md` — full scope, locked decisions, current status
2. `BUILD_LOG.md` — what's been decided during build
3. `BACKLOG.md` — what's parked for later
4. The spec for the current step in `specs/`

## Before writing any code

- Confirm scope with Malachi. State what you understand the goal to be and what's out of scope. Wait for "go."
- If no spec exists for the step you're being asked to build, **stop and ask** for one. Don't improvise.

## While building

- **Ask, don't assume.** Ambiguity → ask. Architectural choices are not yours to make silently.
- **Match existing conventions.** Read related files before creating new ones.
- **Log non-obvious decisions** in `BUILD_LOG.md` (library choice, file layout, naming).
- **Don't scope-creep.** Useful idea for a later step → log in `BACKLOG.md` and stay on current step.
- **Each script reads only what it needs.** Never load full archives into context.

## Safety rules (non-negotiable)

- All write actions to Gmail / Calendar / Tasks gated behind `DRY_RUN` flag, default `true`.
- `DRY_RUN` only flips to `false` after Step 5 ships AND Malachi has reviewed real outputs.
- No silent destructive actions. Always confirm before deletes or overwrites.

## When the step is done

- Run the manual test checklist in `tests/manual-test.md`. All items must pass.
- Update `BUILD_LOG.md` with what was built.
- Update `PROJECT.md` if any locked decisions changed (this should be rare).
- **Stop.** Don't start the next step. Wait for Malachi's "go."

## Red flags — stop and ask

- A change would contradict §2 "Locked Decisions" in PROJECT.md
- The current spec is missing or unclear
- You'd need to install a non-trivial dependency not previously discussed
- You're about to delete or rewrite existing code
- The request contradicts "ship the smallest reliable loop"

## Mid-build new ideas

If Malachi says "also add X":
- In scope for current step → add it.
- Out of scope → log in `BACKLOG.md`, confirm, stay focused.

## Stack quick reference

- TypeScript on Node 20+
- Strict mode on. No `any` without comment.
- JSON config, JSON state, markdown logs.
- Cloud Routines for scheduling (laptop-off compatible).
- MCP connectors for Gmail, Calendar, Drive, Tasks.

---

*The full spec lives in PROJECT.md. This file is the operating rules.*
