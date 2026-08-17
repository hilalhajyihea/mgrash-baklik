import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "חסר מזהה שריון" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: parsed.data.id, fieldId: session.fieldId },
  });
  if (!booking) {
    return NextResponse.json({ error: "השריון לא נמצא" }, { status: 404 });
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ ok: true });
}
