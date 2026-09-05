"use client";

import { useEffect, useState } from "react";

type CompetitionPublicView = {
  id: string;
  title: string;
  goalPoints: number;
  prizeText: string;
  endsAt: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  winnerName: string | null;
  wonAt: string | null;
  leaderboard: { displayName: string; points: number }[];
};

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const hms = [hours, mins, secs]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return days > 0 ? `${days}ي · ${hms}` : hms;
}

export function CompetitionBanner({
  competition,
}: {
  competition: CompetitionPublicView;
}) {
  const [remainingMs, setRemainingMs] = useState(() =>
    new Date(competition.endsAt).getTime() - Date.now(),
  );

  useEffect(() => {
    setRemainingMs(new Date(competition.endsAt).getTime() - Date.now());
    const id = window.setInterval(() => {
      setRemainingMs(new Date(competition.endsAt).getTime() - Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [competition.endsAt]);

  const ended =
    competition.status === "ENDED" || remainingMs <= 0;

  return (
    <div className="surface-dark mt-6 rounded-2xl p-5 sm:p-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-[var(--lime)]">
        مسابقة الملعب
      </p>
      <h2 className="font-display mt-2 text-2xl text-[var(--cream)]">
        {competition.title}
      </h2>
      <p className="mt-2 text-sm text-[rgba(244,248,238,0.78)]">
        احجزوا {competition.goalPoints} مرات مؤكَّدة واحصلوا على:{" "}
        {competition.prizeText}
      </p>

      {ended ? (
        <p className="mt-4 text-base font-semibold text-[var(--lime)]">
          {competition.winnerName
            ? `انتهت المسابقة — الفائز: ${competition.winnerName}`
            : "انتهت المسابقة"}
        </p>
      ) : competition.status === "PAUSED" ? (
        <p className="mt-4 text-sm text-[rgba(244,248,238,0.62)]">
          المسابقة متوقفة مؤقتًا.
        </p>
      ) : (
        <p className="mt-4 font-mono text-lg text-[var(--cream)]">
          تنتهي خلال: {formatCountdown(remainingMs)}
        </p>
      )}

      {competition.leaderboard.length > 0 ? (
        <ol className="mt-5 space-y-1.5 text-sm text-[rgba(244,248,238,0.85)]">
          {competition.leaderboard.slice(0, 5).map((row, i) => (
            <li key={`${row.displayName}-${i}`} className="flex justify-between gap-3">
              <span>
                {i + 1}. {row.displayName}
              </span>
              <span className="text-[var(--lime)]">
                {row.points}/{competition.goalPoints}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-[rgba(244,248,238,0.55)]">
          لا مشاركين بعد — كونوا الأوائل!
        </p>
      )}
    </div>
  );
}
