"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandGraphics";

type FieldRow = {
  id: string;
  slug: string;
  displayName: string;
  username: string;
  isActive: boolean;
  slotMinutes: number;
  holdMinutes: number;
  smsPlanEnabled: boolean;
  _count: { bookings: number };
};

export function PlatformAdminPanel() {
  const router = useRouter();
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/fields");
      if (res.status === 401) {
        router.push("/platform/login");
        return;
      }
      const data = await res.json();
      setFields(data.fields || []);
    } catch {
      setError("שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/platform/login");
  }

  async function createField(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const res = await fetch("/api/platform/fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, displayName, username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "יצירה נכשלה");
      return;
    }
    setMessage(`המגרש נוצר — כתובת: /${data.field.slug}`);
    setSlug("");
    setDisplayName("");
    setUsername("");
    setPassword("");
    load();
  }

  async function patchField(id: string, body: Record<string, unknown>, okMsg: string) {
    const res = await fetch("/api/platform/fields", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) {
      setError("עדכון נכשל");
      return;
    }
    setMessage(okMsg);
    load();
  }

  async function resetPassword(field: FieldRow) {
    const next = prompt(`סיסמה חדשה עבור ${field.displayName}`);
    if (!next || next.length < 6) {
      if (next != null) setError("סיסמה חייבת לפחות 6 תווים");
      return;
    }
    await patchField(field.id, { password: next }, "הסיסמה עודכנה");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <BrandMark tone="light" />
        <button
          type="button"
          onClick={logout}
          className="rounded-xl border border-white/20 px-4 py-2 text-sm"
        >
          יציאה
        </button>
      </div>

      <h1 className="font-display text-3xl text-[var(--cream)]">ניהול מערכת</h1>
      <p className="mt-2 text-sm text-[rgba(244,248,238,0.62)]">
        הוסיפו בעלי מגרשים. כל מגרש מקבל כתובת על אותו דומיין.
      </p>

      <form
        onSubmit={createField}
        className="surface-dark mt-8 grid gap-3 rounded-2xl p-5 sm:grid-cols-2"
      >
        <h2 className="font-semibold sm:col-span-2">מגרש חדש</h2>
        <input
          className="shop-field rounded-xl px-3 py-2.5"
          placeholder="כתובת (ramat-gan)"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          required
        />
        <input
          className="shop-field rounded-xl px-3 py-2.5"
          placeholder="שם תצוגה"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <input
          className="shop-field rounded-xl px-3 py-2.5"
          placeholder="שם משתמש לכניסה"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="shop-field rounded-xl px-3 py-2.5"
          placeholder="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button type="submit" className="btn-primary rounded-xl py-2.5 font-semibold sm:col-span-2">
          הוספת מגרש
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-950/70 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm text-[var(--lime)]">{message}</p>
      ) : null}

      <div className="mt-8 space-y-3">
        {loading ? <p>טוען…</p> : null}
        {fields.map((field) => (
          <div
            key={field.id}
            className="surface-dark flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold">{field.displayName}</p>
              <p className="text-sm text-[rgba(244,248,238,0.62)]">
                <Link href={`/${field.slug}`} className="underline">
                  /{field.slug}
                </Link>
                {" · "}
                {field.username}
                {" · "}
                {field._count.bookings} שריונים
                {" · "}
                {field.isActive ? "פעיל" : "מושבת"}
                {" · "}
                SMS {field.smsPlanEnabled ? "פעיל" : "כבוי"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                onClick={() =>
                  patchField(
                    field.id,
                    { isActive: !field.isActive },
                    field.isActive ? "המגרש הושבת" : "המגרש הופעל",
                  )
                }
              >
                {field.isActive ? "השבתה" : "הפעלה"}
              </button>
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                onClick={() =>
                  patchField(
                    field.id,
                    { smsPlanEnabled: !field.smsPlanEnabled },
                    field.smsPlanEnabled ? "SMS הושבת" : "SMS הופעל",
                  )
                }
              >
                SMS
              </button>
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                onClick={() => resetPassword(field)}
              >
                סיסמה
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
