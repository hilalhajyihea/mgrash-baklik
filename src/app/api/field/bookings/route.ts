import { NextResponse } from "next/server";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireHolds } from "@/lib/availability";
import { startOfJerusalemDay, toDateKey } from "@/lib/time";

export async function GET() {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  await expireHolds();

  const from = startOfJerusalemDay(toDateKey());

  const bookings = await prisma.booking.findMany({
    where: {
      fieldId: session.fieldId,
      status: { in: ["HOLD", "CONFIRMED"] },
      startsAt: { gte: from },
    },
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json({ bookings });
}
