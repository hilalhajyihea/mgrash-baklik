import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFieldSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listFieldCompetitions } from "@/lib/competition";
import { endOfJerusalemDay } from "@/lib/time";

export async function GET() {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const competitions = await listFieldCompetitions(session.fieldId);
  return NextResponse.json({
    competitions: competitions.map((c) => ({
      id: c.id,
      title: c.title,
      goalPoints: c.goalPoints,
      prizeText: c.prizeText,
      endsAt: c.endsAt.toISOString(),
      status: c.status,
      winnerName: c.winnerName,
      winnerPhone: c.winnerPhone,
      wonAt: c.wonAt?.toISOString() ?? null,
      prizeRedeemed: c.prizeRedeemed,
      entryCount: c._count.entries,
      entries: c.entries.map((e) => ({
        id: e.id,
        displayName: e.displayName,
        phoneKey: e.phoneKey,
        points: e.points,
      })),
    })),
  });
}

const createSchema = z.object({
  title: z.string().min(2).max(80),
  goalPoints: z.number().int().min(1).max(100),
  prizeText: z.string().min(2).max(200),
  endsAtDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activate: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const endsAt = endOfJerusalemDay(parsed.data.endsAtDate);
  if (endsAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "تاريخ الانتهاء يجب أن يكون في المستقبل" },
      { status: 400 },
    );
  }

  const activate = parsed.data.activate !== false;
  if (activate) {
    const existingActive = await prisma.competition.findFirst({
      where: { fieldId: session.fieldId, status: "ACTIVE" },
    });
    if (existingActive) {
      return NextResponse.json(
        { error: "هناك مسابقة نشطة بالفعل. أنهوها أو أوقفوها أولًا." },
        { status: 409 },
      );
    }
  }

  const competition = await prisma.competition.create({
    data: {
      fieldId: session.fieldId,
      title: parsed.data.title.trim(),
      goalPoints: parsed.data.goalPoints,
      prizeText: parsed.data.prizeText.trim(),
      endsAt,
      status: activate ? "ACTIVE" : "DRAFT",
    },
  });

  return NextResponse.json({
    competition: {
      id: competition.id,
      title: competition.title,
      status: competition.status,
    },
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(80).optional(),
  goalPoints: z.number().int().min(1).max(100).optional(),
  prizeText: z.string().min(2).max(200).optional(),
  endsAtDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ENDED", "DRAFT"]).optional(),
  prizeRedeemed: z.boolean().optional(),
  adjustEntryId: z.string().min(1).optional(),
  adjustDelta: z.number().int().min(-20).max(20).optional(),
});

export async function PATCH(request: Request) {
  const session = await requireFieldSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const existing = await prisma.competition.findFirst({
    where: { id: parsed.data.id, fieldId: session.fieldId },
  });
  if (!existing) {
    return NextResponse.json({ error: "المسابقة غير موجودة" }, { status: 404 });
  }

  if (parsed.data.status === "ACTIVE") {
    const other = await prisma.competition.findFirst({
      where: {
        fieldId: session.fieldId,
        status: "ACTIVE",
        id: { not: existing.id },
      },
    });
    if (other) {
      return NextResponse.json(
        { error: "هناك مسابقة نشطة أخرى" },
        { status: 409 },
      );
    }
  }

  if (
    parsed.data.adjustEntryId &&
    typeof parsed.data.adjustDelta === "number" &&
    parsed.data.adjustDelta !== 0
  ) {
    const entry = await prisma.competitionEntry.findFirst({
      where: {
        id: parsed.data.adjustEntryId,
        competitionId: existing.id,
      },
    });
    if (!entry) {
      return NextResponse.json({ error: "المشارك غير موجود" }, { status: 404 });
    }

    const nextPoints = Math.max(0, entry.points + parsed.data.adjustDelta);
    await prisma.$transaction(async (tx) => {
      await tx.competitionEntry.update({
        where: { id: entry.id },
        data: { points: nextPoints },
      });
      await tx.competitionEvent.create({
        data: {
          competitionId: existing.id,
          entryId: entry.id,
          phoneKey: entry.phoneKey,
          delta: parsed.data.adjustDelta!,
          reason: "MANUAL",
        },
      });
    });

    if (
      nextPoints >= existing.goalPoints &&
      existing.status === "ACTIVE"
    ) {
      await prisma.competition.update({
        where: { id: existing.id },
        data: {
          status: "ENDED",
          winnerPhone: entry.phoneKey,
          winnerName: entry.displayName,
          wonAt: new Date(),
        },
      });
    }

    return NextResponse.json({ ok: true });
  }

  const data: {
    title?: string;
    goalPoints?: number;
    prizeText?: string;
    endsAt?: Date;
    status?: string;
    prizeRedeemed?: boolean;
  } = {};

  if (parsed.data.title) data.title = parsed.data.title.trim();
  if (parsed.data.goalPoints) data.goalPoints = parsed.data.goalPoints;
  if (parsed.data.prizeText) data.prizeText = parsed.data.prizeText.trim();
  if (parsed.data.endsAtDate) {
    data.endsAt = endOfJerusalemDay(parsed.data.endsAtDate);
  }
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.prizeRedeemed !== undefined) {
    data.prizeRedeemed = parsed.data.prizeRedeemed;
  }

  await prisma.competition.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json({ ok: true });
}
