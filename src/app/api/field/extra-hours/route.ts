import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  dateKeyToDbDate,
  dbDateToDateKey,
  isValidHourWindow,
  parseWindowEndMinutes,
  toDateKey,
} from "@/lib/time";

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export async function GET() {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const from = dateKeyToDbDate(toDateKey());

  const extraHours = await prisma.extraHours.findMany({
    where: { fieldId: session.fieldId, date: { gte: from } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({
    extraHours: extraHours.map((row) => ({
      id: row.id,
      date: dbDateToDateKey(row.date),
      startTime: row.startTime,
      endTime: row.endTime,
      note: row.note,
    })),
  });
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { date, startTime, endTime, note } = parsed.data;

  if (date < toDateKey()) {
    return NextResponse.json(
      { error: "لا يمكن إضافة فترة لتاريخ ماضٍ" },
      { status: 400 },
    );
  }

  if (!isValidHourWindow(startTime, endTime)) {
    return NextResponse.json(
      { error: "ساعة الانتهاء يجب أن تكون بعد ساعة البداية" },
      { status: 400 },
    );
  }

  const field = await prisma.field.findUnique({
    where: { id: session.fieldId },
    select: { slotMinutes: true },
  });
  const slotMinutes = field?.slotMinutes && field.slotMinutes > 0 ? field.slotMinutes : 90;
  const windowLength =
    parseWindowEndMinutes(startTime, endTime) - toMinutes(startTime);
  if (windowLength < slotMinutes) {
    return NextResponse.json(
      {
        error: `الفترة قصيرة جدًا. الحد الأدنى ${slotMinutes} دقيقة لحجز واحد.`,
      },
      { status: 400 },
    );
  }

  const dbDate = dateKeyToDbDate(date);

  const existing = await prisma.extraHours.findMany({
    where: { fieldId: session.fieldId, date: dbDate },
  });
  const sorted = [...existing, { startTime, endTime }].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
  );
  for (let i = 1; i < sorted.length; i++) {
    if (
      toMinutes(sorted[i]!.startTime) <
      parseWindowEndMinutes(sorted[i - 1]!.startTime, sorted[i - 1]!.endTime)
    ) {
      return NextResponse.json(
        { error: "الفترات في نفس اليوم تتداخل" },
        { status: 400 },
      );
    }
  }

  const row = await prisma.extraHours.create({
    data: {
      fieldId: session.fieldId,
      date: dbDate,
      startTime,
      endTime,
      note: note || null,
    },
  });

  return NextResponse.json({
    extraHours: {
      id: row.id,
      date: dbDateToDateKey(row.date),
      startTime: row.startTime,
      endTime: row.endTime,
      note: row.note,
    },
  });
}

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function DELETE(request: Request) {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "المعرّف ناقص" }, { status: 400 });
  }

  await prisma.extraHours.deleteMany({
    where: { id: parsed.data.id, fieldId: session.fieldId },
  });

  return NextResponse.json({ ok: true });
}
