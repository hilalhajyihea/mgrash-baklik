import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";

const schema = z.object({
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = schema.safeParse({
      slug: searchParams.get("slug"),
      date: searchParams.get("date"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "معاملات غير صالحة" }, { status: 400 });
    }

    const field = await prisma.field.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (!field || !field.isActive) {
      return NextResponse.json({ error: "الملعب غير موجود" }, { status: 404 });
    }

    const slots = await getAvailableSlots(field.id, parsed.data.date);
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("availability error", error);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
