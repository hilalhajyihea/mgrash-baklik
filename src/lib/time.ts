/** All booking wall-clock times are Asia/Jerusalem (Israel). */

export const TIMEZONE = "Asia/Jerusalem";

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function dayName(dayOfWeek: number) {
  return DAY_NAMES[dayOfWeek] ?? String(dayOfWeek);
}

export function parseTimeToMinutes(time: string): number {
  if (time === "24:00") return 24 * 60;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * End time 00:00 (or 24:00) after a later start means midnight at the end of the day,
 * not 00:00 at the beginning.
 */
export function parseWindowEndMinutes(startTime: string, endTime: string): number {
  if (endTime === "24:00") return 24 * 60;
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (endTime === "00:00" && start > 0) return 24 * 60;
  return end;
}

export function isValidHourWindow(startTime: string, endTime: string): boolean {
  return parseTimeToMinutes(startTime) < parseWindowEndMinutes(startTime, endTime);
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Display a booking slot start as "18:00–19:30" for the given length. */
export function formatSlotRange(startTime: string, slotMinutes: number): string {
  const end = minutesToTime(parseTimeToMinutes(startTime) + slotMinutes);
  return `${startTime}–${end}`;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone = TIMEZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Convert a Jerusalem calendar date+time into the correct UTC Instant. */
export function combineDateAndTime(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const desiredAsUtc = Date.UTC(y, m - 1, d, hh, mm, 0);

  let utc = desiredAsUtc;
  for (let i = 0; i < 3; i++) {
    const parts = getZonedParts(new Date(utc));
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    utc += desiredAsUtc - asUtc;
  }

  return new Date(utc);
}

/** YYYY-MM-DD in Asia/Jerusalem */
export function toDateKey(date: Date = new Date()): string {
  const p = getZonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function parseDateKey(key: string): Date {
  return combineDateAndTime(key, "00:00");
}

export function formatTime(date: Date): string {
  const p = getZonedParts(date);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function formatDateHe(date: Date): string {
  return date.toLocaleDateString("ar-IL", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Day-of-week 0=Sunday … 6=Saturday in Asia/Jerusalem */
export function getJerusalemDayOfWeek(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const start = combineDateAndTime(dateKey, "12:00");
  return toDateKey(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));
}

export function startOfJerusalemDay(dateKey?: string): Date {
  return combineDateAndTime(dateKey ?? toDateKey(), "00:00");
}

export function endOfJerusalemDay(dateKey?: string): Date {
  const key = dateKey ?? toDateKey();
  const nextNoon = combineDateAndTime(key, "12:00");
  const nextKey = toDateKey(
    new Date(nextNoon.getTime() + 24 * 60 * 60 * 1000),
  );
  return combineDateAndTime(nextKey, "00:00");
}

/** Calendar date for Prisma @db.Date — noon UTC avoids off-by-one. */
export function dateKeyToDbDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function dbDateToDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
