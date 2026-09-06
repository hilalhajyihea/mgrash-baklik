"use client";

const HOURS = Array.from({ length: 24 }, (_, h) =>
  String(h).padStart(2, "0"),
);
const MINUTES = ["00", "15", "30", "45"];

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** When true, show a hint that 00:00 means end-of-day midnight. */
  endOfDayHint?: boolean;
};

function splitTime(value: string): { hour: string; minute: string } {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { hour: "18", minute: "00" };
  let hour = match[1]!;
  let minute = match[2]!;
  if (!HOURS.includes(hour)) hour = "18";
  // Snap unknown minutes to nearest allowed step.
  if (!MINUTES.includes(minute)) {
    const n = Number(minute);
    const nearest = MINUTES.reduce((best, m) =>
      Math.abs(Number(m) - n) < Math.abs(Number(best) - n) ? m : best,
    );
    minute = nearest;
  }
  return { hour, minute };
}

export function Time24Select({ value, onChange, id, endOfDayHint }: Props) {
  const { hour, minute } = splitTime(value);

  function setHour(nextHour: string) {
    onChange(`${nextHour}:${minute}`);
  }

  function setMinute(nextMinute: string) {
    onChange(`${hour}:${nextMinute}`);
  }

  return (
    <div className="mt-1.5">
      <div className="grid grid-cols-2 gap-2">
        <select
          id={id}
          className="shop-field w-full rounded-xl px-3 py-2.5"
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          aria-label="الساعة"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select
          className="shop-field w-full rounded-xl px-3 py-2.5"
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          aria-label="الدقيقة"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-[rgba(244,248,238,0.45)]">
        24 ساعة · {hour}:{minute}
        {endOfDayHint && hour === "00" && minute === "00"
          ? " (منتصف الليل — نهاية اليوم)"
          : ""}
      </p>
    </div>
  );
}
