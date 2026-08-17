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

type HourRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled: boolean;
};

type DayOff = {
  id: string;
  date: string;
  note: string | null;
};

const defaultHours = (): HourRow[] =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: dayOfWeek === 6 ? "08:00" : "16:00",
    endTime: dayOfWeek === 5 ? "22:00" : dayOfWeek === 6 ? "22:00" : "23:00",
    enabled: true,
  }));

const blankHours = (): HourRow[] =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: "16:00",
    endTime: "23:00",
    enabled: false,
  }));

export function FieldAdminPanel({
  slug,
  displayName,
}: {
  slug: string;
  displayName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"bookings" | "book" | "hours" | "daysOff">(
    "bookings",
  );
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hours, setHours] = useState<HourRow[]>(defaultHours());
  const [dayOffs, setDayOffs] = useState<DayOff[]>([]);
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
      const [bRes, hRes, dRes] = await Promise.all([
        fetch("/api/field/bookings"),
        fetch("/api/field/hours"),
        fetch("/api/field/days-off"),
      ]);
      if (bRes.status === 401) {
        router.push(`/${slug}/login`);
        return;
      }
      const bData = await bRes.json();
      const hData = await hRes.json();
      const dData = await dRes.json();
      setBookings(bData.bookings || []);
      const next = blankHours();
      for (const row of hData.hours || []) {
        next[row.dayOfWeek] = {
          dayOfWeek: row.dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
          enabled: true,
        };
      }
      setHours(next);
      setDayOffs(dData.dayOffs || []);
    } catch {
      setError("שגיאה בטעינה");
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
      setError(data.error || "שמירת שעות נכשלה");
      return;
    }
    setMessage("שעות ההשכרה נשמרו");
  }

  async function addDayOff(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/field/days-off", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: offDate, note: offNote }),
    });
    if (!res.ok) {
      setError("הוספת יום סגור נכשלה");
      return;
    }
    setOffDate("");
    setOffNote("");
    setMessage("יום סגור נוסף");
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
    if (!confirm("לבטל את השריון?")) return;
    await fetch("/api/field/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMessage("השריון בוטל");
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
      setError(data.error || "שריון נכשל");
      return;
    }
    setMessage("השריון נוסף ואושר");
    setBookName("");
    setBookPhone("");
    setBookTime("");
    load();
  }

  const tabs = [
    { id: "bookings" as const, label: "שריונים" },
    { id: "book" as const, label: "הוספת שריון" },
    { id: "hours" as const, label: "שעות השכרה" },
    { id: "daysOff" as const, label: "ימים סגורים" },
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
            דף ציבורי
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm"
          >
            יציאה
          </button>
        </div>
      </div>

      <h1 className="font-display text-3xl text-[var(--cream)]">{displayName}</h1>
      <p className="mt-1 text-sm text-[rgba(244,248,238,0.62)]">ניהול מגרש</p>

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

      {loading ? <p className="mt-6">טוען…</p> : null}

      {tab === "bookings" && !loading ? (
        <div className="mt-6 space-y-3">
          {bookings.length === 0 ? (
            <p className="text-sm text-[rgba(244,248,238,0.62)]">אין שריונים קרובים.</p>
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
                    {b.customerName} · {b.customerPhone || "בלי טלפון"} ·{" "}
                    {b.status === "HOLD" ? "ממתין לאישור SMS" : "מאושר"}
                  </p>
                </div>
                <button
                  type="button"
                  className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                  onClick={() => cancelBooking(b.id)}
                >
                  ביטול
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "book" ? (
        <form onSubmit={adminBook} className="surface-dark mt-6 space-y-4 rounded-2xl p-5">
          <p className="text-sm text-[rgba(244,248,238,0.62)]">
            שריון שנוסף מכאן מאושר מיד, בלי SMS.
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
            placeholder="שם לקוח"
            value={bookName}
            onChange={(e) => setBookName(e.target.value)}
            required
          />
          <input
            className="shop-field w-full rounded-xl px-3 py-2.5"
            placeholder="טלפון (אופציונלי)"
            value={bookPhone}
            onChange={(e) => setBookPhone(e.target.value)}
          />
          <button
            type="submit"
            disabled={!bookTime}
            className="btn-primary w-full rounded-xl py-3 font-semibold"
          >
            שמירה מאושרת
          </button>
        </form>
      ) : null}

      {tab === "hours" ? (
        <form onSubmit={saveHours} className="surface-dark mt-6 space-y-3 rounded-2xl p-5">
          {hours.map((h) => (
            <div
              key={h.dayOfWeek}
              className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2"
            >
              <label className="text-sm">{dayName(h.dayOfWeek)}</label>
              <input
                type="time"
                className="shop-field rounded-xl px-2 py-2"
                value={h.startTime}
                onChange={(e) =>
                  setHours((rows) =>
                    rows.map((r) =>
                      r.dayOfWeek === h.dayOfWeek
                        ? { ...r, startTime: e.target.value }
                        : r,
                    ),
                  )
                }
              />
              <input
                type="time"
                className="shop-field rounded-xl px-2 py-2"
                value={h.endTime}
                onChange={(e) =>
                  setHours((rows) =>
                    rows.map((r) =>
                      r.dayOfWeek === h.dayOfWeek
                        ? { ...r, endTime: e.target.value }
                        : r,
                    ),
                  )
                }
              />
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) =>
                    setHours((rows) =>
                      rows.map((r) =>
                        r.dayOfWeek === h.dayOfWeek
                          ? { ...r, enabled: e.target.checked }
                          : r,
                      ),
                    )
                  }
                />{" "}
                פתוח
              </label>
            </div>
          ))}
          <button type="submit" className="btn-primary w-full rounded-xl py-3 font-semibold">
            שמירת שעות
          </button>
        </form>
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
              placeholder="הערה (אופציונלי)"
              value={offNote}
              onChange={(e) => setOffNote(e.target.value)}
            />
            <button type="submit" className="btn-primary w-full rounded-xl py-3 font-semibold">
              סגירת יום
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
                הסרה
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
