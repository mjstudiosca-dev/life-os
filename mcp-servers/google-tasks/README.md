# Google Tasks MCP server

Exposes Google Tasks read/write to Claude Code (and, when hosted, to the
morning-brief Cloud Routine).

## Tools

| Tool | What it does |
|------|--------------|
| `list_pending_tasks` | List incomplete tasks. Optional `due_before` filter. |
| `create_task`        | Create a task with title, optional notes, optional due date. |
| `complete_task`      | Mark a task as completed. |

## One-time setup

You'll need a Google Cloud OAuth 2.0 Client ID (Desktop app type). The
`life-os-495006` project already has one — its credentials are in the
repo-root `.env`.

The redirect URI on the OAuth client must include
`http://localhost:53682/oauth/callback`. Add it in
[Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
if it isn't there already.

Then, from the repo root:

```bash
cd mcp-servers/google-tasks
npm install
npm run auth-setup
```

Your browser will open to Google's consent screen. After you approve, the
CLI prints a `refresh_token`. Paste it into the **repo-root** `.env`:

```
GOOGLE_TASKS_REFRESH_TOKEN=<the token from the script>
```

## Running locally

```bash
npm start       # starts the MCP server on stdio
```

Claude Code finds it via the project's `.mcp.json` (or your local
`~/.claude/mcp.json`). Add this entry:

```json
{
  "mcpServers": {
    "google-tasks": {
      "command": "npm",
      "args": ["start", "--silent"],
      "cwd": "/absolute/path/to/life-os/mcp-servers/google-tasks"
    }
  }
}
```

## Hosting (later, optional)

To make this server reachable from the Cloud Routine (so the Tasks section
of the brief works in cloud runs, not just local), wrap it in an HTTP/SSE
transport and deploy to Cloudflare Workers / Vercel / Railway. The
business logic in `src/tools.ts` is transport-agnostic.

## Environment variables

Reads from process.env:

- `GOOGLE_OAUTH_CLIENT_ID` (required)
- `GOOGLE_OAUTH_CLIENT_SECRET` (required)
- `GOOGLE_TASKS_REFRESH_TOKEN` (required after auth-setup; not needed for `auth-setup` itself)

These live in the repo-root `.env`, which is gitignored. The MCP server
reads `process.env`, so as long as the launcher (Claude Code, npm scripts)
inherits them, everything works.
