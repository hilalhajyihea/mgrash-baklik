"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandGraphics";
import { combineDateAndTime, formatDateHe, toDateKey } from "@/lib/time";

type Props = {
  slug: string;
  displayName: string;
  logoUrl?: string | null;
};

export function BookingCalendar({ slug, displayName, logoUrl }: Props) {
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
        setError(data.error || "فشل الحجز");
        return;
      }

      if (data.sms?.ok && !data.sms?.skipped) {
        setSuccess(
          `أُرسلت إليكم رسالة SMS. اضغطوا على الرابط خلال 15 دقيقة لتأكيد ${formatDateHe(combineDateAndTime(date, "12:00"))} الساعة ${time}.`,
        );
      } else {
        setSuccess(
          `حُفظت الساعة مؤقتًا لـ ${formatDateHe(combineDateAndTime(date, "12:00"))} الساعة ${time}. أكّدوا عبر الرابط أدناه.`,
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
      setError("خطأ في الشبكة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="shop-shell relative min-h-[100svh]">
      <section className="relative isolate overflow-hidden px-4 py-5 sm:px-6">
        <div className="glass-nav mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl px-4 py-3">
          <BrandMark tone="light" />
          <Link
            href={`/${slug}/login`}
            className="shrink-0 rounded-xl border border-white/25 bg-black/35 px-4 py-2 text-sm font-semibold text-[var(--cream)] backdrop-blur-sm transition hover:bg-black/50"
          >
            إدارة
          </Link>
        </div>

        <header className="animate-fade-up mx-auto max-w-3xl pb-10 pt-16 sm:pb-14 sm:pt-24">
          <p className="text-xs font-semibold tracking-[0.28em] text-[var(--lime)]">
            حجز ملعب
          </p>
          {logoUrl ? (
            <div className="mt-5 flex w-full justify-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={displayName}
                className="h-auto max-h-24 w-auto max-w-[min(100%,22rem)] object-contain object-right drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)] sm:max-h-32"
              />
            </div>
          ) : (
            <h1 className="font-display mt-3 max-w-xl text-4xl leading-[1.08] text-[var(--cream)] sm:text-6xl">
              {displayName}
            </h1>
          )}
          <div className="flood-line mt-5" />
          <p className="mt-4 max-w-md text-base text-[rgba(244,248,238,0.82)] sm:text-lg">
            اختاروا التاريخ والساعة، وأدخلوا الاسم والهاتف. الحجز يكون نهائي بعد الضغط على الرابط الذي سيصلكم عبر SMS.
          </p>
        </header>
      </section>

      <div className="relative -mt-4 pb-14 sm:pb-20">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <form
            onSubmit={onSubmit}
            className="surface-dark animate-fade-up rounded-2xl p-5 sm:p-7"
          >
            <h2 className="text-lg font-semibold text-[var(--cream)]">التاريخ</h2>
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

            <h2 className="mt-6 text-lg font-semibold text-[var(--cream)]">الساعة</h2>
            {loadingSlots ? (
              <p className="mt-3 text-sm text-[rgba(244,248,238,0.62)]">جارٍ تحميل الساعات…</p>
            ) : slots.length === 0 ? (
              <p className="mt-3 text-sm text-[rgba(244,248,238,0.62)]">
                لا توجد ساعات متاحة في هذا اليوم.
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
              الاسم
              <input
                className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-[var(--cream)]">
              الهاتف
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
                  اضغطوا هنا لتأكيد الحجز
                </Link>
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !time}
              className="btn-primary mt-6 w-full rounded-xl py-3 font-semibold"
            >
              {submitting ? "جارٍ الحفظ…" : "حفظ الساعة"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
