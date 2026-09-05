"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatDateHe, toDateKey } from "@/lib/time";

type Entry = {
  id: string;
  displayName: string;
  phoneKey: string;
  points: number;
};

type CompetitionRow = {
  id: string;
  title: string;
  goalPoints: number;
  prizeText: string;
  endsAt: string;
  status: string;
  winnerName: string | null;
  winnerPhone: string | null;
  wonAt: string | null;
  prizeRedeemed: boolean;
  entryCount: number;
  entries: Entry[];
};

export function CompetitionAdminPanel({
  onMessage,
  onError,
}: {
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [rows, setRows] = useState<CompetitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [goalPoints, setGoalPoints] = useState("5");
  const [prizeText, setPrizeText] = useState("");
  const [endsAtDate, setEndsAtDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/field/competition");
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || "فشل تحميل المسابقات");
        return;
      }
      setRows(data.competitions || []);
    } catch {
      onError("خطأ في تحميل المسابقات");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function createCompetition(e: FormEvent) {
    e.preventDefault();
    onError("");
    const res = await fetch("/api/field/competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        goalPoints: Number(goalPoints),
        prizeText,
        endsAtDate,
        activate: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      onError(data.error || "فشل إنشاء المسابقة");
      return;
    }
    setTitle("");
    setPrizeText("");
    setEndsAtDate("");
    setGoalPoints("5");
    onMessage("أُنشئت المسابقة وفُعّلت");
    load();
  }

  async function patch(body: Record<string, unknown>, okMsg: string) {
    onError("");
    const res = await fetch("/api/field/competition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      onError(data.error || "فشل التحديث");
      return;
    }
    onMessage(okMsg);
    load();
  }

  return (
    <div className="mt-6 space-y-4">
      <form onSubmit={createCompetition} className="surface-dark space-y-3 rounded-2xl p-5">
        <p className="text-sm text-[rgba(244,248,238,0.62)]">
          مسابقة النقاط: كل حجز مؤكَّد = نقطة واحدة حسب رقم الهاتف. أول من يصل
          للهدف يفوز وتنتهي المسابقة. يظهر عدّاد تنازلي في الصفحة العامة.
        </p>
        <input
          className="shop-field w-full rounded-xl px-3 py-2.5"
          placeholder="عنوان المسابقة"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          type="number"
          min={1}
          max={100}
          className="shop-field w-full rounded-xl px-3 py-2.5"
          placeholder="الهدف (نقاط)"
          value={goalPoints}
          onChange={(e) => setGoalPoints(e.target.value)}
          required
        />
        <input
          className="shop-field w-full rounded-xl px-3 py-2.5"
          placeholder="الجائزة (مثلاً خصم 50% على الحجز القادم)"
          value={prizeText}
          onChange={(e) => setPrizeText(e.target.value)}
          required
        />
        <label className="block text-sm">
          تاريخ الانتهاء
          <input
            type="date"
            className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
            value={endsAtDate}
            min={toDateKey()}
            onChange={(e) => setEndsAtDate(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn-primary w-full rounded-xl py-3 font-semibold">
          إنشاء مسابقة وتفعيلها
        </button>
      </form>

      {loading ? <p className="text-sm">جارٍ التحميل…</p> : null}

      {rows.map((c) => (
        <div key={c.id} className="surface-dark space-y-3 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{c.title}</p>
              <p className="text-sm text-[rgba(244,248,238,0.62)]">
                الهدف {c.goalPoints} · ينتهي{" "}
                {formatDateHe(new Date(new Date(c.endsAt).getTime() - 1000))} ·{" "}
                {c.status}
                {c.winnerName ? ` · الفائز: ${c.winnerName}` : ""}
              </p>
              <p className="mt-1 text-sm text-[rgba(244,248,238,0.78)]">
                الجائزة: {c.prizeText}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.status === "ACTIVE" ? (
                <button
                  type="button"
                  className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                  onClick={() => patch({ id: c.id, status: "PAUSED" }, "أُوقفت المسابقة")}
                >
                  إيقاف
                </button>
              ) : null}
              {c.status === "PAUSED" || c.status === "DRAFT" ? (
                <button
                  type="button"
                  className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                  onClick={() => patch({ id: c.id, status: "ACTIVE" }, "فُعّلت المسابقة")}
                >
                  تفعيل
                </button>
              ) : null}
              {c.status !== "ENDED" ? (
                <button
                  type="button"
                  className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                  onClick={() => patch({ id: c.id, status: "ENDED" }, "أُنهيت المسابقة")}
                >
                  إنهاء
                </button>
              ) : null}
              {c.status === "ENDED" && c.winnerName ? (
                <button
                  type="button"
                  className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                  onClick={() =>
                    patch(
                      { id: c.id, prizeRedeemed: !c.prizeRedeemed },
                      c.prizeRedeemed ? "أُلغيت علامة التسليم" : "سُجّل تسليم الجائزة",
                    )
                  }
                >
                  {c.prizeRedeemed ? "الجائزة سُلّمت ✓" : "تسليم الجائزة"}
                </button>
              ) : null}
            </div>
          </div>

          {c.entries.length === 0 ? (
            <p className="text-sm text-[rgba(244,248,238,0.55)]">لا مشاركين بعد.</p>
          ) : (
            <ul className="space-y-2">
              {c.entries.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-medium">{e.displayName}</p>
                    <p className="text-[rgba(244,248,238,0.55)]">
                      {e.phoneKey} · {e.points}/{c.goalPoints}
                    </p>
                  </div>
                  {c.status === "ACTIVE" || c.status === "PAUSED" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                        onClick={() =>
                          patch(
                            { id: c.id, adjustEntryId: e.id, adjustDelta: 1 },
                            "أُضيفت نقطة",
                          )
                        }
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                        onClick={() =>
                          patch(
                            { id: c.id, adjustEntryId: e.id, adjustDelta: -1 },
                            "خُصمت نقطة",
                          )
                        }
                      >
                        −1
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
