"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandGraphics";
import { combineDateAndTime, formatDateHe, toDateKey } from "@/lib/time";

type Props = {
  slug: string;
  displayName: string;
};

export function BookingCalendar({ slug, displayName }: Props) {
  const dates = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const todayKey = toDateKey();
    for (let i = 0; i < 14; i++) {
      const noon = combineDateAndTime(todayKey, "12:00");
      const d = new Date(noon.getTime() + i * 24 * 60 * 60 * 1000);
      const key = toDateKey(d);
      list.push({ key, label: formatDateHe(d) });
    }
    return list;
  }, []);

  const [date, setDate] = useState(dates[0]?.key || "");
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmUrl, setConfirmUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingSlots(true);
      setTime("");
      setError("");
      try {
        const params = new URLSearchParams({ slug, date });
        const res = await fetch(`/api/availability?${params.toString()}`);
        const data = await res.json();
        if (!cancelled) setSlots(data.slots || []);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    if (date) load();
    return () => {
      cancelled = true;
    };
  }, [slug, date]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setConfirmUrl("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          date,
          time,
          customerName: name,
          customerPhone: phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "השריון נכשל");
        return;
      }

      if (data.sms?.ok && !data.sms?.skipped) {
        setSuccess(
          `נשלח אליכם SMS. לחצו על הקישור תוך 15 דקות כדי לאשר את ${formatDateHe(combineDateAndTime(date, "12:00"))} בשעה ${time}.`,
        );
      } else {
        setSuccess(
          `השעה נשמרה זמנית ל-${formatDateHe(combineDateAndTime(date, "12:00"))} בשעה ${time}. אשרו בקישור למטה.`,
        );
        if (data.confirmUrl) setConfirmUrl(data.confirmUrl);
        if (data.sms?.error && !data.sms?.skipped) setError(data.sms.error);
      }
      setName("");
      setPhone("");
      setTime("");
      const refresh = await fetch(
        `/api/availability?${new URLSearchParams({ slug, date }).toString()}`,
      );
      const refreshed = await refresh.json();
      setSlots(refreshed.slots || []);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="shop-shell relative min-h-[100svh]">
      <section className="relative isolate overflow-hidden px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <BrandMark tone="light" />
          <Link
            href={`/${slug}/login`}
            className="shrink-0 rounded-xl border border-white/25 bg-black/35 px-4 py-2 text-sm font-semibold text-[var(--cream)] backdrop-blur-sm transition hover:bg-black/50"
          >
            ניהול
          </Link>
        </div>

        <header className="animate-fade-up mx-auto max-w-3xl pb-10 pt-16 sm:pb-14 sm:pt-20">
          <p className="text-xs font-semibold tracking-[0.22em] text-[rgba(244,248,238,0.78)]">
            שריון מגרש
          </p>
          <h1 className="font-display mt-3 max-w-xl text-4xl leading-[1.08] text-[var(--cream)] sm:text-6xl">
            {displayName}
          </h1>
          <div className="mt-5 h-0.5 w-16 bg-[var(--lime)]" />
          <p className="mt-4 max-w-md text-base text-[rgba(244,248,238,0.82)] sm:text-lg">
            בחרו תאריך ושעה, הזינו שם וטלפון. השריון ייסגר רק אחרי לחיצה על קישור ב-SMS.
          </p>
        </header>
      </section>

      <div className="relative -mt-4 pb-14 sm:pb-20">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <form
            onSubmit={onSubmit}
            className="surface-dark animate-fade-up rounded-2xl p-5 sm:p-7"
          >
            <h2 className="text-lg font-semibold text-[var(--cream)]">תאריך</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {dates.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDate(d.key)}
                  className={`shop-chip shrink-0 rounded-xl px-3 py-2 text-sm ${
                    date === d.key ? "shop-chip-active" : ""
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <h2 className="mt-6 text-lg font-semibold text-[var(--cream)]">שעה</h2>
            {loadingSlots ? (
              <p className="mt-3 text-sm text-[rgba(244,248,238,0.62)]">טוען שעות…</p>
            ) : slots.length === 0 ? (
              <p className="mt-3 text-sm text-[rgba(244,248,238,0.62)]">
                אין שעות פנויות ביום זה.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={`shop-chip rounded-xl px-3 py-2 text-sm ${
                      time === slot ? "shop-chip-active" : ""
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}

            <label className="mt-6 block text-sm font-medium text-[var(--cream)]">
              שם
              <input
                className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-[var(--cream)]">
              טלפון
              <input
                className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
              />
            </label>

            {error ? (
              <p className="mt-4 rounded-lg border border-red-400/30 bg-red-950/70 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="mt-4 rounded-lg border border-[var(--lime)]/30 bg-[rgba(200,230,78,0.12)] px-3 py-2 text-sm text-[var(--lime)]">
                {success}
              </p>
            ) : null}
            {confirmUrl ? (
              <p className="mt-3 text-sm">
                <Link href={confirmUrl} className="underline text-[var(--lime)]">
                  לחצו כאן לאישור השריון
                </Link>
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !time}
              className="btn-primary mt-6 w-full rounded-xl py-3 font-semibold"
            >
              {submitting ? "שומרים…" : "שמירת שעה"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
