import { prisma } from "@/lib/prisma";
import { normalizePhoneE164 } from "@/lib/sms";

export type WinMode = "FIRST" | "ALL_WHO_REACH";

export type CompetitionPublicView = {
  id: string;
  title: string;
  goalPoints: number;
  prizeText: string;
  endsAt: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  winMode: WinMode;
  winnerName: string | null;
  wonAt: string | null;
  winners: { displayName: string; points: number }[];
  leaderboard: { displayName: string; points: number }[];
};

function phoneKeyFromRaw(raw: string): string | null {
  const e164 = normalizePhoneE164(raw);
  if (e164) return e164;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 ? digits : null;
}

function asWinMode(raw: string | null | undefined): WinMode {
  return raw === "ALL_WHO_REACH" ? "ALL_WHO_REACH" : "FIRST";
}

async function expireIfPast(competitionId: string, endsAt: Date, status: string) {
  if (status !== "ACTIVE" && status !== "PAUSED") return status;
  if (endsAt.getTime() > Date.now()) return status;
  await prisma.competition.updateMany({
    where: { id: competitionId, status: { in: ["ACTIVE", "PAUSED"] } },
    data: { status: "ENDED" },
  });
  return "ENDED";
}

export async function getActiveOrRecentCompetition(fieldId: string) {
  const active = await prisma.competition.findFirst({
    where: { fieldId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (active) {
    const status = await expireIfPast(active.id, active.endsAt, active.status);
    if (status !== active.status) {
      return prisma.competition.findUnique({ where: { id: active.id } });
    }
    return active;
  }

  return prisma.competition.findFirst({
    where: { fieldId, status: "ENDED" },
    orderBy: [{ wonAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getCompetitionPublicView(
  fieldId: string,
): Promise<CompetitionPublicView | null> {
  const competition = await getActiveOrRecentCompetition(fieldId);
  if (!competition) return null;
  if (competition.status === "DRAFT") return null;

  const winMode = asWinMode(competition.winMode);

  const entries = await prisma.competitionEntry.findMany({
    where: { competitionId: competition.id },
    orderBy: [{ points: "desc" }, { displayName: "asc" }],
    take: 20,
  });

  const winners =
    winMode === "ALL_WHO_REACH"
      ? entries
          .filter((e) => e.points >= competition.goalPoints)
          .map((e) => ({ displayName: e.displayName, points: e.points }))
      : competition.winnerName
        ? [
            {
              displayName: competition.winnerName,
              points:
                entries.find((e) => e.displayName === competition.winnerName)
                  ?.points ?? competition.goalPoints,
            },
          ]
        : [];

  return {
    id: competition.id,
    title: competition.title,
    goalPoints: competition.goalPoints,
    prizeText: competition.prizeText,
    endsAt: competition.endsAt.toISOString(),
    status: competition.status as "ACTIVE" | "PAUSED" | "ENDED",
    winMode,
    winnerName: competition.winnerName,
    wonAt: competition.wonAt?.toISOString() ?? null,
    winners,
    leaderboard: entries.slice(0, 10).map((e) => ({
      displayName: e.displayName,
      points: e.points,
    })),
  };
}

async function declareFirstWinner(input: {
  competitionId: string;
  phoneKey: string;
  displayName: string;
}) {
  await prisma.competition.update({
    where: { id: input.competitionId },
    data: {
      status: "ENDED",
      winnerPhone: input.phoneKey,
      winnerName: input.displayName,
      wonAt: new Date(),
    },
  });
}

/** +1 point when a booking becomes CONFIRMED (idempotent per booking). */
export async function awardCompetitionPointForBooking(input: {
  fieldId: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
}) {
  const phoneKey = phoneKeyFromRaw(input.customerPhone);
  if (!phoneKey) return { awarded: false as const };

  const competition = await prisma.competition.findFirst({
    where: { fieldId: input.fieldId, status: "ACTIVE" },
  });
  if (!competition) return { awarded: false as const };

  const status = await expireIfPast(
    competition.id,
    competition.endsAt,
    competition.status,
  );
  if (status !== "ACTIVE") return { awarded: false as const };

  const existingEvent = await prisma.competitionEvent.findUnique({
    where: { bookingId: input.bookingId },
  });
  if (existingEvent) return { awarded: false as const };

  const winMode = asWinMode(competition.winMode);

  const result = await prisma.$transaction(async (tx) => {
    let entry = await tx.competitionEntry.findUnique({
      where: {
        competitionId_phoneKey: {
          competitionId: competition.id,
          phoneKey,
        },
      },
    });

    if (!entry) {
      entry = await tx.competitionEntry.create({
        data: {
          competitionId: competition.id,
          phoneKey,
          displayName: input.customerName.trim() || "زبون",
          points: 0,
        },
      });
    }

    const updated = await tx.competitionEntry.update({
      where: { id: entry.id },
      data: { points: { increment: 1 } },
    });

    await tx.competitionEvent.create({
      data: {
        competitionId: competition.id,
        entryId: entry.id,
        bookingId: input.bookingId,
        phoneKey,
        delta: 1,
        reason: "CONFIRM",
      },
    });

    return updated;
  });

  if (result.points >= competition.goalPoints && winMode === "FIRST") {
    await declareFirstWinner({
      competitionId: competition.id,
      phoneKey,
      displayName: result.displayName,
    });
    return { awarded: true as const, won: true as const, points: result.points };
  }

  return {
    awarded: true as const,
    won: result.points >= competition.goalPoints,
    points: result.points,
  };
}

/** −1 point when a confirmed booking is cancelled (if it had awarded a point). */
export async function revokeCompetitionPointForBooking(input: {
  fieldId: string;
  bookingId: string;
  customerPhone: string;
}) {
  const phoneKey = phoneKeyFromRaw(input.customerPhone);
  if (!phoneKey) return { revoked: false as const };

  const awardEvent = await prisma.competitionEvent.findUnique({
    where: { bookingId: input.bookingId },
  });
  if (!awardEvent || awardEvent.delta <= 0 || awardEvent.reason !== "CONFIRM") {
    return { revoked: false as const };
  }

  const alreadyCancelled = await prisma.competitionEvent.findFirst({
    where: {
      competitionId: awardEvent.competitionId,
      reason: `CANCEL:${input.bookingId}`,
    },
  });
  if (alreadyCancelled) return { revoked: false as const };

  const competition = await prisma.competition.findUnique({
    where: { id: awardEvent.competitionId },
  });
  if (!competition) return { revoked: false as const };

  await prisma.$transaction(async (tx) => {
    const entry = await tx.competitionEntry.findUnique({
      where: {
        competitionId_phoneKey: {
          competitionId: awardEvent.competitionId,
          phoneKey,
        },
      },
    });
    if (entry && entry.points > 0) {
      await tx.competitionEntry.update({
        where: { id: entry.id },
        data: { points: { decrement: 1 } },
      });
    }

    await tx.competitionEvent.create({
      data: {
        competitionId: awardEvent.competitionId,
        entryId: entry?.id ?? null,
        phoneKey,
        delta: -1,
        reason: `CANCEL:${input.bookingId}`,
      },
    });
  });

  return { revoked: true as const };
}

export async function listFieldCompetitions(fieldId: string) {
  const rows = await prisma.competition.findMany({
    where: { fieldId },
    orderBy: { createdAt: "desc" },
    include: {
      entries: {
        orderBy: [{ points: "desc" }, { displayName: "asc" }],
        take: 50,
      },
      _count: { select: { entries: true } },
    },
  });

  for (const row of rows) {
    if (row.status === "ACTIVE" || row.status === "PAUSED") {
      await expireIfPast(row.id, row.endsAt, row.status);
    }
  }

  return prisma.competition.findMany({
    where: { fieldId },
    orderBy: { createdAt: "desc" },
    include: {
      entries: {
        orderBy: [{ points: "desc" }, { displayName: "asc" }],
        take: 50,
      },
      _count: { select: { entries: true } },
    },
  });
}

export { asWinMode };
