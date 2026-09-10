import { NextResponse } from "next/server";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addDaysToDateKey,
  dateKeyToDbDate,
  dbDateToDateKey,
  sundayOfWeek,
  toDateKey,
} from "@/lib/time";

/** Copy ExtraHours from this week (Sun–Sat) to next week (Sun–Sat). */
export async function POST() {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const thisSunday = sundayOfWeek(toDateKey());
  const thisSaturday = addDaysToDateKey(thisSunday, 6);
  const nextSunday = addDaysToDateKey(thisSunday, 7);
  const nextSaturday = addDaysToDateKey(nextSunday, 6);

  const source = await prisma.extraHours.findMany({
    where: {
      fieldId: session.fieldId,
      date: {
        gte: dateKeyToDbDate(thisSunday),
        lte: dateKeyToDbDate(thisSaturday),
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  if (source.length === 0) {
    return NextResponse.json(
      { error: "لا يوجد جدول لنسخه هذا الأسبوع" },
      { status: 400 },
    );
  }

  const existingNext = await prisma.extraHours.findMany({
    where: {
      fieldId: session.fieldId,
      date: {
        gte: dateKeyToDbDate(nextSunday),
        lte: dateKeyToDbDate(nextSaturday),
      },
    },
    select: { date: true },
  });
  const datesWithExisting = new Set(
    existingNext.map((row) => dbDateToDateKey(row.date)),
  );

  const toCreate: {
    fieldId: string;
    date: Date;
    startTime: string;
    endTime: string;
    note: string | null;
  }[] = [];
  const skippedDates = new Set<string>();

  for (const row of source) {
    const destKey = addDaysToDateKey(dbDateToDateKey(row.date), 7);
    if (datesWithExisting.has(destKey)) {
      skippedDates.add(destKey);
      continue;
    }
    toCreate.push({
      fieldId: session.fieldId,
      date: dateKeyToDbDate(destKey),
      startTime: row.startTime,
      endTime: row.endTime,
      note: row.note,
    });
  }

  if (toCreate.length > 0) {
    await prisma.extraHours.createMany({ data: toCreate });
  }

  return NextResponse.json({
    copied: toCreate.length,
    skippedDays: skippedDates.size,
    fromWeekStart: thisSunday,
    toWeekStart: nextSunday,
  });
}
