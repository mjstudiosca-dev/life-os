// One-time OAuth setup for Google Tasks.
//
// Steps:
// 1. Reads GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET from env.
// 2. Spins up a localhost HTTP server on port 53682 (matches REDIRECT_URI).
// 3. Opens the user's default browser to Google's auth screen.
// 4. After the user approves, captures the auth code from the redirect.
// 5. Exchanges the code for a refresh token.
// 6. Prints the refresh token. The user pastes it into repo-root .env as
//    GOOGLE_TASKS_REFRESH_TOKEN.
//
// Run: npm run auth-setup

import { createServer } from "node:http";
import { exec } from "node:child_process";
import { URL } from "node:url";
import { TASKS_SCOPE, REDIRECT_URI, makeOAuth2Client, readAuthEnv } from "../src/auth.js";

const PORT = 53682;
const PATH = "/oauth/callback";

async function main(): Promise<void> {
  const env = readAuthEnv();
  const oauth = makeOAuth2Client(env);

  const authUrl = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even on re-auth
    scope: [TASKS_SCOPE],
  });

  console.log("");
  console.log("Opening your browser to authorize Google Tasks access...");
  console.log("If it doesn't open, paste this URL manually:");
  console.log("");
  console.log(authUrl);
  console.log("");

  openInBrowser(authUrl);

  const code = await waitForCode();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "No refresh_token returned by Google. This usually means you've already authorized this OAuth client.",
    );
    console.error(
      "Revoke access at https://myaccount.google.com/permissions then re-run this script.",
    );
    process.exit(1);
  }

  console.log("");
  console.log("✅ Auth complete.");
  console.log("");
  console.log("Add this line to your repo-root .env (NOT this subproject's .env):");
  console.log("");
  console.log(`GOOGLE_TASKS_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("");
  console.log("Then you can run capture.ts and the MCP server.");
  process.exit(0);
}

function openInBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      // Non-fatal — we already printed the URL for manual paste.
    }
  });
}

function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
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
      resolve(code);
    });
    server.listen(PORT, () => {
      // listening
    });
    server.on("error", reject);
  });
}

main().catch((err) => {
  console.error("auth-setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
