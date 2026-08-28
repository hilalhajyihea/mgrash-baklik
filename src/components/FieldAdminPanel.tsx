"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandGraphics";
import {
  combineDateAndTime,
  dbDateToDateKey,
  dayName,
  formatDateHe,
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

type HourWindow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type DayOff = {
  id: string;
  date: string;
  note: string | null;
};

type ExtraHoursRow = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string | null;
};

const defaultHours = (): HourWindow[] =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: dayOfWeek === 6 ? "08:00" : "16:00",
    endTime: dayOfWeek === 5 ? "22:00" : dayOfWeek === 6 ? "22:00" : "23:00",
  }));

export function FieldAdminPanel({
  slug,
  displayName,
}: {
  slug: string;
  displayName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "bookings" | "book" | "hours" | "extraHours" | "daysOff" | "sms"
  >("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hours, setHours] = useState<HourWindow[]>(defaultHours());
  const [ownerPhone, setOwnerPhone] = useState("");
  const [smsPlanEnabled, setSmsPlanEnabled] = useState(false);
  const [dayOffs, setDayOffs] = useState<DayOff[]>([]);
  const [extraHours, setExtraHours] = useState<ExtraHoursRow[]>([]);
  const [extraDate, setExtraDate] = useState("");
  const [extraStart, setExtraStart] = useState("15:00");
  const [extraEnd, setExtraEnd] = useState("16:30");
  const [extraNote, setExtraNote] = useState("");
  const [offDate, setOffDate] = useState("");
  const [offNote, setOffNote] = useState("");
  const [bookDate, setBookDate] = useState(toDateKey());
  const [bookTime, setBookTime] = useState("");
  const [bookName, setBookName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookSlots, setBookSlots] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, hRes, dRes, eRes, sRes] = await Promise.all([
        fetch("/api/field/bookings"),
        fetch("/api/field/hours"),
        fetch("/api/field/days-off"),
        fetch("/api/field/extra-hours"),
        fetch("/api/field/sms-settings"),
      ]);
      if (bRes.status === 401) {
        router.push(`/${slug}/login`);
        return;
      }
      const bData = await bRes.json();
      const hData = await hRes.json();
      const dData = await dRes.json();
      const eData = await eRes.json();
      const sData = await sRes.json();
      setBookings(bData.bookings || []);
      setHours(
        (hData.hours || []).map((row: HourWindow) => ({
          dayOfWeek: row.dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
        })),
      );
      setDayOffs(dData.dayOffs || []);
      setExtraHours(eData.extraHours || []);
      setOwnerPhone(sData.phone || "");
      setSmsPlanEnabled(!!sData.smsPlanEnabled);
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

  async function saveHours(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/field/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل حفظ الساعات");
      return;
    }
    setMessage("تم حفظ ساعات التأجير");
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

  function addHourWindow(dayOfWeek: number) {
    setHours((rows) => [
      ...rows,
      { dayOfWeek, startTime: "16:00", endTime: "17:00" },
    ]);
  }

  function removeHourWindow(dayOfWeek: number, indexInDay: number) {
    setHours((rows) => {
      let seen = 0;
      return rows.filter((row) => {
        if (row.dayOfWeek !== dayOfWeek) return true;
        const keep = seen !== indexInDay;
        seen += 1;
        return keep;
      });
    });
  }

  function updateHourWindow(
    dayOfWeek: number,
    indexInDay: number,
    patch: Partial<Pick<HourWindow, "startTime" | "endTime">>,
  ) {
    setHours((rows) => {
      let seen = 0;
      return rows.map((row) => {
        if (row.dayOfWeek !== dayOfWeek) return row;
        const current = seen;
        seen += 1;
        return current === indexInDay ? { ...row, ...patch } : row;
      });
    });
  }

  async function addExtraHours(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/field/extra-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: extraDate,
        startTime: extraStart,
        endTime: extraEnd,
        note: extraNote,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "فشل إضافة الفترة");
      return;
    }
    setExtraDate("");
    setExtraNote("");
    setMessage("أُضيفت فترة لمرة واحدة");
    load();
  }

  async function removeExtraHours(id: string) {
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
    { id: "hours" as const, label: "ساعات التأجير" },
    { id: "extraHours" as const, label: "فترات لمرة واحدة" },
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
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {bookSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setBookTime(slot)}
                className={`shop-chip rounded-xl px-3 py-2 text-sm ${
                  bookTime === slot ? "shop-chip-active" : ""
                }`}
              >
                {slot}
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

      {tab === "hours" ? (
        <form onSubmit={saveHours} className="surface-dark mt-6 space-y-5 rounded-2xl p-5">
          <p className="text-sm text-[rgba(244,248,238,0.62)]">
            يمكن إضافة أكثر من فترة في نفس اليوم، مثل 14:00–15:30 و22:00–23:30.
            لإنهاء الفترة عند منتصف الليل اكتبوا 23:00 حتى 00:00.
          </p>
          {Array.from({ length: 7 }, (_, dayOfWeek) => {
            const windows = hours.filter((h) => h.dayOfWeek === dayOfWeek);
            return (
              <div key={dayOfWeek} className="border-b border-white/10 pb-4 last:border-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold">{dayName(dayOfWeek)}</p>
                  <button
                    type="button"
                    className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                    onClick={() => addHourWindow(dayOfWeek)}
                  >
                    إضافة فترة
                  </button>
                </div>
                {windows.length === 0 ? (
                  <p className="text-sm text-[rgba(244,248,238,0.5)]">مغلق</p>
                ) : (
                  <div className="space-y-2">
                    {windows.map((h, indexInDay) => (
                      <div
                        key={`${dayOfWeek}-${indexInDay}`}
                        className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
                      >
                        <input
                          type="time"
                          className="shop-field rounded-xl px-2 py-2"
                          value={h.startTime}
                          onChange={(e) =>
                            updateHourWindow(dayOfWeek, indexInDay, {
                              startTime: e.target.value,
                            })
                          }
                        />
                        <input
                          type="time"
                          className="shop-field rounded-xl px-2 py-2"
                          value={h.endTime}
                          onChange={(e) =>
                            updateHourWindow(dayOfWeek, indexInDay, {
                              endTime: e.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          className="shop-chip rounded-xl px-3 py-2 text-sm"
                          onClick={() => removeHourWindow(dayOfWeek, indexInDay)}
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button type="submit" className="btn-primary w-full rounded-xl py-3 font-semibold">
            حفظ الساعات
          </button>
        </form>
      ) : null}

      {tab === "extraHours" ? (
        <div className="mt-6 space-y-4">
          <form onSubmit={addExtraHours} className="surface-dark space-y-3 rounded-2xl p-5">
            <p className="text-sm text-[rgba(244,248,238,0.62)]">
              أضيفوا ساعات تأجير لتاريخ محدّد، بالإضافة إلى جدول الأسبوع. مثلاً
              يوم عطلة عندكم إيقاف لكن في تاريخ معيّن الملعب متاح من 15:00 حتى
              16:30.
            </p>
            <input
              type="date"
              className="shop-field w-full rounded-xl px-3 py-2.5"
              value={extraDate}
              onChange={(e) => setExtraDate(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                من
                <input
                  type="time"
                  className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
                  value={extraStart}
                  onChange={(e) => setExtraStart(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                حتى
                <input
                  type="time"
                  className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
                  value={extraEnd}
                  onChange={(e) => setExtraEnd(e.target.value)}
                  required
                />
              </label>
            </div>
            <input
              className="shop-field w-full rounded-xl px-3 py-2.5"
              placeholder="ملاحظة (اختياري)"
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
            />
            <button type="submit" className="btn-primary w-full rounded-xl py-3 font-semibold">
              إضافة فترة
            </button>
          </form>
          {extraHours.length === 0 ? (
            <p className="text-sm text-[rgba(244,248,238,0.62)]">لا فترات إضافية قادمة.</p>
          ) : (
            extraHours.map((row) => (
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
                  onClick={() => removeExtraHours(row.id)}
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
