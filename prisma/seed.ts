import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const TIMEZONE = "Asia/Jerusalem";
/** Copy weekly hours into date windows only through this date (inclusive). */
const MIGRATE_UNTIL_DATE_KEY = "2026-09-12";
const MIGRATION_NOTE = "منقول من جدول الأسبوع";

function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return map;
}

function toDateKey(date: Date = new Date()) {
  const p = getZonedParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function dateKeyToDbDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function dayOfWeekJerusalem(date: Date) {
  const weekday = getZonedParts(date).weekday;
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

function addDaysToDateKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function dayOfWeekFromDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  // ~noon Israel → same calendar weekday for the date key
  return dayOfWeekJerusalem(new Date(Date.UTC(y, m - 1, d, 9, 0, 0)));
}

/**
 * Copy weekly WorkingHours into ExtraHours from today through MIGRATE_UNTIL_DATE_KEY.
 * Never touches Booking rows. Also removes auto-migrated windows after that date
 * (from a previous longer migration), so owners add later dates themselves.
 */
async function migrateWeeklyHoursToDateSchedule() {
  const fields = await prisma.field.findMany({
    select: {
      id: true,
      slug: true,
      workingHours: true,
    },
  });

  let created = 0;
  let removedAfterCutoff = 0;
  const cutoffDbDate = dateKeyToDbDate(MIGRATE_UNTIL_DATE_KEY);

  for (const field of fields) {
    // Clean auto-copied windows after the cutoff (owner will add those later).
    const deleted = await prisma.extraHours.deleteMany({
      where: {
        fieldId: field.id,
        date: { gt: cutoffDbDate },
        note: MIGRATION_NOTE,
      },
    });
    removedAfterCutoff += deleted.count;

    if (field.workingHours.length === 0) continue;

    const byDow = new Map<number, { startTime: string; endTime: string }[]>();
    for (const h of field.workingHours) {
      const list = byDow.get(h.dayOfWeek) || [];
      list.push({ startTime: h.startTime, endTime: h.endTime });
      byDow.set(h.dayOfWeek, list);
    }

    const todayKey = toDateKey();
    for (
      let dateKey = todayKey;
      dateKey <= MIGRATE_UNTIL_DATE_KEY;
      dateKey = addDaysToDateKey(dateKey, 1)
    ) {
      const dbDate = dateKeyToDbDate(dateKey);
      const dow = dayOfWeekFromDateKey(dateKey);
      const windows = byDow.get(dow) || [];
      if (windows.length === 0) continue;

      const dayOff = await prisma.dayOff.findUnique({
        where: { fieldId_date: { fieldId: field.id, date: dbDate } },
      });
      if (dayOff) continue;

      const existing = await prisma.extraHours.findMany({
        where: { fieldId: field.id, date: dbDate },
      });
      // If the manager already set date windows for this day, leave them alone.
      if (existing.length > 0) continue;

      await prisma.extraHours.createMany({
        data: windows.map((w) => ({
          fieldId: field.id,
          date: dbDate,
          startTime: w.startTime,
          endTime: w.endTime,
        })),
      });
      created += windows.length;
    }

    console.log(
      `Migrated weekly hours → date schedule for /${field.slug} (through ${MIGRATE_UNTIL_DATE_KEY})`,
    );
  }

  // Hide migration labels so the schedule looks the same as manually added windows.
  const cleared = await prisma.extraHours.updateMany({
    where: { note: MIGRATION_NOTE },
    data: { note: null },
  });

  console.log(`Date windows created from weekly hours: ${created}`);
  console.log(
    `Auto-migrated windows removed after ${MIGRATE_UNTIL_DATE_KEY}: ${removedAfterCutoff}`,
  );
  console.log(`Cleared migration notes: ${cleared.count}`);
}

async function main() {
  const demoPassword = process.env.DEMO_FIELD_PASSWORD || "ramat123";
  const passwordHash = await hash(demoPassword, 12);

  const field = await prisma.field.upsert({
    where: { slug: "ramat-gan" },
    update: { passwordHash, displayName: "ملعب رمات جان", slotMinutes: 90 },
    create: {
      slug: "ramat-gan",
      displayName: "ملعب رمات جان",
      username: "ramatgan",
      passwordHash,
      slotMinutes: 90,
      holdMinutes: 15,
      smsPlanEnabled: true,
    },
  });

  // Enforce 90-minute booking slots for all fields (does not rewrite bookings).
  await prisma.field.updateMany({ data: { slotMinutes: 90 } });

  await migrateWeeklyHoursToDateSchedule();

  console.log(`Demo field ready: /${field.slug} (user: ramatgan / ${demoPassword})`);
  console.log("Platform login: PLATFORM_USERNAME / PLATFORM_PASSWORD from .env");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
