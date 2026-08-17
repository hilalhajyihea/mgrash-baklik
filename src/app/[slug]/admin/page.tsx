import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FieldAdminPanel } from "@/components/FieldAdminPanel";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const field = await prisma.field.findUnique({ where: { slug } });
  return {
    title: field ? `מגרש בקליק · ${field.displayName}` : "מגרש בקליק",
  };
}

export default async function FieldAdminPage({ params }: Props) {
  const { slug } = await params;
  const field = await prisma.field.findUnique({ where: { slug } });
  if (!field || !field.isActive) notFound();

  const session = await requireFieldSession(slug);
  if (!session) redirect(`/${slug}/login`);

  return (
    <main className="shop-shell flex-1">
      <FieldAdminPanel slug={field.slug} displayName={field.displayName} />
    </main>
  );
}
