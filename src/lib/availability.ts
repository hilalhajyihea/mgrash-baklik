import { prisma } from "@/lib/prisma";
import { buildOwnerNewBookingSms, sendSms, sms019Configured } from "@/lib/sms";
import { consumeFieldSmsQuota, refundFieldSmsQuota } from "@/lib/smsQuota";
import {
  awardCompetitionPointForBooking,
} from "@/lib/competition";
import { generateConfirmToken } from "@/lib/tokens";
import {
  addDaysToDateKey,
  combineDateAndTime,
  dateKeyToDbDate,
  dbDateToDateKey,
  endOfJerusalemDay,
  minutesToTime,
  parseWindowEndMinutes,
  startOfJerusalemDay,
  toDateKey,
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

export type AvailableSlot = {
  startTime: string;
  endTime: string;
};

/** Instant when a schedule window ends (handles 00:00 as end-of-day midnight). */
export function windowEndsAt(
  dateKey: string,
  startTime: string,
  endTime: string,
): Date {
  const endMin = parseWindowEndMinutes(startTime, endTime);
  if (endMin >= 24 * 60) {
    return combineDateAndTime(addDaysToDateKey(dateKey, 1), "00:00");
  }
  return combineDateAndTime(dateKey, minutesToTime(endMin));
}

export async function getAvailableSlots(
  fieldId: string,
  dateKey: string,
): Promise<AvailableSlot[]> {
  await expireHolds();

  const field = await prisma.field.findUnique({
    where: { id: fieldId },
  });
  if (!field || !field.isActive) return [];

  /** Each ExtraHours row is one bookable window (owner-defined length). */
  const dayWindows = await prisma.extraHours.findMany({
    where: {
      fieldId,
      date: dateKeyToDbDate(dateKey),
    },
    orderBy: { startTime: "asc" },
  });
  if (dayWindows.length === 0) return [];

  const dayStart = startOfJerusalemDay(dateKey);
  const dayEnd = endOfJerusalemDay(dateKey);

  const bookings = await prisma.booking.findMany({
    where: {
      fieldId,
      status: { in: [...blockingStatuses()] },
      startsAt: { gte: dayStart, lt: dayEnd },
    },
  });

  const now = new Date();
  const slots: AvailableSlot[] = [];

  for (const hours of dayWindows) {
    const startsAt = combineDateAndTime(dateKey, hours.startTime);
    const endsAt = windowEndsAt(dateKey, hours.startTime, hours.endTime);
    if (startsAt <= now) continue;

    const conflict = bookings.some(
      (a) => startsAt < a.endsAt && endsAt > a.startsAt,
    );
    if (!conflict) {
      slots.push({ startTime: hours.startTime, endTime: hours.endTime });
    }
  }

  return slots;
}

/**
 * Public calendar dates: continuous range from today through the owner's
 * last allocated day (gaps between scheduled days are filled in).
 * Fully booked days still appear.
 */
export async function getPublicBookingDateKeys(fieldId: string): Promise<string[]> {
  const todayKey = toDateKey();
  const from = dateKeyToDbDate(todayKey);

  const last = await prisma.extraHours.findFirst({
    where: { fieldId, date: { gte: from } },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!last) return [];

  const lastKey = dbDateToDateKey(last.date);
  const keys: string[] = [];
  for (let key = todayKey; key <= lastKey; key = addDaysToDateKey(key, 1)) {
    keys.push(key);
  }
  return keys;
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
  const slot = slots.find((s) => s.startTime === input.time);
  if (!slot) {
    throw new Error("الساعة غير متاحة");
  }

  const startsAt = combineDateAndTime(input.dateKey, slot.startTime);
  const endsAt = windowEndsAt(input.dateKey, slot.startTime, slot.endTime);
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
  const slot = slots.find((s) => s.startTime === input.time);
  if (!slot) {
    throw new Error("الساعة غير متاحة");
  }

  const startsAt = combineDateAndTime(input.dateKey, slot.startTime);
  const endsAt = windowEndsAt(input.dateKey, slot.startTime, slot.endTime);

  const booking = await prisma.$transaction(async (tx) => {
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

  if (booking.customerPhone.trim()) {
    await awardCompetitionPointForBooking({
      fieldId: input.fieldId,
      bookingId: booking.id,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
    });
  }

  return booking;
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
          id: true,
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

  await awardCompetitionPointForBooking({
    fieldId: booking.field.id,
    bookingId: booking.id,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
  });

  if (
    booking.field.smsPlanEnabled &&
    booking.field.phone &&
    sms019Configured()
  ) {
    const quota = await consumeFieldSmsQuota(booking.field.id);
    if (quota.ok) {
      const sms = await sendSms(
        booking.field.phone,
        buildOwnerNewBookingSms({
          customerName: booking.customerName,
          fieldName: booking.field.displayName,
          startsAt: updated.startsAt,
        }),
      );
      if (!sms.ok) {
        await refundFieldSmsQuota(booking.field.id, quota.monthKey);
      }
    }
  }

  return {
    ok: true,
    status: "CONFIRMED",
    already: false,
    fieldName: booking.field.displayName,
    startsAt: updated.startsAt,
  };
}
