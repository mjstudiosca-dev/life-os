// Stub for Google Calendar writes. Logs the structured payload that the real
// MCP-backed implementation will receive when it ships in Step 4. The interface
// here is locked so capture.ts does not need to change when the stub is replaced.

export type CalendarEventInput = {
  title: string;
  date: string;             // ISO date "2026-04-28" — start date for recurring events
  time: string | null;      // 24-hour "09:00" or null for all-day
  durationMinutes: number;
  timezone: string;         // IANA tz, e.g. "America/Los_Angeles"
  tier: 1 | 2 | 3;
  recurrence: string | null; // RRULE string e.g. "RRULE:FREQ=WEEKLY;BYDAY=SU" or null for one-off
};

export async function createCalendarEvent(input: CalendarEventInput): Promise<void> {
  console.log("[STUB] connectors/calendar.ts → createCalendarEvent would be called with:");
  console.log(JSON.stringify(input, null, 2));
}
