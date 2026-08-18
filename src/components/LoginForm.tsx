"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandGraphics";

type Props = {
  endpoint: string;
  title: string;
  subtitle?: string;
  redirectTo: string;
};

export function LoginForm({ endpoint, title, subtitle, redirectTo }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "فشل تسجيل الدخول");
        return;
      }
      const dest = data.field?.slug != null ? `/${data.field.slug}/admin` : redirectTo;
      router.push(dest);
      router.refresh();
    } catch {
      setError("خطأ في الشبكة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="surface-dark relative w-full max-w-md overflow-hidden rounded-2xl p-6 sm:p-8"
    >
      <div className="absolute inset-y-0 right-0 w-1.5 bg-[var(--lime)] opacity-80" />
      <BrandMark className="mb-6" tone="light" />
      <h1 className="font-display text-3xl text-[var(--cream)]">{title}</h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-[rgba(244,248,238,0.62)]">{subtitle}</p>
      ) : null}

      <label className="mt-6 block text-sm font-medium text-[var(--cream)]">
        اسم المستخدم
        <input
          className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-[var(--cream)]">
        كلمة المرور
        <input
          type="password"
          className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-950/70 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary mt-6 w-full rounded-xl py-3 font-semibold"
      >
        {loading ? "جارٍ الدخول…" : "دخول"}
      </button>
    </form>
  );
}
