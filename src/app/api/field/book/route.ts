import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { createAdminBooking } from "@/lib/availability";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().min(2).max(80),
  customerPhone: z
    .string()
    .max(20)
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine(
      (v) => v === "" || (v.length >= 9 && /^[\d+\-\s()]+$/.test(v)),
      "رقم هاتف غير صالح",
    ),
});

export async function POST(request: Request) {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
      { status: 400 },
    );
  }

  try {
    const booking = await createAdminBooking({
      fieldId: session.fieldId,
      dateKey: parsed.data.date,
      time: parsed.data.time,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
    });
    return NextResponse.json({
      ok: true,
      booking: {
        id: booking.id,
        startsAt: booking.startsAt.toISOString(),
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
