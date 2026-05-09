// One-time OAuth setup for Google Calendar (read-only).
// Run from web/: `npx tsx scripts/auth-setup-calendar.ts`
//
// Reads GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET from
// repo-root .env. Spins up a local server on port 53683 (different from
// the Tasks setup so they don't conflict), opens the browser, captures
// the auth code, exchanges for a refresh token, prints it for the user
// to paste into .env as GOOGLE_CALENDAR_REFRESH_TOKEN.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { URL } from "node:url";
import { google } from "googleapis";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const PORT = 53683;
const PATH = "/oauth/callback";
const REDIRECT_URI = `http://localhost:${PORT}${PATH}`;

function loadDotenv() {
  // Walk up from cwd to find the repo-root .env.
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      const text = readFileSync(candidate, "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim();
        if (process.env[key] === undefined) process.env[key] = val;
      }
      return;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) return;
    dir = parent;
  }
}

function openInBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function waitForCode(): Promise<string> {
  return new Promise((resolveCode, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname !== PATH) {
        res.statusCode = 404;
        res.end("not found");
        return;
      }
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (error) {
        res.statusCode = 400;
        res.end(`OAuth error: ${error}. You can close this tab.`);
        server.close();
        reject(new Error(error));
        return;
      }
      if (!code) {
        res.statusCode = 400;
        res.end("Missing `code` query param.");
        return;
      }
      res.statusCode = 200;
      res.setHeader("content-type", "text/html");
      res.end(
        "<h2>Authorized — you can close this tab.</h2><p>The CLI will print your refresh token.</p>",
      );
      server.close();
      resolveCode(code);
    });
    server.listen(PORT);
    server.on("error", reject);
  });
}

async function main() {
  loadDotenv();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "Missing GOOGLE_OAUTH_CLIENT_ID and/or GOOGLE_OAUTH_CLIENT_SECRET in .env.",
    );
    process.exit(1);
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const url = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [CALENDAR_SCOPE],
  });

  console.log("");
  console.log("Opening browser to authorize Google Calendar (read-only)...");
  console.log("If it doesn't open, paste this URL manually:");
  console.log("");
  console.log(url);
  console.log("");

  openInBrowser(url);
  const code = await waitForCode();
  const { tokens } = await oauth.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      "No refresh_token returned. You may need to revoke previous access at https://myaccount.google.com/permissions and re-run.",
    );
    process.exit(1);
  }

  console.log("");
  console.log("✅ Auth complete.");
  console.log("");
  console.log("Add this line to your repo-root .env:");
  console.log("");
  console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error("auth-setup-calendar failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
