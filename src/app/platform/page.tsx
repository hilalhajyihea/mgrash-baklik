import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlatformAdminPanel } from "@/components/PlatformAdminPanel";
import { requirePlatformSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ملعب بكليك · إدارة النظام",
};

export default async function PlatformPage() {
  const session = await requirePlatformSession();
  if (!session) redirect("/platform/login");

  return (
    <main className="shop-shell flex-1">
      <PlatformAdminPanel />
    </main>
  );
}
