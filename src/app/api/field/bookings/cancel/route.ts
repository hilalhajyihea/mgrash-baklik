import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildOwnerCancelSms, sendSms, sms019Configured } from "@/lib/sms";

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
    include: { field: { select: { displayName: true, phone: true, smsPlanEnabled: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "الحجز غير موجود" }, { status: 404 });
  }

  const wasConfirmed = booking.status === "CONFIRMED";

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });

  if (
    wasConfirmed &&
    booking.field.smsPlanEnabled &&
    booking.field.phone &&
    sms019Configured()
  ) {
    await sendSms(
      booking.field.phone,
      buildOwnerCancelSms({
        customerName: booking.customerName,
        fieldName: booking.field.displayName,
        startsAt: booking.startsAt,
      }),
    );
  }

  return NextResponse.json({ ok: true });
}
