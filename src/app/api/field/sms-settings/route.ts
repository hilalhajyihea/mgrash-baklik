import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFieldSmsQuotaStatus } from "@/lib/smsQuota";

export async function GET() {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const field = await prisma.field.findUnique({
    where: { id: session.fieldId },
    select: { phone: true, smsPlanEnabled: true, smsMonthlyLimit: true },
  });
  if (!field) {
    return NextResponse.json({ error: "الملعب غير موجود" }, { status: 404 });
  }

  const quota = await getFieldSmsQuotaStatus(session.fieldId);

  return NextResponse.json({
    phone: field.phone || "",
    smsPlanEnabled: field.smsPlanEnabled,
    smsMonthlyLimit: field.smsMonthlyLimit,
    smsMonthlyUsed: quota.usedCount,
    smsMonthlyRemaining: quota.remaining,
  });
}

const schema = z.object({
  phone: z.string().max(20),
});

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

  const phone = parsed.data.phone.trim();
  if (phone && !/^[\d+\-\s()]{9,20}$/.test(phone)) {
    return NextResponse.json({ error: "رقم هاتف غير صالح" }, { status: 400 });
  }

  const field = await prisma.field.update({
    where: { id: session.fieldId },
    data: { phone: phone || null },
    select: { phone: true },
  });

  return NextResponse.json({ ok: true, phone: field.phone || "" });
}
