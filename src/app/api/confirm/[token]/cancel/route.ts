import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeToken } from "@/lib/tokens";
import { expireHolds } from "@/lib/availability";
import { buildOwnerCancelSms, sendSms, sms019Configured } from "@/lib/sms";
import { consumeFieldSmsQuota, refundFieldSmsQuota } from "@/lib/smsQuota";
import { revokeCompetitionPointForBooking } from "@/lib/competition";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await context.params;
  const token = sanitizeToken(raw);
  if (!token) {
    return NextResponse.json({ error: "الرابط غير صالح" }, { status: 400 });
  }

  await expireHolds();

  const booking = await prisma.booking.findUnique({
    where: { confirmToken: token },
    include: {
      field: {
        select: { id: true, displayName: true, phone: true, smsPlanEnabled: true },
      },
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "الحجز غير موجود" }, { status: 404 });
  }
  if (booking.status === "CANCELLED") {
    return NextResponse.json({ ok: true, already: true });
  }
  if (booking.status !== "CONFIRMED" && booking.status !== "HOLD") {
    return NextResponse.json({ error: "لا يمكن إلغاء هذا الحجز" }, { status: 409 });
  }

  const wasConfirmed = booking.status === "CONFIRMED";

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });

  if (wasConfirmed) {
    await revokeCompetitionPointForBooking({
      fieldId: booking.field.id,
      bookingId: booking.id,
      customerPhone: booking.customerPhone,
    });
  }

  if (
    wasConfirmed &&
    booking.field.smsPlanEnabled &&
    booking.field.phone &&
    sms019Configured()
  ) {
    const quota = await consumeFieldSmsQuota(booking.field.id);
    if (quota.ok) {
      const sms = await sendSms(
        booking.field.phone,
        buildOwnerCancelSms({
          customerName: booking.customerName,
          fieldName: booking.field.displayName,
          startsAt: booking.startsAt,
        }),
      );
      if (!sms.ok) {
        await refundFieldSmsQuota(booking.field.id, quota.monthKey);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
