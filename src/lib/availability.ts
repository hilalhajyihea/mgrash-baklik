import { prisma } from "@/lib/prisma";
import { buildOwnerNewBookingSms, sendSms, sms019Configured } from "@/lib/sms";
import { generateConfirmToken } from "@/lib/tokens";
import {
  combineDateAndTime,
  dateKeyToDbDate,
  endOfJerusalemDay,
  getJerusalemDayOfWeek,
  minutesToTime,
  parseTimeToMinutes,
  parseWindowEndMinutes,
  startOfJerusalemDay,
} from "@/lib/time";

export async function expireHolds(now = new Date()) {
  const result = await prisma.booking.updateMany({
    where: {
      status: "HOLD",
      holdExpiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

function blockingStatuses() {
  return ["HOLD", "CONFIRMED"] as const;
}

function buildSlotsFromWindow(input: {
  dateKey: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  bookings: { startsAt: Date; endsAt: Date }[];
}) {
  const startMin = parseTimeToMinutes(input.startTime);
  const endMin = parseWindowEndMinutes(input.startTime, input.endTime);
  const now = new Date();
  const slots: string[] = [];

  for (let t = startMin; t + input.slotMinutes <= endMin; t += input.slotMinutes) {
    const time = minutesToTime(t);
    const startsAt = combineDateAndTime(input.dateKey, time);
    const endsAt = new Date(startsAt.getTime() + input.slotMinutes * 60_000);

    if (startsAt <= now) continue;

    const conflict = input.bookings.some(
      (a) => startsAt < a.endsAt && endsAt > a.startsAt,
    );
    if (!conflict) slots.push(time);
  }

  return slots;
}

export async function getAvailableSlots(fieldId: string, dateKey: string) {
  await expireHolds();

  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: { workingHours: true },
  });
  if (!field || !field.isActive) return [];

  const dayOfWeek = getJerusalemDayOfWeek(combineDateAndTime(dateKey, "12:00"));
  const weeklyWindows = field.workingHours.filter((h) => h.dayOfWeek === dayOfWeek);

  const dayOff = await prisma.dayOff.findUnique({
    where: {
      fieldId_date: { fieldId, date: dateKeyToDbDate(dateKey) },
    },
  });
  if (dayOff) return [];

  const extraWindows = await prisma.extraHours.findMany({
    where: {
      fieldId,
      date: dateKeyToDbDate(dateKey),
    },
    orderBy: { startTime: "asc" },
  });

  const allWindows = [
    ...weeklyWindows.map((h) => ({
      startTime: h.startTime,
      endTime: h.endTime,
    })),
    ...extraWindows.map((h) => ({
      startTime: h.startTime,
      endTime: h.endTime,
    })),
  ];
  if (allWindows.length === 0) return [];

  const dayStart = startOfJerusalemDay(dateKey);
  const dayEnd = endOfJerusalemDay(dateKey);

  const bookings = await prisma.booking.findMany({
    where: {
      fieldId,
      status: { in: [...blockingStatuses()] },
      startsAt: { gte: dayStart, lt: dayEnd },
    },
  });

  const slots = new Set<string>();
  for (const hours of allWindows) {
    for (const time of buildSlotsFromWindow({
      dateKey,
      startTime: hours.startTime,
      endTime: hours.endTime,
      slotMinutes: field.slotMinutes,
      bookings,
    })) {
      slots.add(time);
    }
  }
  return Array.from(slots).sort();
}

export async function createPublicHold(input: {
  fieldId: string;
  dateKey: string;
  time: string;
  customerName: string;
  customerPhone: string;
}) {
  const field = await prisma.field.findUnique({
    where: { id: input.fieldId },
  });
  if (!field || !field.isActive) {
    throw new Error("الملعب غير فعّال");
  }

  const slots = await getAvailableSlots(input.fieldId, input.dateKey);
  if (!slots.includes(input.time)) {
    throw new Error("الساعة غير متاحة");
  }

  const startsAt = combineDateAndTime(input.dateKey, input.time);
  const endsAt = new Date(startsAt.getTime() + field.slotMinutes * 60_000);
  const holdExpiresAt = new Date(Date.now() + field.holdMinutes * 60_000);

  return prisma.$transaction(async (tx) => {
    const overlapping = await tx.booking.findFirst({
      where: {
        fieldId: input.fieldId,
        status: { in: [...blockingStatuses()] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlapping) {
      throw new Error("أُخذت الساعة في هذه الأثناء");
    }

    return tx.booking.create({
      data: {
        fieldId: input.fieldId,
        startsAt,
        endsAt,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        status: "HOLD",
        source: "PUBLIC",
        confirmToken: generateConfirmToken(),
        holdExpiresAt,
      },
    });
  });
}

export async function createAdminBooking(input: {
  fieldId: string;
  dateKey: string;
  time: string;
  customerName: string;
  customerPhone: string;
}) {
  const field = await prisma.field.findUnique({
    where: { id: input.fieldId },
  });
  if (!field || !field.isActive) {
    throw new Error("الملعب غير فعّال");
  }

  const slots = await getAvailableSlots(input.fieldId, input.dateKey);
  if (!slots.includes(input.time)) {
    throw new Error("الساعة غير متاحة");
  }

  const startsAt = combineDateAndTime(input.dateKey, input.time);
  const endsAt = new Date(startsAt.getTime() + field.slotMinutes * 60_000);

  return prisma.$transaction(async (tx) => {
    const overlapping = await tx.booking.findFirst({
      where: {
        fieldId: input.fieldId,
        status: { in: [...blockingStatuses()] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlapping) {
      throw new Error("أُخذت الساعة في هذه الأثناء");
    }

    return tx.booking.create({
      data: {
        fieldId: input.fieldId,
        startsAt,
        endsAt,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        status: "CONFIRMED",
        source: "ADMIN",
        confirmToken: generateConfirmToken(),
        confirmedAt: new Date(),
      },
    });
  });
}

export type HoldPreview =
  | {
      kind: "hold";
      fieldName: string;
      fieldSlug: string;
      startsAt: Date;
      customerName: string;
    }
  | {
      kind: "confirmed";
      fieldName: string;
      fieldSlug: string;
      startsAt: Date;
    }
  | {
      kind: "expired" | "cancelled" | "missing";
      fieldSlug?: string;
    };

async function loadBookingByToken(rawToken: string) {
  await expireHolds();
  return prisma.booking.findUnique({
    where: { confirmToken: rawToken },
    include: {
      field: {
        select: {
          displayName: true,
          slug: true,
          phone: true,
          smsPlanEnabled: true,
        },
      },
    },
  });
}

function classifyBooking(
  booking: NonNullable<Awaited<ReturnType<typeof loadBookingByToken>>>,
): HoldPreview {
  if (booking.status === "CONFIRMED") {
    return {
      kind: "confirmed",
      fieldName: booking.field.displayName,
      fieldSlug: booking.field.slug,
      startsAt: booking.startsAt,
    };
  }
  if (booking.status === "CANCELLED") {
    return { kind: "cancelled", fieldSlug: booking.field.slug };
  }
  if (booking.status !== "HOLD") {
    return { kind: "expired", fieldSlug: booking.field.slug };
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    return { kind: "expired", fieldSlug: booking.field.slug };
  }
  return {
    kind: "hold",
    fieldName: booking.field.displayName,
    fieldSlug: booking.field.slug,
    startsAt: booking.startsAt,
    customerName: booking.customerName,
  };
}

/** Read-only: used by GET /confirm so SMS previews cannot approve a hold. */
export async function peekHold(rawToken: string): Promise<HoldPreview> {
  const booking = await loadBookingByToken(rawToken);
  if (!booking) return { kind: "missing" };

  if (
    booking.status === "HOLD" &&
    booking.holdExpiresAt &&
    booking.holdExpiresAt < new Date()
  ) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "EXPIRED" },
    });
    return { kind: "expired", fieldSlug: booking.field.slug };
  }

  return classifyBooking(booking);
}

export type ConfirmResult =
  | { ok: true; status: "CONFIRMED"; already: boolean; fieldName: string; startsAt: Date }
  | { ok: false; reason: "missing" | "expired" | "cancelled" };

export async function confirmHold(rawToken: string): Promise<ConfirmResult> {
  const booking = await loadBookingByToken(rawToken);

  if (!booking) return { ok: false, reason: "missing" };
  if (booking.status === "CONFIRMED") {
    return {
      ok: true,
      status: "CONFIRMED",
      already: true,
      fieldName: booking.field.displayName,
      startsAt: booking.startsAt,
    };
  }
  if (booking.status === "CANCELLED") return { ok: false, reason: "cancelled" };
  if (booking.status !== "HOLD") return { ok: false, reason: "expired" };

  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "EXPIRED" },
    });
    return { ok: false, reason: "expired" };
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });

  if (
    booking.field.smsPlanEnabled &&
    booking.field.phone &&
    sms019Configured()
  ) {
    await sendSms(
      booking.field.phone,
      buildOwnerNewBookingSms({
        customerName: booking.customerName,
        fieldName: booking.field.displayName,
        startsAt: updated.startsAt,
      }),
    );
  }

  return {
    ok: true,
    status: "CONFIRMED",
    already: false,
    fieldName: booking.field.displayName,
    startsAt: updated.startsAt,
  };
}
