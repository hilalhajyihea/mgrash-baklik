import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const windowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const schema = z.object({
  hours: z.array(windowSchema).max(70),
});

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export async function GET() {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const hours = await prisma.workingHours.findMany({
    where: { fieldId: session.fieldId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ hours });
}

export async function PUT(request: Request) {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const hours = parsed.data.hours;
  for (const h of hours) {
    if (h.startTime >= h.endTime) {
      return NextResponse.json(
        { error: "ساعة الانتهاء يجب أن تكون بعد ساعة البداية" },
        { status: 400 },
      );
    }
  }

  const byDay = new Map<number, { startTime: string; endTime: string }[]>();
  for (const h of hours) {
    const list = byDay.get(h.dayOfWeek) || [];
    list.push({ startTime: h.startTime, endTime: h.endTime });
    byDay.set(h.dayOfWeek, list);
  }
  for (const list of byDay.values()) {
    const sorted = [...list].sort(
      (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
    );
    for (let i = 1; i < sorted.length; i++) {
      if (toMinutes(sorted[i]!.startTime) < toMinutes(sorted[i - 1]!.endTime)) {
        return NextResponse.json(
          { error: "الفترات في نفس اليوم تتداخل" },
          { status: 400 },
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { fieldId: session.fieldId } });
    if (hours.length > 0) {
      await tx.workingHours.createMany({
        data: hours.map((h) => ({
          fieldId: session.fieldId,
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
        })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
