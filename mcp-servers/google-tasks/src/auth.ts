// Loads an authenticated googleapis OAuth2 client using a stored refresh
// token. Called by both the MCP server (server.ts) and the auth-setup CLI
// (scripts/auth-setup.ts).
//
// Environment variables required:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_TASKS_REFRESH_TOKEN  (produced by scripts/auth-setup.ts)

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
export const REDIRECT_URI = "http://localhost:53682/oauth/callback";

export type AuthEnv = {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
};

export function readAuthEnv(): AuthEnv {
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID and/or GOOGLE_OAUTH_CLIENT_SECRET in environment.",
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
