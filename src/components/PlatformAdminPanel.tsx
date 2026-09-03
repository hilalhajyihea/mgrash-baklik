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
  smsMonthlyLimit: number;
  logoUrl: string | null;
  logoMimeType: string | null;
  introText: string | null;
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
  const [introDrafts, setIntroDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/fields");
      if (res.status === 401) {
        router.push("/platform/login");
        return;
      }
      const data = await res.json();
      const list = data.fields || [];
      setFields(list);
      setIntroDrafts(
        Object.fromEntries(
          list.map((f: FieldRow) => [f.id, f.introText || ""]),
        ),
      );
    } catch {
      setError("خطأ في التحميل");
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
      setError(data.error || "فشل الإنشاء");
      return;
    }
    setMessage(`تم إنشاء الملعب — العنوان: /${data.field.slug}`);
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
      setError("فشل التحديث");
      return;
    }
    setMessage(okMsg);
    load();
  }

  async function uploadLogo(field: FieldRow, file: File | null) {
    if (!file) return;
    setError("");
    const form = new FormData();
    form.set("fieldId", field.id);
    form.set("file", file);
    const res = await fetch("/api/platform/fields/logo", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل رفع الشعار");
      return;
    }
    setMessage(`تم تحديث شعار ${field.displayName}`);
    load();
  }

  async function removeLogo(field: FieldRow) {
    if (!field.logoMimeType && !field.logoUrl) return;
    if (!confirm(`حذف شعار ${field.displayName}؟ سيظهر الاسم مجددًا في الموقع.`)) {
      return;
    }
    setError("");
    const res = await fetch("/api/platform/fields/logo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: field.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل حذف الشعار");
      return;
    }
    setMessage(`حُذف الشعار — سيظهر الاسم مجددًا: ${field.displayName}`);
    load();
  }

  async function resetPassword(field: FieldRow) {
    const next = prompt(`كلمة مرور جديدة لـ ${field.displayName}`);
    if (!next || next.length < 6) {
      if (next != null) setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    await patchField(field.id, { password: next }, "تم تحديث كلمة المرور");
  }

  async function setSmsMonthlyLimit(field: FieldRow) {
    const next = prompt(
      `حد SMS شهري لـ ${field.displayName} (0 = بدون حد)`,
      String(field.smsMonthlyLimit ?? 0),
    );
    if (next == null) return;

    const value = Number(next);
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      setError("قيمة غير صالحة للحد الشهري");
      return;
    }

    await patchField(
      field.id,
      { smsMonthlyLimit: value },
      "تم تحديث حد SMS الشهري",
    );
  }

  async function deleteField(field: FieldRow) {
    const ok = confirm(
      `حذف ملعب "${field.displayName}" نهائيًا؟ سيُحذف الموقع والحجوزات ولن يظهر في القائمة.`,
    );
    if (!ok) return;
    const typed = prompt(`اكتبوا اسم الملعب للتأكيد: ${field.displayName}`);
    if (typed !== field.displayName) {
      if (typed != null) setError("لم يُحذف الملعب — الاسم غير مطابق");
      return;
    }
    setError("");
    const res = await fetch("/api/platform/fields", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: field.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل الحذف");
      return;
    }
    setMessage(`حُذف الملعب: ${field.displayName}`);
    load();
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
          خروج
        </button>
      </div>

      <h1 className="font-display text-3xl text-[var(--cream)]">إدارة النظام</h1>
      <p className="mt-2 text-sm text-[rgba(244,248,238,0.62)]">
        أضيفوا أصحاب الملاعب. كل ملعب يحصل على عنوان على النطاق نفسه.
      </p>

      <form
        onSubmit={createField}
        className="surface-dark mt-8 grid gap-3 rounded-2xl p-5 sm:grid-cols-2"
      >
        <h2 className="font-semibold sm:col-span-2">ملعب جديد</h2>
        <input
          className="shop-field rounded-xl px-3 py-2.5"
          placeholder="العنوان (ramat-gan)"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          required
        />
        <input
          className="shop-field rounded-xl px-3 py-2.5"
          placeholder="اسم العرض"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <input
          className="shop-field rounded-xl px-3 py-2.5"
          placeholder="اسم المستخدم للدخول"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="shop-field rounded-xl px-3 py-2.5"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button type="submit" className="btn-primary rounded-xl py-2.5 font-semibold sm:col-span-2">
          إضافة ملعب
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
        {loading ? <p>جارٍ التحميل…</p> : null}
        {fields.map((field) => (
          <div
            key={field.id}
            className="surface-dark flex flex-col gap-3 rounded-2xl p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {field.logoMimeType ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/fields/${field.slug}/logo`}
                  alt=""
                  className="mt-0.5 h-10 w-auto max-w-24 object-contain"
                />
              ) : null}
              <div>
                <p className="font-semibold">
                  {field.displayName}
                  {field.logoMimeType || field.logoUrl ? (
                    <span className="mr-2 text-xs font-normal text-[var(--lime)]">
                      · يوجد شعار
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-[rgba(244,248,238,0.62)]">
                  <Link href={`/${field.slug}`} className="underline">
                    /{field.slug}
                  </Link>
                  {" · "}
                  {field.username}
                  {" · "}
                  {field._count.bookings} حجوزات
                  {" · "}
                  {field.isActive ? "فعّال" : "متوقف"}
                  {" · "}
                  SMS {field.smsPlanEnabled ? "فعّال" : "متوقف"}
                  {" · "}
                  حد SMS{" "}
                  {field.smsMonthlyLimit > 0 ? String(field.smsMonthlyLimit) : "بدون حد"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="shop-chip cursor-pointer rounded-xl px-3 py-1.5 text-sm">
                {field.logoMimeType || field.logoUrl ? "استبدال الشعار" : "رفع شعار"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    e.target.value = "";
                    void uploadLogo(field, file);
                  }}
                />
              </label>
              {field.logoMimeType || field.logoUrl ? (
                <button
                  type="button"
                  className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                  onClick={() => removeLogo(field)}
                >
                  حذف الشعار
                </button>
              ) : null}
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                onClick={() =>
                  patchField(
                    field.id,
                    { isActive: !field.isActive },
                    field.isActive ? "أُوقف الملعب" : "فُعّل الملعب",
                  )
                }
              >
                {field.isActive ? "إيقاف" : "تفعيل"}
              </button>
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                onClick={() =>
                  patchField(
                    field.id,
                    { smsPlanEnabled: !field.smsPlanEnabled },
                    field.smsPlanEnabled ? "SMS أُوقف" : "SMS فُعّل",
                  )
                }
              >
                SMS
              </button>
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                onClick={() => setSmsMonthlyLimit(field)}
              >
                حد SMS شهري
              </button>
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                onClick={() => resetPassword(field)}
              >
                كلمة المرور
              </button>
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm text-red-200"
                onClick={() => deleteField(field)}
              >
                حذف الملعب
              </button>
            </div>
            </div>
            <label className="block text-sm text-[rgba(244,248,238,0.78)]">
              نص تحت الشعار (يظهر في صفحة الحجز)
              <textarea
                className="shop-field mt-1.5 min-h-20 w-full rounded-xl px-3 py-2.5"
                rows={3}
                maxLength={500}
                placeholder="مثلاً: ملعب الإتحاد — عشب طبيعي، إضاءة ليلية"
                value={introDrafts[field.id] ?? field.introText ?? ""}
                onChange={(e) =>
                  setIntroDrafts((prev) => ({
                    ...prev,
                    [field.id]: e.target.value,
                  }))
                }
              />
            </label>
            <button
              type="button"
              className="btn-primary self-start rounded-xl px-4 py-2 text-sm font-semibold"
              onClick={() =>
                patchField(
                  field.id,
                  { introText: introDrafts[field.id] ?? "" },
                  "تم حفظ النص",
                )
              }
            >
              حفظ النص
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
