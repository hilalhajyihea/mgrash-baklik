import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateKeyToDbDate, toDateKey } from "@/lib/time";

export async function GET() {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const from = dateKeyToDbDate(toDateKey());

  const dayOffs = await prisma.dayOff.findMany({
    where: { fieldId: session.fieldId, date: { gte: from } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ dayOffs });
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
  }

  const date = dateKeyToDbDate(parsed.data.date);
  const dayOff = await prisma.dayOff.upsert({
    where: {
      fieldId_date: { fieldId: session.fieldId, date },
    },
    update: { note: parsed.data.note || null },
    create: {
      fieldId: session.fieldId,
      date,
      note: parsed.data.note || null,
    },
  });

  return NextResponse.json({ dayOff });
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

  await prisma.dayOff.deleteMany({
    where: { id: parsed.data.id, fieldId: session.fieldId },
  });

  return NextResponse.json({ ok: true });
}
