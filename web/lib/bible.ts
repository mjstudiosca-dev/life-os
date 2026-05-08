// Bible reading math. Ported from scripts/prep.ts.

export function daysInMonth(year: number, month: number): number {
  // month is 1-based
  return new Date(year, month, 0).getDate();
}

export function proverbsReading(dayOfMonth: number): string {
  return `Proverbs ${dayOfMonth}`;
}

export function psalmsReading(
  dayOfMonth: number,
  year: number,
  month: number,
): string {
  // Distribute 150 Psalms proportionally across the days of the month.
  const total = 150;
  const days = daysInMonth(year, month);
  const start = Math.floor(((dayOfMonth - 1) / days) * total) + 1;
  const end = Math.floor((dayOfMonth / days) * total);
  return start === end ? `Psalm ${start}` : `Psalms ${start}–${end}`;
}

// Returns chapters left AFTER today's reading (0 = today is the last).
export function chaptersRemaining(
  currentPosition: string | null,
  endPosition: string | null,
): number | null {
  if (!currentPosition || !endPosition) return null;
  const parse = (s: string): number | null => {
    const m = s.match(/(\d+)\s*$/);
    return m ? parseInt(m[1]!, 10) : null;
  };
  const c = parse(currentPosition);
  const e = parse(endPosition);
  if (c === null || e === null) return null;
  return e - c;
}
