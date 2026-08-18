import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createField, isValidSlug, resetFieldPassword } from "@/lib/fields";

export async function GET() {
  const session = await requirePlatformSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const fields = await prisma.field.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      displayName: true,
      username: true,
      isActive: true,
      slotMinutes: true,
      holdMinutes: true,
      smsPlanEnabled: true,
      logoUrl: true,
      logoMimeType: true,
      introText: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
  });

  return NextResponse.json({ fields });
}

const createSchema = z.object({
  slug: z.string().min(2).max(40),
  displayName: z.string().min(2).max(80),
  username: z.string().min(2).max(40),
  password: z.string().min(6).max(100),
  slotMinutes: z.number().int().min(30).max(180).optional(),
});

export async function POST(request: Request) {
  const session = await requirePlatformSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
      { status: 400 },
    );
  }

  if (!isValidSlug(parsed.data.slug)) {
    return NextResponse.json(
      { error: "عنوان غير صالح (مثال: ramat-gan)" },
      { status: 400 },
    );
  }

  try {
    const field = await createField(parsed.data);
    return NextResponse.json({
      field: {
        id: field.id,
        slug: field.slug,
        displayName: field.displayName,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذّر إنشاء الملعب";
    if (message.includes("Unique") || message.includes("unique")) {
      return NextResponse.json(
        { error: "اسم المستخدم أو العنوان موجود مسبقًا" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
  smsPlanEnabled: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
  displayName: z.string().min(2).max(80).optional(),
  introText: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {
  const session = await requirePlatformSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  if (parsed.data.password) {
    await resetFieldPassword(parsed.data.id, parsed.data.password);
  }

  const field = await prisma.field.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.isActive !== undefined
        ? { isActive: parsed.data.isActive }
        : {}),
      ...(parsed.data.smsPlanEnabled !== undefined
        ? { smsPlanEnabled: parsed.data.smsPlanEnabled }
        : {}),
      ...(parsed.data.displayName
        ? { displayName: parsed.data.displayName.trim() }
        : {}),
      ...(parsed.data.introText !== undefined
        ? { introText: parsed.data.introText.trim() || null }
        : {}),
    },
  });

  return NextResponse.json({
    field: {
      id: field.id,
      slug: field.slug,
      displayName: field.displayName,
      isActive: field.isActive,
      smsPlanEnabled: field.smsPlanEnabled,
    },
  });
}
