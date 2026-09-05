"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandGraphics";
import {
  combineDateAndTime,
  dbDateToDateKey,
  formatDateHe,
  formatSlotRange,
  formatTime,
  toDateKey,
} from "@/lib/time";

type Booking = {
  id: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  customerPhone: string;
  status: string;
  source: string;
};

type DayOff = {
  id: string;
  date: string;
  note: string | null;
};

type ScheduleWindow = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string | null;
};

export function FieldAdminPanel({
  slug,
  displayName,
}: {
  slug: string;
  displayName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "bookings" | "book" | "schedule" | "daysOff" | "sms"
  >("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ownerPhone, setOwnerPhone] = useState("");
  const [smsPlanEnabled, setSmsPlanEnabled] = useState(false);
  const [smsMonthlyLimit, setSmsMonthlyLimit] = useState<number>(0);
  const [smsMonthlyUsed, setSmsMonthlyUsed] = useState<number>(0);
  const [smsMonthlyRemaining, setSmsMonthlyRemaining] = useState<
    number | null
  >(null);
  const [dayOffs, setDayOffs] = useState<DayOff[]>([]);
  const [schedule, setSchedule] = useState<ScheduleWindow[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleStart, setScheduleStart] = useState("18:00");
  const [scheduleEnd, setScheduleEnd] = useState("21:00");
  const [scheduleNote, setScheduleNote] = useState("");
  const [offDate, setOffDate] = useState("");
  const [offNote, setOffNote] = useState("");
  const [bookDate, setBookDate] = useState(toDateKey());
  const [bookTime, setBookTime] = useState("");
  const [bookName, setBookName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookSlots, setBookSlots] = useState<string[]>([]);
  const [slotMinutes, setSlotMinutes] = useState(90);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, dRes, eRes, sRes] = await Promise.all([
        fetch("/api/field/bookings"),
        fetch("/api/field/days-off"),
        fetch("/api/field/extra-hours"),
        fetch("/api/field/sms-settings"),
      ]);
      if (bRes.status === 401) {
        router.push(`/${slug}/login`);
        return;
      }
      const bData = await bRes.json();
      const dData = await dRes.json();
      const eData = await eRes.json();
      const sData = await sRes.json();
      setBookings(bData.bookings || []);
      setDayOffs(dData.dayOffs || []);
      setSchedule(eData.extraHours || []);
      setOwnerPhone(sData.phone || "");
      setSmsPlanEnabled(!!sData.smsPlanEnabled);
      setSmsMonthlyLimit(Number(sData.smsMonthlyLimit ?? 0));
      setSmsMonthlyUsed(Number(sData.smsMonthlyUsed ?? 0));
      setSmsMonthlyRemaining(
        sData.smsMonthlyRemaining == null ? null : Number(sData.smsMonthlyRemaining),
      );
    } catch {
      setError("خطأ في التحميل");
    } finally {
      setLoading(false);
    }
  }, [router, slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      if (!bookDate) return;
      const res = await fetch(
        `/api/availability?${new URLSearchParams({ slug, date: bookDate })}`,
      );
      const data = await res.json();
      if (!cancelled) {
        setBookSlots(data.slots || []);
        if (typeof data.slotMinutes === "number" && data.slotMinutes > 0) {
          setSlotMinutes(data.slotMinutes);
        }
        setBookTime("");
      }
    }
    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [bookDate, slug]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`/${slug}/login`);
  }

  async function saveSmsSettings(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/field/sms-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: ownerPhone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل حفظ إعدادات SMS");
      return;
    }
    setOwnerPhone(data.phone || "");
    setMessage("تم حفظ رقم التنبيه");
  }

  async function addScheduleWindow(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/field/extra-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: scheduleDate,
        startTime: scheduleStart,
        endTime: scheduleEnd,
        note: scheduleNote,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل إضافة الفترة");
      return;
    }
    setScheduleDate("");
    setScheduleNote("");
    setMessage("أُضيفت الفترة إلى الجدول");
    load();
  }

  async function removeScheduleWindow(id: string) {
    await fetch("/api/field/extra-hours", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function addDayOff(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/field/days-off", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: offDate, note: offNote }),
    });
    if (!res.ok) {
      setError("فشل إضافة يوم إغلاق");
      return;
    }
    setOffDate("");
    setOffNote("");
    setMessage("أُضيف يوم إغلاق");
    load();
  }

  async function removeDayOff(id: string) {
    await fetch("/api/field/days-off", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function cancelBooking(id: string) {
    if (!confirm("إلغاء الحجز؟ سيُرسل SMS للزبون.")) return;
    await fetch("/api/field/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMessage("أُلغي الحجز وأُرسل إشعار للزبون");
    load();
  }

  async function adminBook(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/field/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: bookDate,
        time: bookTime,
        customerName: bookName,
        customerPhone: bookPhone,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل الحجز");
      return;
    }
    setMessage("أُضيف الحجز وأُكّد");
    setBookName("");
    setBookPhone("");
    setBookTime("");
    load();
  }

  const tabs = [
    { id: "bookings" as const, label: "حجوزات" },
    { id: "book" as const, label: "إضافة حجز" },
    { id: "schedule" as const, label: "جدول الساعات" },
    { id: "daysOff" as const, label: "أيام الإغلاق" },
    { id: "sms" as const, label: "SMS" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <BrandMark tone="light" />
        <div className="flex gap-2">
          <Link
            href={`/${slug}`}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm"
          >
            الصفحة العامة
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm"
          >
            خروج
          </button>
        </div>
      </div>

      <h1 className="font-display text-3xl text-[var(--cream)]">{displayName}</h1>
      <p className="mt-1 text-sm text-[rgba(244,248,238,0.62)]">إدارة الملعب</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shop-chip rounded-xl px-4 py-2 text-sm ${
              tab === t.id ? "shop-chip-active" : ""
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-950/70 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-4 text-sm text-[var(--lime)]">{message}</p> : null}

      {loading ? <p className="mt-6">جارٍ التحميل…</p> : null}

      {tab === "bookings" && !loading ? (
        <div className="mt-6 space-y-3">
          {bookings.length === 0 ? (
            <p className="text-sm text-[rgba(244,248,238,0.62)]">لا حجوزات قريبة.</p>
          ) : (
            bookings.map((b) => (
              <div
                key={b.id}
                className="surface-dark flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">
                    {formatDateHe(new Date(b.startsAt))} · {formatTime(new Date(b.startsAt))}
                  </p>
                  <p className="text-sm text-[rgba(244,248,238,0.62)]">
                    {b.customerName} · {b.customerPhone || "بدون هاتف"} ·{" "}
                    {b.status === "HOLD" ? "بانتظار تأكيد SMS" : "مؤكَّد"}
                  </p>
                </div>
                <button
                  type="button"
                  className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                  onClick={() => cancelBooking(b.id)}
                >
                  إلغاء
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "book" ? (
        <form onSubmit={adminBook} className="surface-dark mt-6 space-y-4 rounded-2xl p-5">
          <p className="text-sm text-[rgba(244,248,238,0.62)]">
            الحجز المُضاف من هنا يُعتمد فورًا، بدون SMS.
          </p>
          <input
            type="date"
            className="shop-field w-full rounded-xl px-3 py-2.5"
            value={bookDate}
            onChange={(e) => setBookDate(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {bookSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setBookTime(slot)}
                className={`shop-chip rounded-xl px-3 py-2 text-sm ${
                  bookTime === slot ? "shop-chip-active" : ""
                }`}
              >
                {formatSlotRange(slot, slotMinutes)}
              </button>
            ))}
          </div>
          <input
            className="shop-field w-full rounded-xl px-3 py-2.5"
            placeholder="اسم الزبون"
            value={bookName}
            onChange={(e) => setBookName(e.target.value)}
            required
          />
          <input
            className="shop-field w-full rounded-xl px-3 py-2.5"
            placeholder="هاتف (اختياري)"
            value={bookPhone}
            onChange={(e) => setBookPhone(e.target.value)}
          />
          <button
            type="submit"
            disabled={!bookTime}
            className="btn-primary w-full rounded-xl py-3 font-semibold"
          >
            حفظ مؤكَّد
          </button>
        </form>
      ) : null}

      {tab === "schedule" ? (
        <div className="mt-6 space-y-4">
          <form onSubmit={addScheduleWindow} className="surface-dark space-y-3 rounded-2xl p-5">
            <p className="text-sm text-[rgba(244,248,238,0.62)]">
              ابنوا الجدول يومًا بيوم: اختاروا تاريخًا وأضيفوا فترات (مثلاً 18:00–21:00).
              الزبائن يحجزون بفترات ثابتة {slotMinutes} دقيقة — مثل 18:00–19:30 و19:30–21:00.
              يمكن إضافة أكثر من فترة في نفس اليوم بدون تداخل، مثل 18:00–19:30 و20:00–21:30.
              الجدول خاص بكل تاريخ ولا يتكرر للأسبوع التالي تلقائيًا.
            </p>
            <input
              type="date"
              className="shop-field w-full rounded-xl px-3 py-2.5"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                من
                <input
                  type="time"
                  className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                حتى
                <input
                  type="time"
                  className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  required
                />
              </label>
            </div>
            <input
              className="shop-field w-full rounded-xl px-3 py-2.5"
              placeholder="ملاحظة (اختياري)"
              value={scheduleNote}
              onChange={(e) => setScheduleNote(e.target.value)}
            />
            <button type="submit" className="btn-primary w-full rounded-xl py-3 font-semibold">
              إضافة فترة
            </button>
          </form>
          {schedule.length === 0 ? (
            <p className="text-sm text-[rgba(244,248,238,0.62)]">
              لا فترات في الجدول بعد. أضيفوا تواريخًا ليظهر الحجز للزبائن.
            </p>
          ) : (
            schedule.map((row) => (
              <div
                key={row.id}
                className="surface-dark flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">
                    {formatDateHe(combineDateAndTime(row.date, "12:00"))} · {row.startTime}–
                    {row.endTime}
                  </p>
                  {row.note ? (
                    <p className="text-sm text-[rgba(244,248,238,0.62)]">{row.note}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                  onClick={() => removeScheduleWindow(row.id)}
                >
                  حذف
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "daysOff" ? (
        <div className="mt-6 space-y-4">
          <form onSubmit={addDayOff} className="surface-dark space-y-3 rounded-2xl p-5">
            <input
              type="date"
              className="shop-field w-full rounded-xl px-3 py-2.5"
              value={offDate}
              onChange={(e) => setOffDate(e.target.value)}
              required
            />
            <input
              className="shop-field w-full rounded-xl px-3 py-2.5"
              placeholder="ملاحظة (اختياري)"
              value={offNote}
              onChange={(e) => setOffNote(e.target.value)}
            />
            <button type="submit" className="btn-primary w-full rounded-xl py-3 font-semibold">
              إغلاق يوم
            </button>
          </form>
          {dayOffs.map((d) => (
            <div
              key={d.id}
              className="surface-dark flex items-center justify-between rounded-2xl p-4"
            >
              <p>
                {formatDateHe(
                  combineDateAndTime(dbDateToDateKey(new Date(d.date)), "12:00"),
                )}
                {d.note ? ` · ${d.note}` : ""}
              </p>
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                onClick={() => removeDayOff(d.id)}
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "sms" ? (
        <form onSubmit={saveSmsSettings} className="surface-dark mt-6 space-y-4 rounded-2xl p-5">
          <p className="text-sm text-[rgba(244,248,238,0.62)]">
            حد SMS شهري:{" "}
            {smsMonthlyLimit > 0 ? String(smsMonthlyLimit) : "بدون حد"} · المتبقي لهذا الشهر:{" "}
            {smsMonthlyRemaining == null ? "غير محدود" : String(smsMonthlyRemaining)}
            {smsMonthlyLimit > 0 ? ` · استخدمت ${smsMonthlyUsed}` : ""}
          </p>
          <p className="text-sm text-[rgba(244,248,238,0.62)]">
            رقم هاتف صاحب الملعب. عند إلغاء حجز مؤكَّد تُرسل رسالة تنبيه إلى هذا الرقم.
            {smsPlanEnabled ? "" : " خدمة SMS غير مفعّلة لهذا الملعب من الإدارة."}
          </p>
          <label className="block text-sm">
            رقم التنبيه
            <input
              className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              inputMode="tel"
              placeholder="0500000000"
            />
          </label>
          <button type="submit" className="btn-primary w-full rounded-xl py-3 font-semibold">
            حفظ رقم SMS
          </button>
        </form>
      ) : null}
    </div>
  );
}
