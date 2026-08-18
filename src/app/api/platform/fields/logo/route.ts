import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { requirePlatformSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logoApiUrl, readLogoUpload } from "@/lib/fieldLogo";

export async function POST(request: Request) {
  const session = await requirePlatformSession();
  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const form = await request.formData();
  const fieldId = String(form.get("fieldId") || "");
  const file = form.get("file");

  if (!fieldId) {
    return NextResponse.json({ error: "מזהה מגרש חסר" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא נבחר קובץ לוגו" }, { status: 400 });
  }

  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: { id: true, slug: true, displayName: true },
  });
  if (!field) {
    return NextResponse.json({ error: "מגרש לא נמצא" }, { status: 404 });
  }

  try {
    const { data, mimeType } = await readLogoUpload(file);
    const logoUrl = logoApiUrl(field.slug);
    const updated = await prisma.field.update({
      where: { id: field.id },
      data: {
        logoData: data,
        logoMimeType: mimeType,
        logoUrl,
      },
      select: { id: true, slug: true, displayName: true, logoUrl: true },
    });
    return NextResponse.json({ field: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "העלאת הלוגו נכשלה";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await requirePlatformSession();
  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const fieldId = String(body.id || "");
  if (!fieldId) {
    return NextResponse.json({ error: "מזהה מגרש חסר" }, { status: 400 });
  }

  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: { id: true, displayName: true, slug: true },
  });
  if (!field) {
    return NextResponse.json({ error: "מגרש לא נמצא" }, { status: 404 });
  }

  const updated = await prisma.field.update({
    where: { id: field.id },
    data: {
      logoUrl: null,
      logoData: null,
      logoMimeType: null,
    },
    select: { id: true, slug: true, displayName: true, logoUrl: true },
  });

  return NextResponse.json({ field: updated });
}
