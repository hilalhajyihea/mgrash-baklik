import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildCustomerCancelledByOwnerSms,
  sendSms,
  sms019Configured,
} from "@/lib/sms";
import { consumeFieldSmsQuota, refundFieldSmsQuota } from "@/lib/smsQuota";

const schema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "معرّف الحجز ناقص" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: parsed.data.id, fieldId: session.fieldId },
    include: { field: { select: { displayName: true, smsPlanEnabled: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "الحجز غير موجود" }, { status: 404 });
  }

  if (booking.status === "CANCELLED") {
    return NextResponse.json({ ok: true, already: true });
  }

  const notifyCustomer =
    booking.status === "CONFIRMED" || booking.status === "HOLD";

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });

  if (
    notifyCustomer &&
    booking.field.smsPlanEnabled &&
    booking.customerPhone &&
    sms019Configured()
  ) {
    const quota = await consumeFieldSmsQuota(session.fieldId);
    if (quota.ok) {
      const sms = await sendSms(
        booking.customerPhone,
        buildCustomerCancelledByOwnerSms({
          customerName: booking.customerName,
          fieldName: booking.field.displayName,
          startsAt: booking.startsAt,
        }),
      );
      if (!sms.ok) {
        await refundFieldSmsQuota(session.fieldId, quota.monthKey);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
