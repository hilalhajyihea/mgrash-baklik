import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ملعب بكليك · دخول مدير النظام",
};

export default async function PlatformLoginPage() {
  const session = await getSession();
  if (session?.kind === "platform") {
    redirect("/platform");
  }

  return (
    <main className="shop-shell flex flex-1 items-center justify-center px-4 py-12">
      <LoginForm
        endpoint="/api/auth/platform/login"
        title="مدير النظام"
        subtitle="إدارة الملاعب في منصة ملعب بكليك"
        redirectTo="/platform"
      />
    </main>
  );
}
