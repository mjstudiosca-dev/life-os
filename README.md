# Life OS

A personal operating system that sends a daily morning brief at 6am and an evening recap at 8pm.

## What it does

**Morning brief** — pulls from Google Calendar (today's schedule), Gmail (priority emails), a rotating idea from a Google Doc brain dump, a Bible reading assignment, and a prayer prompt. Delivered as a structured digest.

**Evening recap** — light check-in on the day: did you train, hit protein, make progress on commitments? Updates state for the next morning.

## Integrations

- Google Calendar — today's events and tier-1 anchors
- Gmail — flagged or unread priority threads
- Google Drive — idea brain doc (Google Doc)
- Bible reading plan — Proverbs, Psalms, Gospels (Mark), Isaiah

## Stack

- TypeScript (Node 20+), strict mode
- Config and state stored as JSON files in this repo
- MCP connectors for Google integrations
- Runs as a Cloud Routine in Claude Code (laptop-off compatible)

## Safety

All write actions (sending email, creating calendar events, updating tasks) are gated behind a `DRY_RUN` flag, default `true`. No writes execute unless explicitly enabled in `.env`.

## Project structure

```
config/       Human-editable settings and personal data
state/        Machine-updated progress tracking
scripts/      Runnable TypeScript scripts (populated in Steps 2-5)
connectors/   MCP connector wrappers (populated in Step 2)
tests/        Manual test checklists per build step
BUILD_LOG.md  Running log of implementation decisions
```

## Build steps

| Step | Scope |
|------|-------|
| 1 | Foundation — config, state, project setup (current) |
| 2 | Connectors — wire Gmail and Calendar via MCP |
| 3 | Morning brief — compose and deliver |
| 4 | Evening recap — compose and deliver |
| 5 | Scheduling — Cloud Routine, laptop-off automation |
