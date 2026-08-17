import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const field = await prisma.field.findUnique({ where: { slug } });
  return {
    title: field
      ? `מגרש בקליק · כניסה · ${field.displayName}`
      : "מגרש בקליק · כניסה",
  };
}

export default async function FieldLoginPage({ params }: Props) {
  const { slug } = await params;
  const field = await prisma.field.findUnique({ where: { slug } });
  if (!field || !field.isActive) notFound();

  const session = await getSession();
  if (session?.kind === "field" && session.slug === slug) {
    redirect(`/${slug}/admin`);
  }

  return (
    <main className="shop-shell flex flex-1 items-center justify-center px-4 py-12">
      <LoginForm
        endpoint="/api/auth/field/login"
        title="כניסת בעל מגרש"
        subtitle={`ניהול ${field.displayName}`}
        redirectTo={`/${slug}/admin`}
      />
    </main>
  );
}
