// Loads an authenticated googleapis OAuth2 client using a stored refresh
// token. Called by both the MCP server (server.ts) and the auth-setup CLI
// (scripts/auth-setup.ts).
//
// Environment variables required:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_TASKS_REFRESH_TOKEN  (produced by scripts/auth-setup.ts)
//
// `.env` from the repo root is auto-loaded on first call to readAuthEnv()
// so the same code works in three contexts:
//   - The auth-setup CLI (run from mcp-servers/google-tasks/)
//   - The MCP server launched by Claude Code (cwd may vary)
//   - The Cloud Routine (env should be set externally; loader is a no-op)

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
export const REDIRECT_URI = "http://localhost:53682/oauth/callback";

export type AuthEnv = {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
};

let dotenvLoaded = false;

function loadDotenvOnce(): void {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  // Walk up from cwd looking for .env. Stop at filesystem root or after
  // 6 levels — whichever comes first.
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      try {
        const text = readFileSync(candidate, "utf8");
        for (const rawLine of text.split(/\r?\n/)) {
          const line = rawLine.trim();
          if (!line || line.startsWith("#")) continue;
          const eq = line.indexOf("=");
          if (eq < 0) continue;
          const key = line.slice(0, eq).trim();
          const val = line.slice(eq + 1).trim();
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      } catch {
        // Couldn't read — silently fall through; user-facing error in
        // readAuthEnv will still surface clearly.
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return; // hit root
    dir = parent;
  }
}

export function readAuthEnv(): AuthEnv {
  loadDotenvOnce();
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID and/or GOOGLE_OAUTH_CLIENT_SECRET. " +
        "Add them to the repo-root .env file (gitignored).",
    );
  }
  return {
    clientId,
    clientSecret,
    refreshToken: process.env["GOOGLE_TASKS_REFRESH_TOKEN"],
  };
}

export function makeOAuth2Client(env: AuthEnv): OAuth2Client {
  return new google.auth.OAuth2(env.clientId, env.clientSecret, REDIRECT_URI);
}

export function getAuthorizedClient(): OAuth2Client {
  const env = readAuthEnv();
  if (!env.refreshToken) {
    throw new Error(
      "Missing GOOGLE_TASKS_REFRESH_TOKEN. Run `npm run auth-setup` from mcp-servers/google-tasks to get one.",
    );
  }
  const client = makeOAuth2Client(env);
  client.setCredentials({ refresh_token: env.refreshToken });
  return client;
}
