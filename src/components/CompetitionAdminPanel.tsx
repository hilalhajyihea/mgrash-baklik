"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatDateHe, toDateKey } from "@/lib/time";

type Entry = {
  id: string;
  displayName: string;
  phoneKey: string;
  points: number;
};

type WinMode = "FIRST" | "ALL_WHO_REACH";

type CompetitionRow = {
  id: string;
  title: string;
  goalPoints: number;
  prizeText: string;
  endsAt: string;
  endsAtDate: string;
  status: string;
  winMode: WinMode;
  winnerName: string | null;
  winnerPhone: string | null;
  wonAt: string | null;
  prizeRedeemed: boolean;
  entryCount: number;
  entries: Entry[];
};

function winModeLabel(mode: WinMode) {
  return mode === "ALL_WHO_REACH"
    ? "كل من يصل للهدف"
    : "أول من يصل للهدف";
}

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
  const [winMode, setWinMode] = useState<WinMode>("FIRST");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editGoal, setEditGoal] = useState("5");
  const [editPrize, setEditPrize] = useState("");
  const [editEnds, setEditEnds] = useState("");
  const [editWinMode, setEditWinMode] = useState<WinMode>("FIRST");

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
        winMode,
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
    setWinMode("FIRST");
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

  function startEdit(c: CompetitionRow) {
    setEditingId(c.id);
    setEditTitle(c.title);
    setEditGoal(String(c.goalPoints));
    setEditPrize(c.prizeText);
    setEditEnds(c.endsAtDate || toDateKey(new Date(new Date(c.endsAt).getTime() - 1000)));
    setEditWinMode(c.winMode || "FIRST");
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    await patch(
      {
        id: editingId,
        title: editTitle,
        goalPoints: Number(editGoal),
        prizeText: editPrize,
        endsAtDate: editEnds,
        winMode: editWinMode,
      },
      "تم حفظ تعديلات المسابقة",
    );
    setEditingId(null);
  }

  async function deleteCompetition(c: CompetitionRow) {
    if (
      !confirm(
        `حذف مسابقة «${c.title}» نهائيًا؟ ستختفي من الإدارة والصفحة العامة.`,
      )
    ) {
      return;
    }
    onError("");
    const res = await fetch("/api/field/competition", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      onError(data.error || "فشل الحذف");
      return;
    }
    onMessage(`حُذفت المسابقة: ${c.title}`);
    load();
  }

  const canRedeemPrize = (c: CompetitionRow) => {
    if (c.winMode === "ALL_WHO_REACH") {
      return c.entries.some((e) => e.points >= c.goalPoints);
    }
    return c.status === "ENDED" && Boolean(c.winnerName);
  };

  return (
    <div className="mt-6 space-y-4">
      <form onSubmit={createCompetition} className="surface-dark space-y-3 rounded-2xl p-5">
        <p className="text-sm text-[rgba(244,248,238,0.62)]">
          مسابقة النقاط: كل حجز مؤكَّد = نقطة حسب رقم الهاتف. اختاروا طريقة الفوز،
          ويمكن تعديلها لاحقًا.
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
          طريقة الفوز
          <select
            className="shop-field mt-1.5 w-full rounded-xl px-3 py-2.5"
            value={winMode}
            onChange={(e) => setWinMode(e.target.value as WinMode)}
          >
            <option value="FIRST">أول من يصل للهدف (وتنتهي المسابقة فورًا)</option>
            <option value="ALL_WHO_REACH">
              كل من يصل للهدف خلال الفترة (حتى تاريخ الانتهاء)
            </option>
          </select>
        </label>
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
                الهدف {c.goalPoints} · {winModeLabel(c.winMode)} · ينتهي{" "}
                {formatDateHe(new Date(new Date(c.endsAt).getTime() - 1000))} ·{" "}
                {c.status}
                {c.winMode === "FIRST" && c.winnerName
                  ? ` · الفائز: ${c.winnerName}`
                  : ""}
              </p>
              <p className="mt-1 text-sm text-[rgba(244,248,238,0.78)]">
                الجائزة: {c.prizeText}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                onClick={() =>
                  editingId === c.id ? setEditingId(null) : startEdit(c)
                }
              >
                {editingId === c.id ? "إلغاء التعديل" : "تعديل"}
              </button>
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
              {canRedeemPrize(c) ? (
                <button
                  type="button"
                  className="shop-chip rounded-xl px-3 py-1.5 text-sm"
                  onClick={() =>
                    patch(
                      { id: c.id, prizeRedeemed: !c.prizeRedeemed },
                      c.prizeRedeemed
                        ? "أُلغيت علامة التسليم"
                        : "سُجّل تسليم الجائزة وأُرسل SMS للفائزين",
                    )
                  }
                >
                  {c.prizeRedeemed ? "الجائزة سُلّمت ✓" : "تسليم الجائزة"}
                </button>
              ) : null}
              <button
                type="button"
                className="shop-chip rounded-xl px-3 py-1.5 text-sm text-red-200"
                onClick={() => deleteCompetition(c)}
              >
                حذف
              </button>
            </div>
          </div>

          {editingId === c.id ? (
            <form onSubmit={saveEdit} className="space-y-2 rounded-xl border border-white/10 p-3">
              <input
                className="shop-field w-full rounded-xl px-3 py-2"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
              <input
                type="number"
                min={1}
                max={100}
                className="shop-field w-full rounded-xl px-3 py-2"
                value={editGoal}
                onChange={(e) => setEditGoal(e.target.value)}
                required
              />
              <input
                className="shop-field w-full rounded-xl px-3 py-2"
                value={editPrize}
                onChange={(e) => setEditPrize(e.target.value)}
                required
              />
              <select
                className="shop-field w-full rounded-xl px-3 py-2"
                value={editWinMode}
                onChange={(e) => setEditWinMode(e.target.value as WinMode)}
              >
                <option value="FIRST">أول من يصل للهدف</option>
                <option value="ALL_WHO_REACH">كل من يصل للهدف خلال الفترة</option>
              </select>
              <input
                type="date"
                className="shop-field w-full rounded-xl px-3 py-2"
                value={editEnds}
                onChange={(e) => setEditEnds(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary w-full rounded-xl py-2 font-semibold">
                حفظ التعديلات
              </button>
            </form>
          ) : null}

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
                    <p className="font-medium">
                      {e.displayName}
                      {e.points >= c.goalPoints ? (
                        <span className="mr-2 text-xs text-[var(--lime)]">· فائز</span>
                      ) : null}
                    </p>
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
