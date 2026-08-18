"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelHoldButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    if (!confirm("إلغاء هذا الحجز؟")) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/confirm/${encodeURIComponent(token)}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "فشل الإلغاء");
        return;
      }
      router.refresh();
    } catch {
      setError("خطأ في الشبكة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={loading}
        className="shop-chip w-full rounded-xl px-6 py-3 font-semibold"
      >
        {loading ? "جارٍ الإلغاء…" : "إلغاء الحجز"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-red-200">{error}</p>
      ) : null}
    </div>
  );
}
