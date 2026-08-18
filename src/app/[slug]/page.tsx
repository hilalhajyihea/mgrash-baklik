import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingCalendar } from "@/components/BookingCalendar";
import { prisma } from "@/lib/prisma";
import { fieldShareMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const field = await prisma.field.findUnique({ where: { slug } });
  if (!field || !field.isActive) {
    return { title: "ملعب بكليك" };
  }
  return fieldShareMetadata(field.displayName, field.slug);
}

export default async function FieldPublicPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "platform" || slug === "api" || slug === "confirm") {
    notFound();
  }

  const field = await prisma.field.findUnique({
    where: { slug },
    select: {
      slug: true,
      displayName: true,
      isActive: true,
      logoMimeType: true,
    },
  });
  if (!field || !field.isActive) notFound();

  const logoUrl = field.logoMimeType
    ? `/api/fields/${field.slug}/logo`
    : null;

  return (
    <main className="flex-1">
      <BookingCalendar
        slug={field.slug}
        displayName={field.displayName}
        logoUrl={logoUrl}
      />
    </main>
  );
}
