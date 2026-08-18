import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const field = await prisma.field.findUnique({
    where: { slug },
    select: {
      isActive: true,
      logoData: true,
      logoMimeType: true,
    },
  });

  if (!field?.isActive || !field.logoData || !field.logoMimeType) {
    return new NextResponse("Not found", { status: 404 });
  }

  const bytes = Buffer.from(field.logoData);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": field.logoMimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
