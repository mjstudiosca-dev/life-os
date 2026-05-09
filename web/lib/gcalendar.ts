// Google Calendar API client. Read-only — only used to fetch today's
// events for the brief. Reads OAuth credentials from process.env.

import { google } from "googleapis";

function buildAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN!;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Calendar OAuth env vars missing.");
  }
  // Note: the redirect URI here is only used as an identifier when refreshing.
  // It must match what the OAuth client was registered with for the
  // calendar-only auth-setup script (port 53683).
  const auth = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:53683/oauth/callback",
  );
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

export type CalEvent = {
  id: string;
  title: string;
  start: string | null;        // ISO datetime or null (all-day)
  end: string | null;          // ISO datetime or null
  startDate: string | null;    // YYYY-MM-DD if all-day, else null
  endDate: string | null;
  allDay: boolean;
  durationMinutes: number;     // 0 if can't compute
  tier: 1 | 2 | 3;
  location: string | null;
  description: string | null;
};

const TIER_RE = /\bTier\s*([123])\b/i;

function inferTier(title: string, description: string | null): 1 | 2 | 3 {
  const text = `${title} ${description ?? ""}`;
  const m = text.match(TIER_RE);
  if (m) {
    const n = Number(m[1]);
    if (n === 1 || n === 3) return n;
  }
  return 2; // default
}

export async function listEventsForDay(date: string): Promise<CalEvent[]> {
  const auth = buildAuth();
  const calendar = google.calendar({ version: "v3", auth });

  // Build day window in local time. JS Date constructed from "YYYY-MM-DD"
  // alone is interpreted as UTC midnight; we want local midnight.
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59`);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,        // expand recurring events
    orderBy: "startTime",
    maxResults: 50,
  });

  const items = res.data.items ?? [];
  return items.map((ev): CalEvent => {
    const allDay = !!ev.start?.date && !ev.start?.dateTime;
    const startIso = ev.start?.dateTime ?? null;
    const endIso = ev.end?.dateTime ?? null;
    const startDate = ev.start?.date ?? null;
    const endDate = ev.end?.date ?? null;
    let dur = 0;
    if (startIso && endIso) {
      dur = Math.max(
        0,
        Math.round(
          (new Date(endIso).getTime() - new Date(startIso).getTime()) /
            60000,
        ),
      );
    } else if (allDay) {
      dur = 24 * 60;
    }
    return {
      id: ev.id ?? "",
      title: ev.summary ?? "(untitled)",
      start: startIso,
      end: endIso,
      startDate,
      endDate,
      allDay,
      durationMinutes: dur,
      tier: inferTier(ev.summary ?? "", ev.description ?? null),
      location: ev.location ?? null,
      description: ev.description ?? null,
    };
  });
}

// Format a Date or ISO string as a local time like "9:00am" / "12:30pm".
export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  if (m === 0) return `${h}${ampm}`;
  return `${h}:${m.toString().padStart(2, "0")}${ampm}`;
}
