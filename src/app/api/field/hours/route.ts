import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const hourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  enabled: z.boolean(),
});

const schema = z.object({
  hours: z.array(hourSchema).length(7),
});

export async function GET() {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const hours = await prisma.workingHours.findMany({
    where: { fieldId: session.fieldId },
    orderBy: { dayOfWeek: "asc" },
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

  for (const h of parsed.data.hours) {
    if (h.enabled && h.startTime >= h.endTime) {
      return NextResponse.json(
        { error: "ساعة الانتهاء يجب أن تكون بعد ساعة البداية" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { fieldId: session.fieldId } });
    const enabled = parsed.data.hours.filter((h) => h.enabled);
    if (enabled.length > 0) {
      await tx.workingHours.createMany({
        data: enabled.map((h) => ({
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
