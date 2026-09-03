import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPublicHold } from "@/lib/availability";
import { buildConfirmUrl } from "@/lib/tokens";
import { buildHoldConfirmSms, sendSms, sms019Configured } from "@/lib/sms";
import { consumeFieldSmsQuota, refundFieldSmsQuota } from "@/lib/smsQuota";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schema = z.object({
      slug: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      customerName: z.string().min(2, "يرجى إدخال الاسم").max(80),
      customerPhone: z
        .string()
        .min(9, "يرجى إدخال رقم الهاتف")
        .max(20)
        .regex(/^[\d+\-\s()]+$/, "رقم هاتف غير صالح"),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 },
      );
    }

    const field = await prisma.field.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (!field || !field.isActive) {
      return NextResponse.json({ error: "الملعب غير موجود" }, { status: 404 });
    }

    const booking = await createPublicHold({
      fieldId: field.id,
      dateKey: parsed.data.date,
      time: parsed.data.time,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
    });

    const confirmUrl = buildConfirmUrl(booking.confirmToken);
    const smsBody = buildHoldConfirmSms({
      customerName: booking.customerName,
      fieldName: field.displayName,
      startsAt: booking.startsAt,
      confirmUrl,
      holdMinutes: field.holdMinutes,
    });

    if (!sms019Configured()) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "تعذّر إرسال SMS. حاولوا مرة أخرى أو راجعوا الإدارة." },
        { status: 503 },
      );
    }

    if (!field.smsPlanEnabled) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "خدمة SMS غير مفعّلة لهذا الملعب." },
        { status: 503 },
      );
    }

    const quota = await consumeFieldSmsQuota(field.id);
    if (!quota.ok) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: quota.error }, { status: 429 });
    }

    const sms = await sendSms(booking.customerPhone, smsBody);
    if (!sms.ok) {
      await refundFieldSmsQuota(field.id, quota.monthKey);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: sms.error || "فشل إرسال رسالة التأكيد. حاولوا مرة أخرى." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      booking: {
        id: booking.id,
        startsAt: booking.startsAt.toISOString(),
        status: booking.status,
        holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
      },
      sms: {
        ok: true,
        skipped: false,
        error: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: message || "فشل الحجز" },
      { status: 409 },
    );
  }
}
